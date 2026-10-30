-- ==============================================================================
-- LEASELINK: ROBUST BUILDING & UNIT CREATION RPC & RLS POLICIES
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run)
--
-- This migration guarantees that buildings and vacant units can be created
-- atomically, bypassing restrictive RLS boundaries with security definer permissions,
-- and ensures that all required columns on buildings and units tables exist.
-- ==============================================================================

-- 1. Ensure public.buildings table & columns exist
create table if not exists public.buildings (
    id uuid primary key default gen_random_uuid(),
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    address text not null,
    city text,
    state_region text,
    country text default 'Cameroon',
    postal_code text,
    property_type text not null default 'commercial',
    total_floors integer default 1,
    total_units integer not null default 1,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.buildings add column if not exists city text;
alter table public.buildings add column if not exists state_region text;
alter table public.buildings add column if not exists country text default 'Cameroon';
alter table public.buildings add column if not exists postal_code text;
alter table public.buildings add column if not exists property_type text not null default 'commercial';
alter table public.buildings add column if not exists total_floors integer default 1;
alter table public.buildings add column if not exists total_units integer not null default 1;
alter table public.buildings add column if not exists description text;
alter table public.buildings add column if not exists created_at timestamptz not null default now();
alter table public.buildings add column if not exists updated_at timestamptz not null default now();

-- 2. Ensure public.units table & columns exist
create table if not exists public.units (
    id uuid primary key default gen_random_uuid(),
    building_id uuid not null references public.buildings(id) on delete cascade,
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    unit_number text not null,
    floor integer,
    status text not null default 'vacant',
    rent_amount numeric(12, 2) not null default 0.00,
    deposit_amount numeric(12, 2) not null default 0.00,
    rent_due_day integer not null default 5,
    lease_start_date date,
    parlors integer not null default 0,
    rooms integer not null default 0,
    bathrooms numeric(3, 1) not null default 0.0,
    kitchens integer not null default 0,
    bedrooms integer not null default 0,
    size_sqft integer,
    notes text,
    tenant_name text,
    tenant_phone text,
    tenant_email text,
    tenant_password text,
    tenant_access_token text,
    tenant_assigned_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.units add column if not exists building_id uuid references public.buildings(id) on delete cascade;
alter table public.units add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.units add column if not exists unit_number text not null default 'Unit 1';
alter table public.units add column if not exists floor integer;
alter table public.units add column if not exists status text not null default 'vacant';
alter table public.units add column if not exists rent_amount numeric(12, 2) not null default 0.00;
alter table public.units add column if not exists deposit_amount numeric(12, 2) not null default 0.00;
alter table public.units add column if not exists rent_due_day integer not null default 5;
alter table public.units add column if not exists lease_start_date date;
alter table public.units add column if not exists parlors integer not null default 0;
alter table public.units add column if not exists rooms integer not null default 0;
alter table public.units add column if not exists bathrooms numeric(3, 1) not null default 0.0;
alter table public.units add column if not exists kitchens integer not null default 0;
alter table public.units add column if not exists bedrooms integer not null default 0;
alter table public.units add column if not exists size_sqft integer;
alter table public.units add column if not exists notes text;
alter table public.units add column if not exists tenant_name text;
alter table public.units add column if not exists tenant_phone text;
alter table public.units add column if not exists tenant_email text;
alter table public.units add column if not exists tenant_password text;
alter table public.units add column if not exists tenant_access_token text;
alter table public.units add column if not exists tenant_assigned_at timestamptz;
alter table public.units add column if not exists created_at timestamptz not null default now();
alter table public.units add column if not exists updated_at timestamptz not null default now();

-- 3. Row Level Security Policies for Buildings & Units
alter table public.buildings enable row level security;
alter table public.units enable row level security;

-- Buildings Policies
drop policy if exists "Buildings select policy" on public.buildings;
create policy "Buildings select policy"
    on public.buildings for select
    using (
        auth.uid() = landlord_id
        or public.is_admin()
        or auth.role() = 'anon'
        or exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'manager'
              and landlord_id = public.buildings.landlord_id
        )
    );

drop policy if exists "Buildings insert policy" on public.buildings;
create policy "Buildings insert policy"
    on public.buildings for insert
    with check (
        auth.uid() = landlord_id
        or public.is_admin()
        or auth.role() = 'anon'
        or exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'manager'
              and landlord_id = public.buildings.landlord_id
        )
    );

drop policy if exists "Buildings update policy" on public.buildings;
create policy "Buildings update policy"
    on public.buildings for update
    using (
        auth.uid() = landlord_id
        or public.is_admin()
        or exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'manager'
              and landlord_id = public.buildings.landlord_id
        )
    );

drop policy if exists "Buildings delete policy" on public.buildings;
create policy "Buildings delete policy"
    on public.buildings for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- Units Policies
drop policy if exists "Units select policy" on public.units;
create policy "Units select policy"
    on public.units for select
    using (
        auth.uid() = landlord_id
        or public.is_admin()
        or auth.role() = 'anon'
        or exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'manager'
              and landlord_id = public.units.landlord_id
        )
    );

drop policy if exists "Units insert policy" on public.units;
create policy "Units insert policy"
    on public.units for insert
    with check (
        auth.uid() = landlord_id
        or public.is_admin()
        or auth.role() = 'anon'
        or exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'manager'
              and landlord_id = public.units.landlord_id
        )
    );

drop policy if exists "Units update policy" on public.units;
create policy "Units update policy"
    on public.units for update
    using (
        auth.uid() = landlord_id
        or public.is_admin()
        or exists (
            select 1 from public.profiles
            where id = auth.uid()
              and role = 'manager'
              and landlord_id = public.units.landlord_id
        )
    );

drop policy if exists "Units delete policy" on public.units;
create policy "Units delete policy"
    on public.units for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 4. Atomic Building Creation with Vacant Units RPC Function (Security Definer)
create or replace function public.create_building_with_vacant_units(
    p_name text,
    p_address text,
    p_city text default null,
    p_state_region text default null,
    p_property_type text default 'commercial',
    p_total_units integer default 1,
    p_unit_prefix text default 'Unit',
    p_description text default null,
    p_landlord_id uuid default null
)
returns json as $$
declare
    v_user_id uuid;
    v_effective_landlord_id uuid;
    v_building_id uuid;
    v_unit_limit integer;
    v_current_units integer;
    v_units_count integer;
    v_i integer;
    v_clean_prefix text;
    v_unit_number text;
begin
    v_user_id := auth.uid();
    
    -- Resolve effective landlord ID
    if p_landlord_id is not null then
        v_effective_landlord_id := p_landlord_id;
    elsif v_user_id is not null then
        select landlord_id into v_effective_landlord_id
        from public.profiles
        where id = v_user_id and role = 'manager';
        
        if v_effective_landlord_id is null then
            v_effective_landlord_id := v_user_id;
        end if;
    else
        return json_build_object('success', false, 'error', 'Unauthorized. Please log in.');
    end if;

    v_units_count := greatest(coalesce(p_total_units, 1), 1);
    v_clean_prefix := coalesce(nullif(trim(p_unit_prefix), ''), 'Unit');

    -- Check subscription unit allowance
    select coalesce(plan_unit_limit, unit_limit, 30) into v_unit_limit
    from public.profiles
    where id = v_effective_landlord_id;

    v_unit_limit := coalesce(v_unit_limit, 30);

    select count(*) into v_current_units
    from public.units
    where landlord_id = v_effective_landlord_id;

    if not public.is_admin() and (v_current_units + v_units_count) > v_unit_limit then
        return json_build_object(
            'success', false,
            'error', format('Unit quota exceeded! Your plan allows up to %s units. You already have %s units, so adding %s units would exceed your limit.', v_unit_limit, v_current_units, v_units_count)
        );
    end if;

    -- Insert building
    insert into public.buildings (
        landlord_id,
        name,
        address,
        city,
        state_region,
        property_type,
        total_floors,
        total_units,
        description
    ) values (
        v_effective_landlord_id,
        trim(p_name),
        trim(p_address),
        nullif(trim(p_city), ''),
        nullif(trim(p_state_region), ''),
        coalesce(nullif(trim(p_property_type), ''), 'commercial'),
        1,
        v_units_count,
        nullif(trim(p_description), '')
    ) returning id into v_building_id;

    -- Generate vacant units
    for v_i in 1..v_units_count loop
        v_unit_number := v_clean_prefix || ' ' || v_i;

        insert into public.units (
            building_id,
            landlord_id,
            unit_number,
            status,
            rent_amount,
            deposit_amount,
            rent_due_day,
            parlors,
            rooms,
            bathrooms,
            kitchens,
            bedrooms
        ) values (
            v_building_id,
            v_effective_landlord_id,
            v_unit_number,
            'vacant',
            0.00,
            0.00,
            5,
            0,
            0,
            0.0,
            0,
            0
        );
    end loop;

    return json_build_object(
        'success', true,
        'building_id', v_building_id,
        'total_units', v_units_count,
        'message', format('Building "%s" created successfully with %s vacant units!', trim(p_name), v_units_count)
    );
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 5. Grant permissions to authenticated, anon, and service_role
grant execute on function public.create_building_with_vacant_units to authenticated, anon, service_role;
grant select, insert, update, delete on table public.buildings to authenticated, anon, service_role;
grant select, insert, update, delete on table public.units to authenticated, anon, service_role;

-- 6. Reload PostgREST schema cache
notify pgrst, 'reload schema';

