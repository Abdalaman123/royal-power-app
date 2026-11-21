-- =====================================================================
-- ROYAL POWER – Migration 0005: inventory stock, office users, assignments
-- Run AFTER 0001-0004 (SQL Editor -> paste -> Run). Safe to run twice.
--
--   equipment_stock        total units owned per catalog item (admin only)
--   office_users           employees who can be issued equipment (admin only)
--   equipment_assignments  who holds what; history is never deleted
--   available (backup)  =  stock total  -  units currently assigned
-- =====================================================================

-- ---------------------------------------------------------------------
-- office_users
-- ---------------------------------------------------------------------
create table if not exists public.office_users (
  id              uuid primary key default gen_random_uuid(),
  employee_id     text not null,
  full_name       text not null,
  email           text,
  phone           text,
  department_id   uuid references public.departments(id) on delete set null,
  department_name text,
  designation     text,
  branch          text,
  notes           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint office_users_name_chk  check (char_length(btrim(full_name)) between 2 and 120),
  constraint office_users_empid_chk check (char_length(btrim(employee_id)) between 1 and 40)
);
create unique index if not exists office_users_employee_id_uidx on public.office_users (lower(btrim(employee_id)));
create index if not exists office_users_name_idx on public.office_users (lower(full_name));
create index if not exists office_users_dept_idx on public.office_users (department_id);

drop trigger if exists trg_office_users_updated on public.office_users;
create trigger trg_office_users_updated before update on public.office_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- equipment_stock  (kept apart from equipment_items, which is public-readable)
-- ---------------------------------------------------------------------
create table if not exists public.equipment_stock (
  item_id        uuid primary key references public.equipment_items(id) on delete cascade,
  total_quantity integer not null default 0 check (total_quantity >= 0),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_stock_updated on public.equipment_stock;
create trigger trg_stock_updated before update on public.equipment_stock
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- equipment_assignments
-- ---------------------------------------------------------------------
create table if not exists public.equipment_assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.office_users(id) on delete restrict,
  item_id          uuid references public.equipment_items(id) on delete set null,
  item_name        text not null,
  category_name    text,
  quantity         integer not null check (quantity > 0),
  serial_no        text,
  asset_tag        text,
  ticket_no        text,
  notes            text,
  status           text not null default 'assigned' check (status in ('assigned', 'returned')),
  assigned_at      timestamptz not null default now(),
  assigned_by      uuid,
  assigned_by_name text,
  returned_at      timestamptz,
  return_notes     text,
  returned_by_name text,
  created_at       timestamptz not null default now()
);
create index if not exists assignments_user_idx   on public.equipment_assignments (user_id, status);
create index if not exists assignments_item_idx   on public.equipment_assignments (item_id, status);
create index if not exists assignments_status_idx on public.equipment_assignments (status, assigned_at desc);

-- A stock total can never be set below what is currently issued.
create or replace function public.stock_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_assigned integer;
begin
  select coalesce(sum(quantity), 0) into v_assigned
    from public.equipment_assignments where item_id = new.item_id and status = 'assigned';
  if new.total_quantity < v_assigned then
    raise exception 'Total stock cannot be lower than the % unit(s) currently assigned to users', v_assigned
      using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_stock_guard on public.equipment_stock;
create trigger trg_stock_guard before insert or update on public.equipment_stock
  for each row execute function public.stock_guard();

-- ---------------------------------------------------------------------
-- RPC: assign_equipment  (locks the item row, so two admins cannot over-issue)
-- ---------------------------------------------------------------------
create or replace function public.assign_equipment(
  p_user      uuid,
  p_item      uuid,
  p_qty       integer,
  p_serial    text default null,
  p_asset_tag text default null,
  p_ticket_no text default null,
  p_notes     text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  u        public.office_users;
  v_item   public.equipment_items;
  v_cat    text;
  v_total  integer;
  v_used   integer;
  v_actor  text;
  v_id     uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantity must be at least 1';
  end if;

  select * into u from public.office_users where id = p_user;
  if not found then raise exception 'User not found'; end if;
  if not u.is_active then raise exception 'This user is inactive. Activate the user first.'; end if;

  select * into v_item from public.equipment_items where id = p_item for update;
  if not found then raise exception 'Equipment item not found'; end if;
  select name into v_cat from public.equipment_categories where id = v_item.category_id;

  -- first time this item is issued: create its stock row (checked first, because BEFORE INSERT triggers
  -- would otherwise fire even when ON CONFLICT DO NOTHING skips the row)
  if not exists (select 1 from public.equipment_stock where item_id = p_item) then
    insert into public.equipment_stock (item_id, total_quantity) values (p_item, 0);
  end if;
  select total_quantity into v_total from public.equipment_stock where item_id = p_item;
  select coalesce(sum(quantity), 0) into v_used
    from public.equipment_assignments where item_id = p_item and status = 'assigned';

  if p_qty > v_total - v_used then
    raise exception 'Only % unit(s) of "%" are available in stock', greatest(v_total - v_used, 0), v_item.name;
  end if;

  select coalesce(nullif(btrim(full_name), ''), email) into v_actor from public.profiles where id = auth.uid();

  insert into public.equipment_assignments
    (user_id, item_id, item_name, category_name, quantity, serial_no, asset_tag, ticket_no, notes, assigned_by, assigned_by_name)
  values
    (p_user, p_item, v_item.name, v_cat, p_qty,
     nullif(btrim(p_serial), ''), nullif(btrim(p_asset_tag), ''), nullif(btrim(p_ticket_no), ''), nullif(btrim(p_notes), ''),
     auth.uid(), v_actor)
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- RPC: return_equipment  (full or partial return; stock is freed automatically)
-- ---------------------------------------------------------------------
create or replace function public.return_equipment(
  p_assignment uuid,
  p_qty        integer default null,
  p_notes      text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  a       public.equipment_assignments;
  q       integer;
  v_actor text;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into a from public.equipment_assignments where id = p_assignment for update;
  if not found then raise exception 'Assignment not found'; end if;
  if a.status <> 'assigned' then raise exception 'This item was already returned'; end if;

  q := coalesce(p_qty, a.quantity);
  if q < 1 or q > a.quantity then
    raise exception 'Return quantity must be between 1 and %', a.quantity;
  end if;

  select coalesce(nullif(btrim(full_name), ''), email) into v_actor from public.profiles where id = auth.uid();

  if q = a.quantity then
    update public.equipment_assignments
       set status = 'returned', returned_at = now(), return_notes = nullif(btrim(p_notes), ''), returned_by_name = v_actor
     where id = a.id;
  else
    update public.equipment_assignments set quantity = quantity - q where id = a.id;
    insert into public.equipment_assignments
      (user_id, item_id, item_name, category_name, quantity, serial_no, asset_tag, ticket_no, notes,
       status, assigned_at, assigned_by, assigned_by_name, returned_at, return_notes, returned_by_name)
    values
      (a.user_id, a.item_id, a.item_name, a.category_name, q, a.serial_no, a.asset_tag, a.ticket_no, a.notes,
       'returned', a.assigned_at, a.assigned_by, a.assigned_by_name, now(), nullif(btrim(p_notes), ''), v_actor);
  end if;
end $$;

revoke all on function public.assign_equipment(uuid, uuid, integer, text, text, text, text) from public, anon;
revoke all on function public.return_equipment(uuid, integer, text) from public, anon;
grant execute on function public.assign_equipment(uuid, uuid, integer, text, text, text, text) to authenticated;
grant execute on function public.return_equipment(uuid, integer, text) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security: administrators only. Nothing is visible to visitors.
-- ---------------------------------------------------------------------
alter table public.office_users           enable row level security;
alter table public.equipment_stock        enable row level security;
alter table public.equipment_assignments  enable row level security;

drop policy if exists office_users_admin_all on public.office_users;
create policy office_users_admin_all on public.office_users for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists stock_admin_all on public.equipment_stock;
create policy stock_admin_all on public.equipment_stock for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- assignments are READ-ONLY for clients; changes go through the two RPCs above
drop policy if exists assignments_admin_select on public.equipment_assignments;
create policy assignments_admin_select on public.equipment_assignments for select to authenticated
  using (public.is_admin());

revoke all on public.office_users, public.equipment_stock, public.equipment_assignments from anon;
revoke insert, update, delete on public.equipment_assignments from authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['office_users', 'equipment_stock', 'equipment_assignments']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
