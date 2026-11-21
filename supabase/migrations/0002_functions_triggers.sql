-- =====================================================================
-- ROYAL POWER – Migration 0002: functions, triggers, RPCs
-- =====================================================================

-- ---------- generic updated_at ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_departments_updated on public.departments;
create trigger trg_departments_updated before update on public.departments
  for each row execute function public.set_updated_at();
drop trigger if exists trg_categories_updated on public.equipment_categories;
create trigger trg_categories_updated before update on public.equipment_categories
  for each row execute function public.set_updated_at();
drop trigger if exists trg_items_updated on public.equipment_items;
create trigger trg_items_updated before update on public.equipment_items
  for each row execute function public.set_updated_at();
drop trigger if exists trg_settings_updated on public.system_settings;
create trigger trg_settings_updated before update on public.system_settings
  for each row execute function public.set_updated_at();

-- ---------- role helper ----------
-- An admin who still has the initial password has NO admin rights until the
-- password has been changed (enforced here, in the database, not just in the UI).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.must_change_password = false
  );
$$;

-- ---------- auth.users -> profiles ----------
-- The role can only come from app_metadata, which clients can never set.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, must_change_password, pw_fingerprint)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin' else 'user' end,
    coalesce((new.raw_app_meta_data ->> 'must_change_password')::boolean, false),
    md5(coalesce(new.encrypted_password, ''))
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- stop clients from escalating their own profile ----------
create or replace function public.protect_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then            -- a client session (not SQL editor / service role)
    if new.role is distinct from old.role then
      raise exception 'The role cannot be changed' using errcode = '42501';
    end if;
    new.id    := old.id;
    new.email := old.email;
    if coalesce(current_setting('app.pw_flow', true), '') <> 'on' then
      new.must_change_password := old.must_change_password;
      new.pw_fingerprint       := old.pw_fingerprint;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect before update on public.profiles
  for each row execute function public.protect_profile();

-- Called after the forced password change. Verifies the password hash really changed.
create or replace function public.complete_password_change()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old text;
  v_now text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select pw_fingerprint into v_old from public.profiles where id = auth.uid();
  select md5(coalesce(encrypted_password, '')) into v_now from auth.users where id = auth.uid();
  if v_old is not null and v_old = v_now then
    raise exception 'The password has not been changed yet';
  end if;
  perform set_config('app.pw_flow', 'on', true);
  update public.profiles
     set must_change_password = false, pw_fingerprint = v_now
   where id = auth.uid();
end $$;

-- Used ONLY by scripts/create-admin.mjs (service role) after (re)setting the initial password.
create or replace function public.refresh_password_fingerprint(p_user uuid)
returns void language sql security definer set search_path = public as $$
  update public.profiles
     set pw_fingerprint = (select md5(coalesce(encrypted_password, '')) from auth.users where id = p_user)
   where id = p_user;
$$;
revoke all on function public.refresh_password_fingerprint(uuid) from public, anon, authenticated;
grant execute on function public.refresh_password_fingerprint(uuid) to service_role;

-- ---------- ticket numbering: PREFIX-YEAR-00001 ----------
create or replace function public.next_ticket_no()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year   integer := extract(year from now())::integer;
  v_n      integer;
  v_prefix text;
begin
  insert into public.ticket_counters (year, last_value) values (v_year, 1)
  on conflict (year) do update set last_value = public.ticket_counters.last_value + 1
  returning last_value into v_n;

  select nullif(btrim(value #>> '{}'), '') into v_prefix from public.system_settings where key = 'ticket_prefix';
  v_prefix := upper(regexp_replace(coalesce(v_prefix, 'RP'), '[^A-Za-z0-9]', '', 'g'));
  if v_prefix = '' then v_prefix := 'RP'; end if;

  return v_prefix || '-' || v_year || '-' || lpad(v_n::text, 5, '0');
end $$;

-- ---------- notifications fan-out ----------
create or replace function public.notify_admins(p_type text, p_title text, p_message text, p_ticket uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (recipient_id, type, title, message, ticket_id)
  select p.id, p_type, p_title, p_message, p_ticket
  from public.profiles p
  where p.role = 'admin'
    and case p_type
          when 'new_ticket'       then p.notify_new_ticket
          when 'critical_ticket'  then p.notify_critical
          when 'ticket_cancelled' then p.notify_cancelled
          else p.notify_updates
        end;
end $$;

-- ---------- ticket triggers ----------
create or replace function public.tickets_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then            -- immutable from client sessions
    new.ticket_no     := old.ticket_no;
    new.tracking_hash := old.tracking_hash;
    new.created_at    := old.created_at;
    new.attachments   := old.attachments;
  end if;
  new.updated_at := now();
  if new.status is distinct from old.status then
    new.status_updated_at := now();
    new.resolved_at := case when new.status = 'resolved' then now() else null end;
  end if;
  return new;
end $$;

drop trigger if exists trg_tickets_before_update on public.tickets;
create trigger trg_tickets_before_update before update on public.tickets
  for each row execute function public.tickets_before_update();

create or replace function public.tickets_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admins(
    'new_ticket',
    'New ticket ' || new.ticket_no,
    new.full_name || ' (' || new.department_name || ') submitted a ' || new.priority || ' priority request.',
    new.id
  );
  if new.priority = 'critical' then
    perform public.notify_admins(
      'critical_ticket',
      'Critical ticket ' || new.ticket_no,
      'A CRITICAL priority request was raised by ' || new.full_name || ' (' || new.department_name || ').',
      new.id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_tickets_after_insert on public.tickets;
create trigger trg_tickets_after_insert after insert on public.tickets
  for each row execute function public.tickets_after_insert();

create or replace function public.tickets_after_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor    text;
  v_changed  boolean := false;
  v_old_lbl  text;
  v_new_lbl  text;
begin
  select coalesce(nullif(full_name, ''), email) into v_actor from public.profiles where id = auth.uid();
  v_actor := coalesce(v_actor, 'System');

  if new.status is distinct from old.status then
    v_changed := true;
    v_old_lbl := initcap(replace(old.status, '_', ' '));
    v_new_lbl := initcap(replace(new.status, '_', ' '));
    insert into public.ticket_activity_logs (ticket_id, actor_id, actor_name, action, from_status, to_status, message, is_public)
    values (new.id, auth.uid(), v_actor, 'status_changed', old.status, new.status,
            'Status changed from ' || v_old_lbl || ' to ' || v_new_lbl, true);

    if new.status = 'cancelled' then
      perform public.notify_admins('ticket_cancelled', 'Ticket ' || new.ticket_no || ' cancelled',
        v_actor || ' cancelled the request from ' || new.full_name || '.', new.id);
    else
      perform public.notify_admins('ticket_updated', 'Ticket ' || new.ticket_no || ' updated',
        v_actor || ' moved the ticket to ' || v_new_lbl || '.', new.id);
    end if;
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.ticket_activity_logs (ticket_id, actor_id, actor_name, action, message, is_public)
    values (new.id, auth.uid(), v_actor, 'assigned',
            case when coalesce(new.assigned_to, '') = '' then 'Ticket unassigned'
                 else 'Assigned to ' || new.assigned_to end, true);
    if not v_changed then
      v_changed := true;
      perform public.notify_admins('ticket_updated', 'Ticket ' || new.ticket_no || ' updated',
        v_actor || ' changed the assignment.', new.id);
    end if;
  end if;

  if new.admin_remarks is distinct from old.admin_remarks
     or new.resolution_notes is distinct from old.resolution_notes then
    insert into public.ticket_activity_logs (ticket_id, actor_id, actor_name, action, message, is_public)
    values (new.id, auth.uid(), v_actor, 'note',
            case when new.resolution_notes is distinct from old.resolution_notes
                 then 'Resolution notes updated' else 'Admin remarks updated' end,
            new.resolution_notes is distinct from old.resolution_notes);
    if not v_changed then
      perform public.notify_admins('ticket_updated', 'Ticket ' || new.ticket_no || ' updated',
        v_actor || ' updated remarks / resolution notes.', new.id);
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_tickets_after_update on public.tickets;
create trigger trg_tickets_after_update after update on public.tickets
  for each row execute function public.tickets_after_update();

-- =====================================================================
-- PUBLIC RPC: submit_ticket
-- The ONLY way an anonymous visitor can create a ticket. Validates
-- everything server-side, generates the ticket number and a one-time
-- tracking code (only its bcrypt hash is stored).
-- =====================================================================
create or replace function public.submit_ticket(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name     text := btrim(coalesce(payload ->> 'full_name', ''));
  v_emp      text := btrim(coalesce(payload ->> 'employee_id', ''));
  v_email    text := lower(btrim(coalesce(payload ->> 'email', '')));
  v_desig    text := btrim(coalesce(payload ->> 'designation', ''));
  v_branch   text := btrim(coalesce(payload ->> 'branch', ''));
  v_priority text := lower(btrim(coalesce(payload ->> 'priority', '')));
  v_reason   text := btrim(coalesce(payload ->> 'reason', ''));
  v_notes    text := nullif(btrim(coalesce(payload ->> 'notes', '')), '');
  v_items    jsonb := coalesce(payload -> 'items', '[]'::jsonb);
  v_atts_in  jsonb := coalesce(payload -> 'attachments', '[]'::jsonb);
  v_atts     jsonb := '[]'::jsonb;
  v_dept     public.departments;
  v_ticket   uuid;
  v_ticket_no text;
  v_hash     text;
  v_code     text;
  v_created  timestamptz;
  it         jsonb;
  att        jsonb;
  v_qty      integer;
  v_catalog  record;
  v_cat_id   uuid;
  v_cat_name text;
  v_item_id  uuid;
  v_item_name text;
  v_custom   boolean;
begin
  -- ---- requester validation ----
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Please enter your full name' using errcode = '22023';
  end if;
  if v_emp = '' or char_length(v_emp) > 40 then
    raise exception 'Please enter a valid employee ID' using errcode = '22023';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;
  if v_desig = '' or char_length(v_desig) > 120 then
    raise exception 'Please enter your designation' using errcode = '22023';
  end if;
  if v_branch = '' or char_length(v_branch) > 120 then
    raise exception 'Please enter your branch / location' using errcode = '22023';
  end if;
  if v_priority not in ('low', 'medium', 'high', 'critical') then
    raise exception 'Please choose a valid priority' using errcode = '22023';
  end if;
  if char_length(v_reason) < 5 or char_length(v_reason) > 4000 then
    raise exception 'Please describe the reason for your request (at least 5 characters)' using errcode = '22023';
  end if;
  if v_notes is not null and char_length(v_notes) > 4000 then
    raise exception 'Additional notes are too long' using errcode = '22023';
  end if;

  select * into v_dept from public.departments
   where id = nullif(payload ->> 'department_id', '')::uuid and is_active;
  if not found then
    raise exception 'Please choose a valid department' using errcode = '22023';
  end if;

  -- ---- items ----
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Add at least one equipment item' using errcode = '22023';
  end if;
  if jsonb_array_length(v_items) > 20 then
    raise exception 'A request can contain at most 20 items' using errcode = '22023';
  end if;

  -- ---- attachments (paths must be in our upload folder) ----
  if jsonb_typeof(v_atts_in) = 'array' then
    if jsonb_array_length(v_atts_in) > 5 then
      raise exception 'At most 5 attachments are allowed' using errcode = '22023';
    end if;
    for att in select * from jsonb_array_elements(v_atts_in) loop
      if coalesce(att ->> 'path', '') ~ '^tickets/[0-9a-fA-F-]{36}/[A-Za-z0-9._-]{1,120}$' then
        v_atts := v_atts || jsonb_build_array(jsonb_build_object(
          'path', att ->> 'path',
          'name', left(coalesce(att ->> 'name', 'file'), 160),
          'size', coalesce((att ->> 'size')::bigint, 0),
          'type', left(coalesce(att ->> 'type', ''), 100)
        ));
      end if;
    end loop;
  end if;

  -- ---- tracking code (shown once; only the hash is stored) ----
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  v_hash := crypt(v_code, gen_salt('bf'));
  v_ticket_no := public.next_ticket_no();

  insert into public.tickets (
    ticket_no, full_name, employee_id, email, department_id, department_name,
    designation, branch, priority, status, reason, notes, attachments, tracking_hash
  ) values (
    v_ticket_no, v_name, v_emp, v_email, v_dept.id, v_dept.name,
    v_desig, v_branch, v_priority, 'pending', v_reason, v_notes, v_atts, v_hash
  )
  returning id, created_at into v_ticket, v_created;

  for it in select * from jsonb_array_elements(v_items) loop
    if coalesce(it ->> 'quantity', '') !~ '^[0-9]{1,4}$' then
      raise exception 'Each item needs a whole-number quantity' using errcode = '22023';
    end if;
    v_qty := (it ->> 'quantity')::integer;
    if v_qty < 1 or v_qty > 1000 then
      raise exception 'Quantity must be between 1 and 1000' using errcode = '22023';
    end if;

    v_cat_id := null; v_cat_name := null; v_item_id := null; v_item_name := null; v_custom := false;

    if coalesce(it ->> 'item_id', '') <> '' then
      select i.id, i.name, i.is_other, c.id as cat_id, c.name as cat_name
        into v_catalog
        from public.equipment_items i
        join public.equipment_categories c on c.id = i.category_id
       where i.id = (it ->> 'item_id')::uuid
         and i.is_active and i.is_available and c.is_active;
      if not found then
        raise exception 'One of the selected equipment items is no longer available' using errcode = '22023';
      end if;
      v_cat_id := v_catalog.cat_id;
      v_cat_name := v_catalog.cat_name;
      if v_catalog.is_other then
        v_custom := true;
        v_item_name := btrim(coalesce(it ->> 'custom_name', ''));
      else
        v_item_id := v_catalog.id;
        v_item_name := v_catalog.name;
      end if;
    else
      v_custom := true;
      v_item_name := btrim(coalesce(it ->> 'custom_name', ''));
      if coalesce(it ->> 'category_id', '') <> '' then
        select c.id, c.name into v_cat_id, v_cat_name
          from public.equipment_categories c
         where c.id = (it ->> 'category_id')::uuid and c.is_active;
      end if;
    end if;

    if v_item_name is null or char_length(v_item_name) < 2 or char_length(v_item_name) > 160 then
      raise exception 'Please specify the equipment name for "Other" items' using errcode = '22023';
    end if;

    insert into public.ticket_items (ticket_id, category_id, category_name, item_id, item_name, is_custom, quantity)
    values (v_ticket, v_cat_id, v_cat_name, v_item_id, v_item_name, v_custom, v_qty);
  end loop;

  insert into public.ticket_activity_logs (ticket_id, actor_name, action, to_status, message, is_public)
  values (v_ticket, v_name, 'created', 'pending', 'Request submitted', true);

  return jsonb_build_object(
    'ticket_no', v_ticket_no,
    'tracking_code', substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4),
    'created_at', v_created,
    'status', 'pending'
  );
end $$;

-- =====================================================================
-- PUBLIC RPC: track_ticket
-- Requester proves ownership with Ticket ID + email + tracking code.
-- Returns only requester-safe fields. Locks for 15 min after 5 failures.
-- =====================================================================
create or replace function public.track_ticket(p_ticket_no text, p_email text, p_code text)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  t        public.tickets;
  a        public.ticket_track_attempts;
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_fail   constant jsonb := jsonb_build_object('ok', false,
             'message', 'We could not verify those details. Please check the Ticket ID, email and tracking code.');
begin
  select * into t from public.tickets
   where upper(ticket_no) = upper(btrim(coalesce(p_ticket_no, '')))
     and lower(email) = lower(btrim(coalesce(p_email, '')));
  if not found then
    return v_fail;
  end if;

  select * into a from public.ticket_track_attempts where ticket_id = t.id;
  if found and a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('ok', false,
      'message', 'Too many unsuccessful attempts. Please try again in a few minutes.');
  end if;

  if t.tracking_hash is null or v_code = '' or crypt(v_code, t.tracking_hash) <> t.tracking_hash then
    insert into public.ticket_track_attempts (ticket_id, failed, locked_until)
    values (t.id, 1, null)
    on conflict (ticket_id) do update
      set failed = case when public.ticket_track_attempts.failed + 1 >= 5 then 0
                        else public.ticket_track_attempts.failed + 1 end,
          locked_until = case when public.ticket_track_attempts.failed + 1 >= 5
                              then now() + interval '15 minutes' else null end;
    return v_fail;
  end if;

  delete from public.ticket_track_attempts where ticket_id = t.id;

  return jsonb_build_object(
    'ok', true,
    'ticket', jsonb_build_object(
      'ticket_no', t.ticket_no,
      'status', t.status,
      'priority', t.priority,
      'full_name', t.full_name,
      'department_name', t.department_name,
      'designation', t.designation,
      'branch', t.branch,
      'reason', t.reason,
      'assigned_to', t.assigned_to,
      'resolution_notes', t.resolution_notes,
      'created_at', t.created_at,
      'status_updated_at', t.status_updated_at
    ),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'item_name', i.item_name, 'category_name', i.category_name, 'quantity', i.quantity)
             order by i.created_at), '[]'::jsonb)
        from public.ticket_items i where i.ticket_id = t.id
    ),
    'history', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'action', l.action, 'from_status', l.from_status, 'to_status', l.to_status,
               'message', l.message, 'created_at', l.created_at)
             order by l.created_at), '[]'::jsonb)
        from public.ticket_activity_logs l where l.ticket_id = t.id and l.is_public
    )
  );
end $$;

-- =====================================================================
-- ADMIN RPC: admin_analytics  (all dashboard / report numbers come from here)
-- =====================================================================
create or replace function public.admin_analytics(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with t as (
    select * from public.tickets
     where (p_from is null or created_at >= p_from)
       and (p_to   is null or created_at <  p_to)
  )
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'total',       count(*),
        'pending',     count(*) filter (where status = 'pending'),
        'in_progress', count(*) filter (where status = 'in_progress'),
        'resolved',    count(*) filter (where status = 'resolved'),
        'cancelled',   count(*) filter (where status = 'cancelled'),
        'critical',    count(*) filter (where priority = 'critical')
      ) from t
    ),
    'by_status', (
      select coalesce(jsonb_agg(jsonb_build_object('status', s.status, 'count', s.c) order by s.status), '[]'::jsonb)
        from (select status, count(*) c from t group by status) s
    ),
    'by_priority', (
      select coalesce(jsonb_agg(jsonb_build_object('priority', s.priority, 'count', s.c)), '[]'::jsonb)
        from (select priority, count(*) c from t group by priority) s
    ),
    'by_department', (
      select coalesce(jsonb_agg(jsonb_build_object('name', d.department_name, 'count', d.c) order by d.c desc, d.department_name), '[]'::jsonb)
        from (select department_name, count(*) c from t group by department_name) d
    ),
    'top_items', (
      select coalesce(jsonb_agg(jsonb_build_object('name', x.item_name, 'requests', x.requests, 'quantity', x.qty)
                                order by x.requests desc, x.qty desc), '[]'::jsonb)
        from (
          select ti.item_name, count(distinct ti.ticket_id) as requests, sum(ti.quantity) as qty
            from public.ticket_items ti
            join t on t.id = ti.ticket_id
           group by ti.item_name
           order by count(distinct ti.ticket_id) desc, sum(ti.quantity) desc
           limit 10
        ) x
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'month', to_char(m.month, 'Mon YY'),
               'total', coalesce(c.total, 0),
               'resolved', coalesce(c.resolved, 0)) order by m.month), '[]'::jsonb)
        from (
          select generate_series(date_trunc('month', now()) - interval '11 months',
                                 date_trunc('month', now()), interval '1 month') as month
        ) m
        left join (
          select date_trunc('month', created_at) as mm,
                 count(*) as total,
                 count(*) filter (where status = 'resolved') as resolved
            from public.tickets group by 1
        ) c on c.mm = m.month
    ),
    'avg_resolution_hours', (
      select round((avg(extract(epoch from (resolved_at - created_at)) / 3600))::numeric, 1)
        from t where resolved_at is not null
    )
  ) into r;

  return r;
end $$;

-- ---------- function privileges ----------
revoke all on function public.next_ticket_no()               from public, anon, authenticated;
revoke all on function public.notify_admins(text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.submit_ticket(jsonb)           from public;
revoke all on function public.track_ticket(text, text, text) from public;
revoke all on function public.admin_analytics(timestamptz, timestamptz) from public, anon;
revoke all on function public.complete_password_change()     from public, anon;
revoke all on function public.is_admin()                     from public;

grant execute on function public.submit_ticket(jsonb)           to anon, authenticated;
grant execute on function public.track_ticket(text, text, text) to anon, authenticated;
grant execute on function public.admin_analytics(timestamptz, timestamptz) to authenticated;
grant execute on function public.complete_password_change()     to authenticated;
grant execute on function public.is_admin()                     to anon, authenticated;
