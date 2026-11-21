-- =====================================================================
-- ROYAL POWER – Migration 0003: Row Level Security, storage, realtime
-- Principle: visitors can read the active catalog + public settings and
-- call two RPCs (submit_ticket / track_ticket). Everything else needs an
-- authenticated administrator (public.is_admin()).
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.departments           enable row level security;
alter table public.equipment_categories  enable row level security;
alter table public.equipment_items       enable row level security;
alter table public.tickets               enable row level security;
alter table public.ticket_items          enable row level security;
alter table public.ticket_activity_logs  enable row level security;
alter table public.notifications         enable row level security;
alter table public.system_settings       enable row level security;
alter table public.ticket_counters       enable row level security;   -- no policies = no client access
alter table public.ticket_track_attempts enable row level security;   -- no policies = no client access

-- ---------- profiles ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- (role / must_change_password are protected by the protect_profile trigger)

-- ---------- departments ----------
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists departments_admin_write on public.departments;
create policy departments_admin_write on public.departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- equipment_categories ----------
drop policy if exists categories_select on public.equipment_categories;
create policy categories_select on public.equipment_categories for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists categories_admin_write on public.equipment_categories;
create policy categories_admin_write on public.equipment_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- equipment_items ----------
drop policy if exists items_select on public.equipment_items;
create policy items_select on public.equipment_items for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists items_admin_write on public.equipment_items;
create policy items_admin_write on public.equipment_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- tickets (NO insert / delete policy: created only via submit_ticket, never deleted) ----------
drop policy if exists tickets_admin_select on public.tickets;
create policy tickets_admin_select on public.tickets for select to authenticated
  using (public.is_admin());

drop policy if exists tickets_admin_update on public.tickets;
create policy tickets_admin_update on public.tickets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- ticket_items / activity logs (read-only for admins) ----------
drop policy if exists ticket_items_admin_select on public.ticket_items;
create policy ticket_items_admin_select on public.ticket_items for select to authenticated
  using (public.is_admin());

drop policy if exists ticket_logs_admin_select on public.ticket_activity_logs;
create policy ticket_logs_admin_select on public.ticket_activity_logs for select to authenticated
  using (public.is_admin());

-- ---------- notifications (each admin sees and manages only their own) ----------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = auth.uid() and public.is_admin());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid() and public.is_admin())
  with check (recipient_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (recipient_id = auth.uid() and public.is_admin());

-- ---------- system_settings ----------
drop policy if exists settings_select on public.system_settings;
create policy settings_select on public.system_settings for select to anon, authenticated
  using (is_public or public.is_admin());

drop policy if exists settings_admin_write on public.system_settings;
create policy settings_admin_write on public.system_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- table privileges (RLS is the gatekeeper; keep grants tight) ----------
revoke all on public.ticket_counters, public.ticket_track_attempts from anon, authenticated;
revoke insert, update, delete on public.tickets, public.ticket_items, public.ticket_activity_logs from anon;
revoke all on public.tickets, public.ticket_items, public.ticket_activity_logs, public.notifications, public.profiles from anon;
revoke insert, delete on public.tickets, public.ticket_items, public.ticket_activity_logs from authenticated;
revoke insert on public.notifications from authenticated;
revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.departments, public.equipment_categories, public.equipment_items, public.system_settings from anon;

-- =====================================================================
-- Storage
--   ticket-attachments : private. Anyone may upload into tickets/<uuid>/…
--                        (5 MB, images / pdf / office docs). Only admins read.
--   branding           : public read (company logo). Only admins write.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments', 'ticket-attachments', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists rp_attachments_insert on storage.objects;
create policy rp_attachments_insert on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'ticket-attachments'
    and (storage.foldername(name))[1] = 'tickets'
    and name !~ '\.\.'
  );

drop policy if exists rp_attachments_admin_select on storage.objects;
create policy rp_attachments_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'ticket-attachments' and public.is_admin());

drop policy if exists rp_attachments_admin_delete on storage.objects;
create policy rp_attachments_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-attachments' and public.is_admin());

drop policy if exists rp_branding_admin_insert on storage.objects;
create policy rp_branding_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'branding' and public.is_admin());

drop policy if exists rp_branding_admin_update on storage.objects;
create policy rp_branding_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'branding' and public.is_admin());

drop policy if exists rp_branding_admin_delete on storage.objects;
create policy rp_branding_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'branding' and public.is_admin());

-- =====================================================================
-- Realtime (RLS still applies to every change event)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['tickets', 'ticket_items', 'ticket_activity_logs', 'notifications',
                           'departments', 'equipment_categories', 'equipment_items', 'system_settings']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
