-- ==============================================================================
-- LEASELINK DATABASE SCHEMA & SUPABASE REALTIME CONFIGURATION
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- 1. Create Profiles Table (Landlords)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    phone text not null,
    email text not null,
    role text not null default 'landlord' check (role in ('landlord')),
    plan text not null check (plan in ('free', 'tier_1_30', 'tier_31_60', 'tier_61_100')),
    plan_name text not null,
    plan_unit_limit integer not null default 5,
    plan_duration_days integer not null default 30,
    plan_starts_at timestamptz not null default now(),
    plan_expires_at timestamptz not null default (now() + interval '30 days'),
    plan_status text not null default 'active' check (plan_status in ('active', 'expired', 'renewed')),
    has_used_free_trial boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Landlords can view their own profile" on public.profiles;
drop policy if exists "Landlords can update their own profile" on public.profiles;
drop policy if exists "Landlords can insert their own profile" on public.profiles;

-- Create RLS Policies
create policy "Landlords can view their own profile"
    on public.profiles for select
    using (auth.uid() = id);

create policy "Landlords can update their own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

create policy "Landlords can insert their own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

-- 3. Trigger for updating 'updated_at' column
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.update_updated_at_column();

-- 4. Auth Trigger: Automatically create landlord profile upon auth.users signup
create or replace function public.handle_new_landlord()
returns trigger as $$
declare
    v_full_name text;
    v_phone text;
    v_plan text;
    v_plan_name text;
    v_unit_limit integer;
    v_has_trial boolean;
begin
    -- Extract mandatory metadata passed from client signup
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
    v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
    v_plan := coalesce(new.raw_user_meta_data->>'plan', 'free');

    -- Validate plan and set unit limits
    if v_plan = 'free' then
        v_plan_name := 'Free Trial (30 Days)';
        v_unit_limit := 5;
        v_has_trial := true;
    elsif v_plan = 'tier_1_30' then
        v_plan_name := 'Starter (1 to 30 Units)';
        v_unit_limit := 30;
        v_has_trial := false;
    elsif v_plan = 'tier_31_60' then
        v_plan_name := 'Growth (31 to 60 Units)';
        v_unit_limit := 60;
        v_has_trial := false;
    elsif v_plan = 'tier_61_100' then
        v_plan_name := 'Pro (61 to 100 Units)';
        v_unit_limit := 100;
        v_has_trial := false;
    else
        v_plan := 'free';
        v_plan_name := 'Free Trial (30 Days)';
        v_unit_limit := 5;
        v_has_trial := true;
    end if;

    insert into public.profiles (
        id,
        full_name,
        phone,
        email,
        role,
        plan,
        plan_name,
        plan_unit_limit,
        plan_duration_days,
        plan_starts_at,
        plan_expires_at,
        plan_status,
        has_used_free_trial
    ) values (
        new.id,
        v_full_name,
        v_phone,
        new.email,
        'landlord',
        v_plan,
        v_plan_name,
        v_unit_limit,
        30,
        now(),
        now() + interval '30 days',
        'active',
        v_has_trial
    );

    return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_landlord();

-- 5. Helper Function: Plan Renewal (extend expiration date by 30 days)
create or replace function public.renew_subscription(p_plan text)
returns json as $$
declare
    v_user_id uuid;
    v_plan_name text;
    v_unit_limit integer;
    v_has_used_trial boolean;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return json_build_object('success', false, 'error', 'Unauthorized');
    end if;

    select has_used_free_trial into v_has_used_trial
    from public.profiles
    where id = v_user_id;

    -- Block free plan if already used previously
    if p_plan = 'free' and v_has_used_trial then
        return json_build_object('success', false, 'error', 'Free trial has already been used and cannot be selected again.');
    end if;

    if p_plan = 'free' then
        v_plan_name := 'Free Trial (30 Days)';
        v_unit_limit := 5;
    elsif p_plan = 'tier_1_30' then
        v_plan_name := 'Starter (1 to 30 Units)';
        v_unit_limit := 30;
    elsif p_plan = 'tier_31_60' then
        v_plan_name := 'Growth (31 to 60 Units)';
        v_unit_limit := 60;
    elsif p_plan = 'tier_61_100' then
        v_plan_name := 'Pro (61 to 100 Units)';
        v_unit_limit := 100;
    else
        return json_build_object('success', false, 'error', 'Invalid plan type');
    end if;

    update public.profiles
    set
        plan = p_plan,
        plan_name = v_plan_name,
        plan_unit_limit = v_unit_limit,
        plan_starts_at = now(),
        plan_expires_at = now() + interval '30 days',
        plan_status = 'active',
        has_used_free_trial = case when p_plan = 'free' then true else v_has_used_trial end,
        updated_at = now()
    where id = v_user_id;

    return json_build_object('success', true, 'message', 'Subscription renewed successfully for 30 days');
end;
$$ language plpgsql security definer;

-- 6. Enable Realtime Replication
-- Set full replica identity so real-time clients receive all column updates
alter table public.profiles replica identity full;

-- Add profiles to Supabase Realtime publication
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and tablename = 'profiles'
    ) then
        alter publication supabase_realtime add table public.profiles;
    end if;
end;
$$;

-- ==============================================================================
-- 7. Create Buildings Table (Owned by Landlords)
-- ==============================================================================
create table if not exists public.buildings (
    id uuid primary key default gen_random_uuid(),
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    address text not null,
    city text,
    state_region text,
    country text default 'Cameroon',
    postal_code text,
    property_type text not null default 'apartment' check (property_type in ('apartment', 'residential', 'commercial', 'mixed_use', 'duplex', 'other')),
    total_floors integer not null default 1 check (total_floors >= 1),
    total_units integer not null default 1 check (total_units >= 1),
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Enable Row Level Security (RLS) on Buildings
alter table public.buildings enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Landlords can view their own buildings" on public.buildings;
drop policy if exists "Landlords can insert their own buildings" on public.buildings;
drop policy if exists "Landlords can update their own buildings" on public.buildings;
drop policy if exists "Landlords can delete their own buildings" on public.buildings;

-- Create RLS Policies for Buildings
create policy "Landlords can view their own buildings"
    on public.buildings for select
    using (auth.uid() = landlord_id);

create policy "Landlords can insert their own buildings"
    on public.buildings for insert
    with check (auth.uid() = landlord_id);

create policy "Landlords can update their own buildings"
    on public.buildings for update
    using (auth.uid() = landlord_id)
    with check (auth.uid() = landlord_id);

create policy "Landlords can delete their own buildings"
    on public.buildings for delete
    using (auth.uid() = landlord_id);

-- Trigger for buildings updated_at
drop trigger if exists set_buildings_updated_at on public.buildings;
create trigger set_buildings_updated_at
    before update on public.buildings
    for each row
    execute function public.update_updated_at_column();

-- ==============================================================================
-- 8. Create Units Table (All Vacant by Default)
-- ==============================================================================
-- ==============================================================================
-- 8. Create Units Table (All Vacant by Default, Customizable by Landlord)
-- ==============================================================================
create table if not exists public.units (
    id uuid primary key default gen_random_uuid(),
    building_id uuid not null references public.buildings(id) on delete cascade,
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    unit_number text not null,
    floor integer,
    status text not null default 'vacant' check (status in ('vacant', 'occupied', 'maintenance')),
    rent_amount numeric(12, 2) not null default 0.00,
    deposit_amount numeric(12, 2) not null default 0.00,
    parlors integer not null default 0 check (parlors >= 0),
    rooms integer not null default 0 check (rooms >= 0),
    bathrooms numeric(3, 1) not null default 0.0 check (bathrooms >= 0),
    kitchens integer not null default 0 check (kitchens >= 0),
    bedrooms integer not null default 0 check (bedrooms >= 0),
    size_sqft integer,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(building_id, unit_number)
);

-- Migration safety for existing installations
alter table public.units add column if not exists parlors integer not null default 0;
alter table public.units add column if not exists rooms integer not null default 0;
alter table public.units add column if not exists bathrooms numeric(3, 1) not null default 0.0;
alter table public.units add column if not exists kitchens integer not null default 0;
alter table public.units alter column floor drop not null;
alter table public.buildings alter column total_floors drop not null;

-- Enable Row Level Security (RLS) on Units
alter table public.units enable row level security;

-- Drop existing policies if re-running
drop policy if exists "Landlords can view their own units" on public.units;
drop policy if exists "Landlords can insert their own units" on public.units;
drop policy if exists "Landlords can update their own units" on public.units;
drop policy if exists "Landlords can delete their own units" on public.units;

-- Create RLS Policies for Units
create policy "Landlords can view their own units"
    on public.units for select
    using (auth.uid() = landlord_id);

create policy "Landlords can insert their own units"
    on public.units for insert
    with check (auth.uid() = landlord_id);

create policy "Landlords can update their own units"
    on public.units for update
    using (auth.uid() = landlord_id)
    with check (auth.uid() = landlord_id);

create policy "Landlords can delete their own units"
    on public.units for delete
    using (auth.uid() = landlord_id);

-- Trigger for units updated_at
drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at
    before update on public.units
    for each row
    execute function public.update_updated_at_column();

-- ==============================================================================
-- 9. Database Indexes for Performance
-- ==============================================================================
create index if not exists idx_buildings_landlord_id on public.buildings(landlord_id);
create index if not exists idx_units_building_id on public.units(building_id);
create index if not exists idx_units_landlord_id on public.units(landlord_id);
create index if not exists idx_units_status on public.units(status);

-- ==============================================================================
-- 10. Enable Realtime Replication for Buildings & Units
-- ==============================================================================
alter table public.buildings replica identity full;
alter table public.units replica identity full;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and tablename = 'buildings'
    ) then
        alter publication supabase_realtime add table public.buildings;
    end if;

    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' and tablename = 'units'
    ) then
        alter publication supabase_realtime add table public.units;
    end if;
end;
$$;

-- ==============================================================================
-- 11. Stored Function: Atomic Building Creation with Automatic Vacant Units
-- (Floor removed, units created vacant with 0 specs ready for landlord customization)
-- ==============================================================================
create or replace function public.create_building_with_vacant_units(
    p_name text,
    p_address text,
    p_city text default null,
    p_state_region text default null,
    p_property_type text default 'apartment',
    p_total_units integer default 1,
    p_unit_prefix text default 'Unit',
    p_description text default null
)
returns json as $$
declare
    v_user_id uuid;
    v_building_id uuid;
    v_unit_limit integer;
    v_current_units integer;
    v_units_count integer;
    v_i integer;
    v_clean_prefix text;
    v_unit_number text;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return json_build_object('success', false, 'error', 'Unauthorized. Please log in.');
    end if;

    v_units_count := greatest(coalesce(p_total_units, 1), 1);
    v_clean_prefix := coalesce(nullif(trim(p_unit_prefix), ''), 'Unit');

    -- Check landlord plan unit quota
    select plan_unit_limit into v_unit_limit
    from public.profiles
    where id = v_user_id;

    if v_unit_limit is not null then
        select coalesce(count(*), 0) into v_current_units
        from public.units
        where landlord_id = v_user_id;

        if (v_current_units + v_units_count) > v_unit_limit then
            return json_build_object(
                'success', false,
                'error', format('Unit limit exceeded! Your current plan allows up to %s units. You already have %s units created. Creating %s additional units requires an upgrade.', v_unit_limit, v_current_units, v_units_count)
            );
        end if;
    end if;

    -- 1. Insert Building record
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
        v_user_id,
        trim(p_name),
        trim(p_address),
        nullif(trim(p_city), ''),
        nullif(trim(p_state_region), ''),
        coalesce(p_property_type, 'apartment'),
        1,
        v_units_count,
        nullif(trim(p_description), '')
    ) returning id into v_building_id;

    -- 2. Bulk generate all units with status = 'vacant'
    -- Note: Rent, parlors, rooms, bathrooms, and kitchens are NOT generated by default (set to 0 / unconfigured)
    for v_i in 1..v_units_count loop
        v_unit_number := v_clean_prefix || ' ' || v_i;

        insert into public.units (
            building_id,
            landlord_id,
            unit_number,
            status,
            rent_amount,
            deposit_amount,
            parlors,
            rooms,
            bathrooms,
            kitchens,
            bedrooms
        ) values (
            v_building_id,
            v_user_id,
            v_unit_number,
            'vacant',
            0.00,
            0.00,
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
        'message', format('Building "%s" created successfully with %s vacant units ready for configuration!', trim(p_name), v_units_count)
    );
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- 12. Helper Function: Update Unit Details (Rent, Parlors, Rooms, Bathrooms, Kitchens)
-- ==============================================================================
create or replace function public.update_unit_configuration(
    p_unit_id uuid,
    p_unit_number text default null,
    p_rent_amount numeric default null,
    p_parlors integer default null,
    p_rooms integer default null,
    p_bathrooms numeric default null,
    p_kitchens integer default null,
    p_notes text default null
)
returns json as $$
declare
    v_user_id uuid;
    v_unit public.units%rowtype;
begin
    v_user_id := auth.uid();
    if v_user_id is null then
        return json_build_object('success', false, 'error', 'Unauthorized');
    end if;

    select * into v_unit
    from public.units
    where id = p_unit_id and landlord_id = v_user_id;

    if not found then
        return json_build_object('success', false, 'error', 'Unit not found or access denied');
    end if;

    update public.units
    set
        unit_number = coalesce(nullif(trim(p_unit_number), ''), v_unit.unit_number),
        rent_amount = coalesce(p_rent_amount, v_unit.rent_amount),
        parlors = coalesce(p_parlors, v_unit.parlors),
        rooms = coalesce(p_rooms, v_unit.rooms),
        bedrooms = coalesce(p_rooms, v_unit.rooms),
        bathrooms = coalesce(p_bathrooms, v_unit.bathrooms),
        kitchens = coalesce(p_kitchens, v_unit.kitchens),
        notes = coalesce(p_notes, v_unit.notes),
        updated_at = now()
    where id = p_unit_id and landlord_id = v_user_id;

    return json_build_object(
        'success', true,
        'message', 'Unit modified successfully'
    );
end;
$$ language plpgsql security definer;


