-- =====================================================================
-- ROYAL POWER – Smart IT Support & Asset Management
-- Migration 0001: extensions, tables, constraints, indexes
-- Run migrations 0001 -> 0004 in order (SQL editor or `supabase db push`).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. profiles  (one row per Supabase auth user; role lives here)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  full_name             text,
  designation           text,
  phone                 text,
  role                  text not null default 'user' check (role in ('user', 'admin')),
  must_change_password  boolean not null default false,
  pw_fingerprint        text,
  notify_new_ticket     boolean not null default true,
  notify_critical       boolean not null default true,
  notify_updates        boolean not null default true,
  notify_cancelled      boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. departments
-- ---------------------------------------------------------------------
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists departments_name_uidx on public.departments (lower(name));

-- ---------------------------------------------------------------------
-- 3. equipment_categories
-- ---------------------------------------------------------------------
create table if not exists public.equipment_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text,
  icon        text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists equipment_categories_name_uidx on public.equipment_categories (lower(name));

-- ---------------------------------------------------------------------
-- 4. equipment_items
-- ---------------------------------------------------------------------
create table if not exists public.equipment_items (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.equipment_categories(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  description   text,
  is_active     boolean not null default true,   -- shown in the catalog at all
  is_available  boolean not null default true,   -- can currently be requested
  is_other      boolean not null default false,  -- "Other IT Equipment" (user specifies the name)
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists equipment_items_cat_name_uidx on public.equipment_items (category_id, lower(name));
create index if not exists equipment_items_category_idx on public.equipment_items (category_id);

-- ---------------------------------------------------------------------
-- 5. tickets
--    Department / equipment names are stored as snapshots so history is
--    preserved when catalog rows are later edited or deleted.
-- ---------------------------------------------------------------------
create table if not exists public.ticket_counters (
  year        integer primary key,
  last_value  integer not null default 0
);

create table if not exists public.tickets (
  id                 uuid primary key default gen_random_uuid(),
  ticket_no          text not null unique,
  full_name          text not null check (char_length(full_name) between 2 and 120),
  employee_id        text not null check (char_length(employee_id) between 1 and 40),
  email              text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  department_id      uuid references public.departments(id) on delete set null,
  department_name    text not null,
  designation        text not null check (char_length(designation) between 1 and 120),
  branch             text not null check (char_length(branch) between 1 and 120),
  priority           text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status             text not null default 'pending' check (status in ('pending', 'in_progress', 'resolved', 'cancelled')),
  reason             text not null check (char_length(reason) between 5 and 4000),
  notes              text check (notes is null or char_length(notes) <= 4000),
  attachments        jsonb not null default '[]'::jsonb,
  tracking_hash      text,
  admin_remarks      text,
  resolution_notes   text,
  assigned_to        text,
  status_updated_at  timestamptz not null default now(),
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists tickets_status_idx      on public.tickets (status);
create index if not exists tickets_priority_idx    on public.tickets (priority);
create index if not exists tickets_department_idx  on public.tickets (department_id);
create index if not exists tickets_created_idx     on public.tickets (created_at desc);
create index if not exists tickets_email_idx       on public.tickets (lower(email));
create index if not exists tickets_employee_idx    on public.tickets (employee_id);

-- brute-force protection for the public tracking lookup
create table if not exists public.ticket_track_attempts (
  ticket_id     uuid primary key references public.tickets(id) on delete cascade,
  failed        integer not null default 0,
  locked_until  timestamptz
);

-- ---------------------------------------------------------------------
-- 6. ticket_items
-- ---------------------------------------------------------------------
create table if not exists public.ticket_items (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null references public.tickets(id) on delete cascade,
  category_id    uuid references public.equipment_categories(id) on delete set null,
  category_name  text,
  item_id        uuid references public.equipment_items(id) on delete set null,
  item_name      text not null check (char_length(btrim(item_name)) between 1 and 160),
  is_custom      boolean not null default false,
  quantity       integer not null check (quantity between 1 and 1000),
  created_at     timestamptz not null default now()
);
create index if not exists ticket_items_ticket_idx on public.ticket_items (ticket_id);
create index if not exists ticket_items_name_idx   on public.ticket_items (item_name);

-- ---------------------------------------------------------------------
-- 7. ticket_activity_logs  (audit trail; is_public rows are shown to the requester)
-- ---------------------------------------------------------------------
create table if not exists public.ticket_activity_logs (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.tickets(id) on delete cascade,
  actor_id     uuid references auth.users(id) on delete set null,
  actor_name   text,
  action       text not null,
  from_status  text,
  to_status    text,
  message      text,
  is_public    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists ticket_logs_ticket_idx on public.ticket_activity_logs (ticket_id, created_at);

-- ---------------------------------------------------------------------
-- 8. notifications  (one row per admin recipient)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('new_ticket', 'critical_ticket', 'ticket_updated', 'ticket_cancelled')),
  title         text not null,
  message       text,
  ticket_id     uuid references public.tickets(id) on delete cascade,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

-- ---------------------------------------------------------------------
-- 9. system_settings  (key/value; is_public keys are readable by visitors)
-- ---------------------------------------------------------------------
create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null,
  is_public   boolean not null default false,
  updated_at  timestamptz not null default now()
);
