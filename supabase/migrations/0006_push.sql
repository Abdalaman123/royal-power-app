-- =====================================================================
-- ROYAL POWER – Migration 0006: phone push notifications (device tokens)
-- Run AFTER 0005 (SQL Editor -> paste -> Run). Safe to run twice.
-- Each admin phone registers a Firebase token; the "push-notify" Edge Function sends to it.
-- =====================================================================
create table if not exists public.admin_devices (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  platform   text not null default 'android',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists admin_devices_user_idx on public.admin_devices (user_id);

alter table public.admin_devices enable row level security;
-- no client policies: phones use the two functions below, the Edge Function uses the service role
revoke all on public.admin_devices from anon, authenticated;

create or replace function public.register_device(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) < 20 then
    raise exception 'Invalid device token';
  end if;
  insert into public.admin_devices (token, user_id, platform)
  values (p_token, auth.uid(), coalesce(nullif(p_platform, ''), 'android'))
  on conflict (token) do update set user_id = auth.uid(), updated_at = now();
end $$;

create or replace function public.unregister_device(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.admin_devices where token = p_token and user_id = auth.uid();
end $$;

revoke all on function public.register_device(text, text) from public, anon;
revoke all on function public.unregister_device(text) from public, anon;
grant execute on function public.register_device(text, text) to authenticated;
grant execute on function public.unregister_device(text) to authenticated;
