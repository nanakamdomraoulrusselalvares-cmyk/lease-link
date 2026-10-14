-- ==============================================================================
-- LEASELINK DATABASE SCHEMA & SUPABASE CONFIGURATION
-- ==============================================================================
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- 100% IDEMPOTENT, SAFE & NON-DESTRUCTIVE:
-- - Preserves all existing tables, records, users, and uploaded data.
-- - Can be run repeatedly on empty databases, partial databases, or existing live databases with zero errors.
-- - Safely backfills missing columns, constraints, unique indexes, and triggers.
-- - Fully configured for Landlords, Delegated Managers, Super-Admins, and Tenants.
-- ==============================================================================

-- ==============================================================================
-- 1. Base Extensions & Helper Functions
-- ==============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Helper function: Check if current authenticated user is an administrator
create or replace function public.is_admin()
returns boolean as $$
declare
    v_role text;
begin
    if auth.uid() is null then
        return false;
    end if;
    select role into v_role from public.profiles where id = auth.uid();
    return coalesce(v_role = 'admin', false);
end;
$$ language plpgsql security definer set search_path = public stable;

-- Helper function: Resolve effective landlord id (for manager returns parent landlord id, for landlord returns self)
create or replace function public.get_auth_landlord_id()
returns uuid as $$
declare
    v_landlord_id uuid;
    v_role text;
begin
    if auth.uid() is null then
        return null;
    end if;
    select landlord_id, role into v_landlord_id, v_role from public.profiles where id = auth.uid();
    if v_role = 'manager' and v_landlord_id is not null then
        return v_landlord_id;
    end if;
    return auth.uid();
end;
$$ language plpgsql security definer set search_path = public stable;

-- Helper function: Check if authenticated user can view/manage a specific landlord's portfolio
create or replace function public.can_access_landlord_portfolio(p_landlord_id uuid)
returns boolean as $$
begin
    if auth.uid() is null or p_landlord_id is null then
        return false;
    end if;
    if auth.uid() = p_landlord_id then
        return true;
    end if;
    if public.is_admin() then
        return true;
    end if;
    return exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role = 'manager'
          and landlord_id = p_landlord_id
    );
end;
$$ language plpgsql security definer set search_path = public stable;

-- ==============================================================================
-- 2. Core Tables Definition (Created if not existing)
-- ==============================================================================

-- 2.1 Profiles Table (Landlords, Managers, Admins)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null default '',
    phone text not null default '',
    email text not null default '',
    role text not null default 'landlord',
    landlord_id uuid references public.profiles(id) on delete cascade,
    assigned_building_ids uuid[] default null,
    plan text not null default 'free',
    plan_name text not null default 'Free Trial (30 Days)',
    plan_unit_limit integer not null default 5,
    plan_duration_days integer not null default 30,
    plan_starts_at timestamptz not null default now(),
    plan_expires_at timestamptz not null default (now() + interval '30 days'),
    plan_status text not null default 'active',
    has_used_free_trial boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2.2 Buildings Table (Properties)
create table if not exists public.buildings (
    id uuid primary key default gen_random_uuid(),
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    address text not null,
    city text,
    state_region text,
    country text default 'Cameroon',
    postal_code text,
    property_type text not null default 'apartment',
    total_floors integer default 1,
    total_units integer not null default 1,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2.3 Units Table (Apartments / Rooms / Flats)
create table if not exists public.units (
    id uuid primary key default gen_random_uuid(),
    building_id uuid not null references public.buildings(id) on delete cascade,
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    unit_number text not null,
    floor integer,
    status text not null default 'vacant',
    rent_amount numeric(12, 2) not null default 0.00,
    deposit_amount numeric(12, 2) not null default 0.00,
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

-- 2.4 Maintenance Requests Table
create table if not exists public.maintenance_requests (
    id uuid primary key default gen_random_uuid(),
    unit_id uuid not null references public.units(id) on delete cascade,
    building_id uuid not null references public.buildings(id) on delete cascade,
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    tenant_name text not null,
    tenant_phone text not null,
    tenant_email text,
    unit_number text not null,
    building_name text not null,
    category text not null default 'other',
    urgency text not null default 'medium',
    title text not null,
    description text not null,
    status text not null default 'pending',
    photo_url text,
    video_url text,
    voice_url text,
    voice_duration_seconds integer,
    landlord_notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2.5 Rent Payments Table
create table if not exists public.rent_payments (
    id uuid primary key default gen_random_uuid(),
    receipt_number text not null,
    unit_id uuid not null references public.units(id) on delete cascade,
    building_id uuid not null references public.buildings(id) on delete cascade,
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    landlord_name text,
    tenant_name text not null,
    tenant_phone text not null,
    tenant_email text,
    unit_number text not null,
    building_name text not null,
    rent_month text not null,
    months_count integer not null default 1,
    months_covered text[] default '{}',
    monthly_rent_amount numeric(12, 2) not null default 0.00,
    amount_paid numeric(12, 2) not null default 0.00,
    balance_remaining numeric(12, 2) not null default 0.00,
    payment_type text not null default 'full',
    payment_method text not null default 'momo',
    transaction_ref text not null,
    status text not null default 'completed',
    payer_phone text,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2.6 Notifications Table
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    type text not null default 'system',
    title text not null,
    title_fr text,
    message text not null,
    message_fr text,
    recipient_role text not null default 'landlord',
    landlord_id uuid references public.profiles(id) on delete cascade,
    building_id uuid references public.buildings(id) on delete cascade,
    building_name text,
    unit_id uuid references public.units(id) on delete cascade,
    unit_number text,
    tenant_name text,
    amount numeric(12, 2),
    payment_method text,
    receipt_number text,
    rent_month text,
    is_read boolean not null default false,
    read_by text[] default '{}',
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ==============================================================================
-- 3. Non-Destructive Migrations & Safe Column Backfills
-- (Guarantees any existing table has all latest columns and constraints without data loss)
-- ==============================================================================

-- 3.1 Profiles columns & constraints
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists role text not null default 'landlord';
alter table public.profiles add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.profiles add column if not exists assigned_building_ids uuid[] default null;
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists plan_name text not null default 'Free Trial (30 Days)';
alter table public.profiles add column if not exists plan_unit_limit integer not null default 5;
alter table public.profiles add column if not exists plan_duration_days integer not null default 30;
alter table public.profiles add column if not exists plan_starts_at timestamptz not null default now();
alter table public.profiles add column if not exists plan_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists plan_status text not null default 'active';
alter table public.profiles add column if not exists has_used_free_trial boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
    -- Safe backfills for null profile columns
    update public.profiles set role = 'landlord' where role is null or role not in ('landlord', 'manager', 'admin');
    update public.profiles set plan = 'free' where plan is null or plan not in ('free', 'tier_1_30', 'tier_31_60', 'tier_61_100');
    update public.profiles set plan_status = 'active' where plan_status is null or plan_status not in ('active', 'expired', 'renewed');
    update public.profiles set plan_unit_limit = 5 where plan_unit_limit is null or plan_unit_limit < 1;
    update public.profiles set plan_duration_days = 30 where plan_duration_days is null;

    -- Profiles check constraints
    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles add constraint profiles_role_check check (role in ('landlord', 'manager', 'admin'));

    alter table public.profiles drop constraint if exists profiles_plan_check;
    alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'tier_1_30', 'tier_31_60', 'tier_61_100'));

    alter table public.profiles drop constraint if exists profiles_plan_status_check;
    alter table public.profiles add constraint profiles_plan_status_check check (plan_status in ('active', 'expired', 'renewed'));

    -- Strict Single-Use Email Uniqueness (A person can only register once with an email)
    -- Safe idempotent handling: create unique index on lower(trim(email))
    if not exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'profiles' and indexname = 'profiles_email_lower_idx'
    ) then
        create unique index profiles_email_lower_idx on public.profiles (lower(trim(email)))
        where email is not null and trim(email) != '';
    end if;
exception
    when others then
        raise notice 'Profiles migration notice: %', sqlerrm;
end;
$$;

-- 3.2 Buildings columns & constraints
alter table public.buildings alter column total_floors drop not null;
alter table public.buildings add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.buildings add column if not exists name text not null default 'Building';
alter table public.buildings add column if not exists address text not null default '';
alter table public.buildings add column if not exists city text;
alter table public.buildings add column if not exists state_region text;
alter table public.buildings add column if not exists country text default 'Cameroon';
alter table public.buildings add column if not exists postal_code text;
alter table public.buildings add column if not exists property_type text not null default 'apartment';
alter table public.buildings add column if not exists total_floors integer default 1;
alter table public.buildings add column if not exists total_units integer not null default 1;
alter table public.buildings add column if not exists description text;
alter table public.buildings add column if not exists created_at timestamptz not null default now();
alter table public.buildings add column if not exists updated_at timestamptz not null default now();

do $$
begin
    update public.buildings set property_type = 'apartment' where property_type is null;
    update public.buildings set total_units = 1 where total_units is null or total_units < 1;

    alter table public.buildings drop constraint if exists buildings_property_type_check;
    alter table public.buildings add constraint buildings_property_type_check check (property_type in ('apartment', 'residential', 'commercial', 'mixed_use', 'duplex', 'other'));

    alter table public.buildings drop constraint if exists buildings_total_units_check;
    alter table public.buildings add constraint buildings_total_units_check check (total_units >= 1);
exception
    when others then
        raise notice 'Buildings migration notice: %', sqlerrm;
end;
$$;

-- 3.3 Units columns & constraints
alter table public.units alter column floor drop not null;
alter table public.units add column if not exists building_id uuid references public.buildings(id) on delete cascade;
alter table public.units add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.units add column if not exists unit_number text not null default 'Unit 1';
alter table public.units add column if not exists floor integer;
alter table public.units add column if not exists status text not null default 'vacant';
alter table public.units add column if not exists rent_amount numeric(12, 2) not null default 0.00;
alter table public.units add column if not exists deposit_amount numeric(12, 2) not null default 0.00;
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

do $$
begin
    update public.units set status = 'vacant' where status is null or status not in ('vacant', 'occupied', 'maintenance');
    update public.units set rent_amount = 0.00 where rent_amount is null;
    update public.units set deposit_amount = 0.00 where deposit_amount is null;
    update public.units set parlors = 0 where parlors is null or parlors < 0;
    update public.units set rooms = 0 where rooms is null or rooms < 0;
    update public.units set bathrooms = 0.0 where bathrooms is null or bathrooms < 0;
    update public.units set kitchens = 0 where kitchens is null or kitchens < 0;
    update public.units set bedrooms = coalesce(rooms, 0) where bedrooms is null or bedrooms < 0;

    alter table public.units drop constraint if exists units_status_check;
    alter table public.units add constraint units_status_check check (status in ('vacant', 'occupied', 'maintenance'));

    if not exists (
        select 1 from pg_constraint where conname in ('units_building_id_unit_number_key', 'units_building_id_unit_number_idx')
    ) and not exists (
        select 1 from pg_indexes where schemaname = 'public' and tablename = 'units' and indexname = 'units_building_unit_idx'
    ) then
        create unique index units_building_unit_idx on public.units (building_id, unit_number);
    end if;
exception
    when others then
        raise notice 'Units migration notice: %', sqlerrm;
end;
$$;

-- 3.4 Maintenance Requests columns & constraints
alter table public.maintenance_requests add column if not exists unit_id uuid references public.units(id) on delete cascade;
alter table public.maintenance_requests add column if not exists building_id uuid references public.buildings(id) on delete cascade;
alter table public.maintenance_requests add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.maintenance_requests add column if not exists tenant_name text not null default '';
alter table public.maintenance_requests add column if not exists tenant_phone text not null default '';
alter table public.maintenance_requests add column if not exists tenant_email text;
alter table public.maintenance_requests add column if not exists unit_number text not null default '';
alter table public.maintenance_requests add column if not exists building_name text not null default '';
alter table public.maintenance_requests add column if not exists category text not null default 'other';
alter table public.maintenance_requests add column if not exists urgency text not null default 'medium';
alter table public.maintenance_requests add column if not exists title text not null default 'Maintenance Request';
alter table public.maintenance_requests add column if not exists description text not null default '';
alter table public.maintenance_requests add column if not exists status text not null default 'pending';
alter table public.maintenance_requests add column if not exists photo_url text;
alter table public.maintenance_requests add column if not exists video_url text;
alter table public.maintenance_requests add column if not exists voice_url text;
alter table public.maintenance_requests add column if not exists voice_duration_seconds integer;
alter table public.maintenance_requests add column if not exists landlord_notes text;
alter table public.maintenance_requests add column if not exists created_at timestamptz not null default now();
alter table public.maintenance_requests add column if not exists updated_at timestamptz not null default now();

do $$
begin
    update public.maintenance_requests set category = 'other' where category is null or category not in ('plumbing', 'electrical', 'structural', 'appliances', 'carpentry_locks', 'other');
    update public.maintenance_requests set urgency = 'medium' where urgency is null or urgency not in ('low', 'medium', 'high', 'emergency');
    update public.maintenance_requests set status = 'pending' where status is null or status not in ('pending', 'in_progress', 'resolved', 'rejected');

    alter table public.maintenance_requests drop constraint if exists maintenance_requests_category_check;
    alter table public.maintenance_requests add constraint maintenance_requests_category_check check (category in ('plumbing', 'electrical', 'structural', 'appliances', 'carpentry_locks', 'other'));

    alter table public.maintenance_requests drop constraint if exists maintenance_requests_urgency_check;
    alter table public.maintenance_requests add constraint maintenance_requests_urgency_check check (urgency in ('low', 'medium', 'high', 'emergency'));

    alter table public.maintenance_requests drop constraint if exists maintenance_requests_status_check;
    alter table public.maintenance_requests add constraint maintenance_requests_status_check check (status in ('pending', 'in_progress', 'resolved', 'rejected'));
exception
    when others then
        raise notice 'Maintenance requests migration notice: %', sqlerrm;
end;
$$;

-- 3.5 Rent Payments columns & constraints
alter table public.rent_payments add column if not exists receipt_number text;
alter table public.rent_payments add column if not exists unit_id uuid references public.units(id) on delete cascade;
alter table public.rent_payments add column if not exists building_id uuid references public.buildings(id) on delete cascade;
alter table public.rent_payments add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.rent_payments add column if not exists landlord_name text;
alter table public.rent_payments add column if not exists tenant_name text not null default '';
alter table public.rent_payments add column if not exists tenant_phone text not null default '';
alter table public.rent_payments add column if not exists tenant_email text;
alter table public.rent_payments add column if not exists unit_number text not null default '';
alter table public.rent_payments add column if not exists building_name text not null default '';
alter table public.rent_payments add column if not exists rent_month text not null default '';
alter table public.rent_payments add column if not exists months_count integer not null default 1;
alter table public.rent_payments add column if not exists months_covered text[] default '{}';
alter table public.rent_payments add column if not exists monthly_rent_amount numeric(12, 2) not null default 0.00;
alter table public.rent_payments add column if not exists amount_paid numeric(12, 2) not null default 0.00;
alter table public.rent_payments add column if not exists balance_remaining numeric(12, 2) not null default 0.00;
alter table public.rent_payments add column if not exists payment_type text not null default 'full';
alter table public.rent_payments add column if not exists payment_method text not null default 'momo';
alter table public.rent_payments add column if not exists transaction_ref text not null default '';
alter table public.rent_payments add column if not exists status text not null default 'completed';
alter table public.rent_payments add column if not exists payer_phone text;
alter table public.rent_payments add column if not exists notes text;
alter table public.rent_payments add column if not exists created_at timestamptz not null default now();
alter table public.rent_payments add column if not exists updated_at timestamptz not null default now();

do $$
begin
    update public.rent_payments set receipt_number = 'RCP-' || substring(id::text, 1, 8) where receipt_number is null;
    update public.rent_payments set payment_type = 'full' where payment_type is null or payment_type not in ('full', 'partial');
    update public.rent_payments set payment_method = 'momo' where payment_method is null or payment_method not in ('momo', 'orange_money', 'card', 'bank_transfer', 'cash');
    update public.rent_payments set status = 'completed' where status is null or status not in ('completed', 'pending', 'failed');

    alter table public.rent_payments drop constraint if exists rent_payments_payment_type_check;
    alter table public.rent_payments add constraint rent_payments_payment_type_check check (payment_type in ('full', 'partial'));

    alter table public.rent_payments drop constraint if exists rent_payments_payment_method_check;
    alter table public.rent_payments add constraint rent_payments_payment_method_check check (payment_method in ('momo', 'orange_money', 'card', 'bank_transfer', 'cash'));

    alter table public.rent_payments drop constraint if exists rent_payments_status_check;
    alter table public.rent_payments add constraint rent_payments_status_check check (status in ('completed', 'pending', 'failed'));

    if not exists (
        select 1 from pg_indexes where schemaname = 'public' and tablename = 'rent_payments' and indexname = 'idx_rent_payments_receipt_number'
    ) then
        create unique index idx_rent_payments_receipt_number on public.rent_payments(receipt_number);
    end if;
exception
    when others then
        raise notice 'Rent payments migration notice: %', sqlerrm;
end;
$$;

-- 3.6 Notifications columns & constraints
alter table public.notifications add column if not exists type text not null default 'system';
alter table public.notifications add column if not exists title text not null default '';
alter table public.notifications add column if not exists title_fr text;
alter table public.notifications add column if not exists message text not null default '';
alter table public.notifications add column if not exists message_fr text;
alter table public.notifications add column if not exists recipient_role text not null default 'landlord';
alter table public.notifications add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.notifications add column if not exists building_id uuid references public.buildings(id) on delete cascade;
alter table public.notifications add column if not exists building_name text;
alter table public.notifications add column if not exists unit_id uuid references public.units(id) on delete cascade;
alter table public.notifications add column if not exists unit_number text;
alter table public.notifications add column if not exists tenant_name text;
alter table public.notifications add column if not exists amount numeric(12, 2);
alter table public.notifications add column if not exists payment_method text;
alter table public.notifications add column if not exists receipt_number text;
alter table public.notifications add column if not exists rent_month text;
alter table public.notifications add column if not exists is_read boolean not null default false;
alter table public.notifications add column if not exists read_by text[] default '{}';
alter table public.notifications add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.notifications add column if not exists created_at timestamptz not null default now();
alter table public.notifications add column if not exists updated_at timestamptz not null default now();

do $$
begin
    update public.notifications set recipient_role = 'landlord' where recipient_role is null or recipient_role not in ('landlord', 'manager', 'management', 'tenant', 'building_community', 'admin');
    update public.notifications set type = 'system' where type is null or type not in ('payment_received', 'tenant_arrived', 'tenant_departed', 'landlord_registered', 'maintenance_update', 'system');

    alter table public.notifications drop constraint if exists notifications_recipient_role_check;
    alter table public.notifications add constraint notifications_recipient_role_check check (recipient_role in ('landlord', 'manager', 'management', 'tenant', 'building_community', 'admin'));

    alter table public.notifications drop constraint if exists notifications_type_check;
    alter table public.notifications add constraint notifications_type_check check (type in ('payment_received', 'tenant_arrived', 'tenant_departed', 'landlord_registered', 'maintenance_update', 'system'));
exception
    when others then
        raise notice 'Notifications migration notice: %', sqlerrm;
end;
$$;

-- ==============================================================================
-- 4. Database Performance Indexes
-- ==============================================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_landlord_id on public.profiles(landlord_id);

create index if not exists idx_buildings_landlord_id on public.buildings(landlord_id);

create index if not exists idx_units_building_id on public.units(building_id);
create index if not exists idx_units_landlord_id on public.units(landlord_id);
create index if not exists idx_units_status on public.units(status);
create index if not exists idx_units_tenant_access_token on public.units(tenant_access_token);
create index if not exists idx_units_tenant_email on public.units(tenant_email);
create index if not exists idx_units_tenant_phone on public.units(tenant_phone);

create index if not exists idx_maintenance_unit_id on public.maintenance_requests(unit_id);
create index if not exists idx_maintenance_building_id on public.maintenance_requests(building_id);
create index if not exists idx_maintenance_landlord_id on public.maintenance_requests(landlord_id);
create index if not exists idx_maintenance_status on public.maintenance_requests(status);
create index if not exists idx_maintenance_created_at on public.maintenance_requests(created_at desc);

create index if not exists idx_rent_payments_unit_id on public.rent_payments(unit_id);
create index if not exists idx_rent_payments_building_id on public.rent_payments(building_id);
create index if not exists idx_rent_payments_landlord_id on public.rent_payments(landlord_id);
create index if not exists idx_rent_payments_rent_month on public.rent_payments(rent_month);
create index if not exists idx_rent_payments_created_at on public.rent_payments(created_at desc);

create index if not exists idx_notifications_landlord_id on public.notifications(landlord_id);
create index if not exists idx_notifications_building_id on public.notifications(building_id);
create index if not exists idx_notifications_recipient_role on public.notifications(recipient_role);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

-- ==============================================================================
-- 5. Timestamp Update Triggers
-- ==============================================================================
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
    before update on public.profiles
    for each row execute function public.update_updated_at_column();

drop trigger if exists set_buildings_updated_at on public.buildings;
create trigger set_buildings_updated_at
    before update on public.buildings
    for each row execute function public.update_updated_at_column();

drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at
    before update on public.units
    for each row execute function public.update_updated_at_column();

drop trigger if exists set_maintenance_updated_at on public.maintenance_requests;
create trigger set_maintenance_updated_at
    before update on public.maintenance_requests
    for each row execute function public.update_updated_at_column();

drop trigger if exists set_rent_payments_updated_at on public.rent_payments;
create trigger set_rent_payments_updated_at
    before update on public.rent_payments
    for each row execute function public.update_updated_at_column();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
    before update on public.notifications
    for each row execute function public.update_updated_at_column();

-- ==============================================================================
-- 6. Engine-Level Multi-Tenant Isolation Triggers
-- ==============================================================================

-- 6.1 Units Isolation (Building must belong to the same landlord)
create or replace function public.enforce_unit_tenant_isolation()
returns trigger as $$
begin
    if new.building_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.buildings b
            where b.id = new.building_id and b.landlord_id = new.landlord_id
        ) then
            raise exception 'Multi-tenant isolation violation: Building does not belong to the specified landlord.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_unit_tenant_isolation on public.units;
create trigger trg_enforce_unit_tenant_isolation
    before insert or update on public.units
    for each row execute function public.enforce_unit_tenant_isolation();

-- 6.2 Maintenance Requests Isolation
create or replace function public.enforce_maintenance_tenant_isolation()
returns trigger as $$
begin
    if new.unit_id is not null and new.building_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.units u
            join public.buildings b on b.id = u.building_id
            where u.id = new.unit_id
              and u.building_id = new.building_id
              and u.landlord_id = new.landlord_id
              and b.landlord_id = new.landlord_id
        ) then
            raise exception 'Multi-tenant isolation violation: Maintenance request property ownership mismatch.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_maintenance_tenant_isolation on public.maintenance_requests;
create trigger trg_enforce_maintenance_tenant_isolation
    before insert or update on public.maintenance_requests
    for each row execute function public.enforce_maintenance_tenant_isolation();

-- 6.3 Rent Payments Isolation
create or replace function public.enforce_payment_tenant_isolation()
returns trigger as $$
begin
    if new.unit_id is not null and new.building_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.units u
            join public.buildings b on b.id = u.building_id
            where u.id = new.unit_id
              and u.building_id = new.building_id
              and u.landlord_id = new.landlord_id
              and b.landlord_id = new.landlord_id
        ) then
            raise exception 'Multi-tenant isolation violation: Rent payment property ownership mismatch.';
        end if;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_payment_tenant_isolation on public.rent_payments;
create trigger trg_enforce_payment_tenant_isolation
    before insert or update on public.rent_payments
    for each row execute function public.enforce_payment_tenant_isolation();

-- 6.4 Notifications Isolation
create or replace function public.enforce_notification_tenant_isolation()
returns trigger as $$
begin
    if new.building_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.buildings b
            where b.id = new.building_id and b.landlord_id = new.landlord_id
        ) then
            raise exception 'Multi-tenant isolation violation: Notification building does not belong to specified landlord.';
        end if;
    end if;

    if new.unit_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.units u
            where u.id = new.unit_id and u.landlord_id = new.landlord_id
        ) then
            raise exception 'Multi-tenant isolation violation: Notification unit does not belong to specified landlord.';
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_notification_tenant_isolation on public.notifications;
create trigger trg_enforce_notification_tenant_isolation
    before insert or update on public.notifications
    for each row execute function public.enforce_notification_tenant_isolation();

-- ==============================================================================
-- 7. Row-Level Security (RLS) Multi-Tenant Policies
-- (Configured for Landlords, Delegated Managers, Super-Admins, and Tenants)
-- ==============================================================================

-- 7.1 Profiles RLS
alter table public.profiles enable row level security;

drop policy if exists "Landlords can view their own profile" on public.profiles;
drop policy if exists "Landlords can update their own profile" on public.profiles;
drop policy if exists "Landlords can insert their own profile" on public.profiles;
drop policy if exists "Tenants can view assigned landlord contact info" on public.profiles;
drop policy if exists "Profiles select policy" on public.profiles;
drop policy if exists "Profiles insert policy" on public.profiles;
drop policy if exists "Profiles update policy" on public.profiles;
drop policy if exists "Profiles delete policy" on public.profiles;

create policy "Profiles select policy"
    on public.profiles for select
    using (
        -- User viewing their own profile
        (auth.uid() is not null and auth.uid() = id)
        or
        -- Landlord viewing managers under their account
        (auth.uid() is not null and landlord_id = auth.uid())
        or
        -- Admin viewing all profiles
        public.is_admin()
        or
        -- Anon tenant viewing assigned landlord contact info
        (auth.role() = 'anon' and exists (
            select 1 from public.units u
            where u.landlord_id = profiles.id and u.status = 'occupied'
        ))
    );

create policy "Profiles insert policy"
    on public.profiles for insert
    with check (
        -- User inserting own profile upon signup
        (auth.uid() is not null and auth.uid() = id)
        or
        -- Landlord creating a delegated manager account
        (auth.uid() is not null and landlord_id = auth.uid())
        or
        public.is_admin()
    );

create policy "Profiles update policy"
    on public.profiles for update
    using (
        (auth.uid() is not null and auth.uid() = id)
        or
        (auth.uid() is not null and landlord_id = auth.uid())
        or
        public.is_admin()
    )
    with check (
        (auth.uid() is not null and auth.uid() = id)
        or
        (auth.uid() is not null and landlord_id = auth.uid())
        or
        public.is_admin()
    );

create policy "Profiles delete policy"
    on public.profiles for delete
    using (
        (auth.uid() is not null and landlord_id = auth.uid())
        or
        public.is_admin()
    );

-- 7.2 Buildings RLS
alter table public.buildings enable row level security;

drop policy if exists "Landlords can view their own buildings" on public.buildings;
drop policy if exists "Tenants can view assigned building" on public.buildings;
drop policy if exists "Landlords can insert their own buildings" on public.buildings;
drop policy if exists "Landlords can update their own buildings" on public.buildings;
drop policy if exists "Landlords can delete their own buildings" on public.buildings;
drop policy if exists "Buildings select policy" on public.buildings;
drop policy if exists "Buildings insert policy" on public.buildings;
drop policy if exists "Buildings update policy" on public.buildings;
drop policy if exists "Buildings delete policy" on public.buildings;

create policy "Buildings select policy"
    on public.buildings for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
        or
        (auth.role() = 'anon' and exists (
            select 1 from public.units u 
            where u.building_id = buildings.id 
              and u.status = 'occupied' 
              and u.tenant_access_token is not null
        ))
    );

create policy "Buildings insert policy"
    on public.buildings for insert
    with check (
        (auth.uid() = landlord_id)
        or
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Buildings update policy"
    on public.buildings for update
    using (public.can_access_landlord_portfolio(landlord_id))
    with check (public.can_access_landlord_portfolio(landlord_id));

create policy "Buildings delete policy"
    on public.buildings for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.3 Units RLS
alter table public.units enable row level security;

drop policy if exists "Landlords can view their own units" on public.units;
drop policy if exists "Tenants can view assigned unit via token" on public.units;
drop policy if exists "Landlords can insert their own units" on public.units;
drop policy if exists "Landlords can update their own units" on public.units;
drop policy if exists "Landlords can delete their own units" on public.units;
drop policy if exists "Units select policy" on public.units;
drop policy if exists "Units insert policy" on public.units;
drop policy if exists "Units update policy" on public.units;
drop policy if exists "Units delete policy" on public.units;

create policy "Units select policy"
    on public.units for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
        or
        (auth.role() = 'anon' and tenant_access_token is not null and status = 'occupied')
    );

create policy "Units insert policy"
    on public.units for insert
    with check (
        public.can_access_landlord_portfolio(landlord_id)
        and exists (
            select 1 from public.buildings b
            where b.id = units.building_id and b.landlord_id = units.landlord_id
        )
    );

create policy "Units update policy"
    on public.units for update
    using (public.can_access_landlord_portfolio(landlord_id))
    with check (
        public.can_access_landlord_portfolio(landlord_id)
        and exists (
            select 1 from public.buildings b
            where b.id = units.building_id and b.landlord_id = units.landlord_id
        )
    );

create policy "Units delete policy"
    on public.units for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.4 Maintenance Requests RLS
alter table public.maintenance_requests enable row level security;

drop policy if exists "Landlords can view their own maintenance requests" on public.maintenance_requests;
drop policy if exists "Tenants can view maintenance requests for their occupied unit" on public.maintenance_requests;
drop policy if exists "Landlords can manage their maintenance requests" on public.maintenance_requests;
drop policy if exists "Landlords can delete their maintenance requests" on public.maintenance_requests;
drop policy if exists "Tenants and landlords can insert valid maintenance requests" on public.maintenance_requests;
drop policy if exists "Maintenance select policy" on public.maintenance_requests;
drop policy if exists "Maintenance insert policy" on public.maintenance_requests;
drop policy if exists "Maintenance update policy" on public.maintenance_requests;
drop policy if exists "Maintenance delete policy" on public.maintenance_requests;

create policy "Maintenance select policy"
    on public.maintenance_requests for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
        or
        (auth.role() = 'anon' and exists (
            select 1 from public.units u
            where u.id = maintenance_requests.unit_id and u.status = 'occupied'
        ))
    );

create policy "Maintenance insert policy"
    on public.maintenance_requests for insert
    with check (
        (public.can_access_landlord_portfolio(landlord_id) and exists (
            select 1 from public.units u where u.id = maintenance_requests.unit_id and u.landlord_id = maintenance_requests.landlord_id
        ))
        or
        (auth.role() = 'anon' and exists (
            select 1 from public.units u
            where u.id = maintenance_requests.unit_id
              and u.building_id = maintenance_requests.building_id
              and u.landlord_id = maintenance_requests.landlord_id
              and u.status = 'occupied'
        ))
    );

create policy "Maintenance update policy"
    on public.maintenance_requests for update
    using (public.can_access_landlord_portfolio(landlord_id))
    with check (public.can_access_landlord_portfolio(landlord_id));

create policy "Maintenance delete policy"
    on public.maintenance_requests for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.5 Rent Payments RLS
alter table public.rent_payments enable row level security;

drop policy if exists "Landlords can view their own rent payments" on public.rent_payments;
drop policy if exists "Tenants can view rent payments for their occupied unit" on public.rent_payments;
drop policy if exists "Landlords can manage their rent payments" on public.rent_payments;
drop policy if exists "Landlords can delete their rent payments" on public.rent_payments;
drop policy if exists "Tenants and landlords can insert valid rent payments" on public.rent_payments;
drop policy if exists "Payments select policy" on public.rent_payments;
drop policy if exists "Payments insert policy" on public.rent_payments;
drop policy if exists "Payments update policy" on public.rent_payments;
drop policy if exists "Payments delete policy" on public.rent_payments;

create policy "Payments select policy"
    on public.rent_payments for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
        or
        (auth.role() = 'anon' and exists (
            select 1 from public.units u
            where u.id = rent_payments.unit_id and u.status = 'occupied'
        ))
    );

create policy "Payments insert policy"
    on public.rent_payments for insert
    with check (
        (public.can_access_landlord_portfolio(landlord_id) and exists (
            select 1 from public.units u where u.id = rent_payments.unit_id and u.landlord_id = rent_payments.landlord_id
        ))
        or
        (auth.role() = 'anon' and exists (
            select 1 from public.units u
            where u.id = rent_payments.unit_id
              and u.building_id = rent_payments.building_id
              and u.landlord_id = rent_payments.landlord_id
              and u.status = 'occupied'
        ))
    );

create policy "Payments update policy"
    on public.rent_payments for update
    using (auth.uid() = landlord_id or public.is_admin())
    with check (auth.uid() = landlord_id or public.is_admin());

create policy "Payments delete policy"
    on public.rent_payments for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.6 Notifications RLS
alter table public.notifications enable row level security;

drop policy if exists "Landlords can view their own notifications" on public.notifications;
drop policy if exists "Tenants can view community notifications for their building" on public.notifications;
drop policy if exists "Landlords can update their own notifications" on public.notifications;
drop policy if exists "Landlords can delete their own notifications" on public.notifications;
drop policy if exists "Allow inserting valid notifications" on public.notifications;
drop policy if exists "Notifications select policy" on public.notifications;
drop policy if exists "Notifications insert policy" on public.notifications;
drop policy if exists "Notifications update policy" on public.notifications;
drop policy if exists "Notifications delete policy" on public.notifications;

-- Strict Notification Routing Select Policy:
-- 1. Admins see all platform notifications (payments, movements, registrations)
-- 2. Landlords see notifications for their specific buildings/units, but NEVER admin landlord signups
-- 3. Managers see notifications for their assigned building(s) under their landlord, but NEVER admin signups
-- 4. Tenants ONLY see arrivals/departures in their SAME building, and NEVER see payment receipts or landlord signups
create policy "Notifications select policy"
    on public.notifications for select
    using (
        -- Admins see all notifications
        public.is_admin()
        or
        -- Landlords managing that specific property
        (
            auth.uid() is not null
            and auth.uid() = landlord_id
            and recipient_role != 'admin'
            and type != 'landlord_registered'
        )
        or
        -- Managers managing that specific property under their landlord
        (
            auth.uid() is not null
            and exists (
                select 1 from public.profiles m
                where m.id = auth.uid()
                  and m.role = 'manager'
                  and m.landlord_id = notifications.landlord_id
                  and (
                      m.assigned_building_ids is null
                      or array_length(m.assigned_building_ids, 1) is null
                      or notifications.building_id is null
                      or notifications.building_id = any(m.assigned_building_ids)
                  )
            )
            and recipient_role in ('landlord', 'manager', 'management', 'building_community')
            and type != 'landlord_registered'
        )
        or
        -- Tenants ONLY see arrivals/departures in their SAME building
        (
            auth.role() = 'anon'
            and recipient_role in ('tenant', 'building_community')
            and type in ('tenant_arrived', 'tenant_departed', 'system', 'maintenance_update')
            and exists (
                select 1 from public.units u
                where u.building_id = notifications.building_id
                  and u.status = 'occupied'
            )
        )
    );

create policy "Notifications insert policy"
    on public.notifications for insert
    with check (
        (auth.uid() is not null)
        or
        (auth.role() = 'anon')
    );

create policy "Notifications update policy"
    on public.notifications for update
    using (
        public.is_admin()
        or (auth.uid() is not null and (landlord_id is null or auth.uid() = landlord_id or public.can_access_landlord_portfolio(landlord_id)))
        or (auth.role() = 'anon')
    )
    with check (
        public.is_admin()
        or (auth.uid() is not null and (landlord_id is null or auth.uid() = landlord_id or public.can_access_landlord_portfolio(landlord_id)))
        or (auth.role() = 'anon')
    );

create policy "Notifications delete policy"
    on public.notifications for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- ==============================================================================
-- 8. Stored Procedures & Business Logic (RPC)
-- ==============================================================================

-- 8.1 Signup Trigger Handler
create or replace function public.handle_new_landlord()
returns trigger as $$
declare
    v_full_name text;
    v_phone text;
    v_plan text;
    v_plan_name text;
    v_unit_limit integer;
    v_has_trial boolean;
    v_role text;
    v_landlord_id uuid;
begin
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
    v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
    v_plan := coalesce(new.raw_user_meta_data->>'plan', 'free');
    v_role := coalesce(new.raw_user_meta_data->>'role', 'landlord');

    if new.raw_user_meta_data->>'landlord_id' is not null and new.raw_user_meta_data->>'landlord_id' != '' then
        begin
            v_landlord_id := (new.raw_user_meta_data->>'landlord_id')::uuid;
        exception when others then
            v_landlord_id := null;
        end;
    else
        v_landlord_id := null;
    end if;

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
        landlord_id,
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
        coalesce(new.email, ''),
        v_role,
        v_landlord_id,
        v_plan,
        v_plan_name,
        v_unit_limit,
        30,
        now(),
        now() + interval '30 days',
        'active',
        v_has_trial
    )
    on conflict (id) do update set
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
        phone = case when public.profiles.phone = '' then excluded.phone else public.profiles.phone end,
        email = coalesce(excluded.email, public.profiles.email),
        role = coalesce(public.profiles.role, excluded.role),
        updated_at = now();

    -- Rule 3: Notify platform administrators when a new landlord registers
    if v_role = 'landlord' then
        insert into public.notifications (
            type,
            title,
            title_fr,
            message,
            message_fr,
            recipient_role,
            landlord_id,
            metadata
        ) values (
            'landlord_registered',
            'New Landlord Registered: ' || v_full_name,
            'Nouvelle Inscription Bailleur : ' || v_full_name,
            'Landlord "' || v_full_name || '" (' || coalesce(new.email, '') || ') registered on LeaseLink with plan ' || v_plan_name || '.',
            'Le bailleur "' || v_full_name || '" (' || coalesce(new.email, '') || ') s''est inscrit sur LeaseLink avec la formule ' || v_plan_name || '.',
            'admin',
            new.id,
            jsonb_build_object(
                'plan', v_plan,
                'plan_name', v_plan_name,
                'email', new.email,
                'phone', v_phone,
                'full_name', v_full_name
            )
        );
    end if;

    return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users wrapped safely
do $$
begin
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_landlord();
exception
    when others then
        raise notice 'Trigger on auth.users skipped (may require superuser in certain environments): %', sqlerrm;
end;
$$;

-- 8.2 Renew Subscription Helper
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

-- 8.3 Atomic Building Creation with Vacant Units
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
    if v_user_id is null then
        return json_build_object('success', false, 'error', 'Unauthorized. Please log in.');
    end if;

    v_effective_landlord_id := public.get_auth_landlord_id();
    if v_effective_landlord_id is null then
        v_effective_landlord_id := v_user_id;
    end if;

    v_units_count := greatest(coalesce(p_total_units, 1), 1);
    v_clean_prefix := coalesce(nullif(trim(p_unit_prefix), ''), 'Unit');

    select plan_unit_limit into v_unit_limit
    from public.profiles
    where id = v_effective_landlord_id;

    v_unit_limit := coalesce(v_unit_limit, 5);

    select count(*) into v_current_units
    from public.units
    where landlord_id = v_effective_landlord_id;

    if not public.is_admin() and (v_current_units + v_units_count) > v_unit_limit then
        return json_build_object(
            'success', false,
            'error', format('Unit quota exceeded! Your plan allows up to %s units. You already have %s units, so adding %s units would exceed your limit.', v_unit_limit, v_current_units, v_units_count)
        );
    end if;

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
        coalesce(nullif(trim(p_property_type), ''), 'apartment'),
        1,
        v_units_count,
        nullif(trim(p_description), '')
    ) returning id into v_building_id;

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
            v_effective_landlord_id,
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

-- 8.4 Update Unit Specs Function
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
    where id = p_unit_id;

    if not found or not public.can_access_landlord_portfolio(v_unit.landlord_id) then
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
    where id = p_unit_id;

    return json_build_object(
        'success', true,
        'message', 'Unit modified successfully'
    );
end;
$$ language plpgsql security definer;

-- 8.5 Assign Tenant to Unit Function
create or replace function public.assign_unit_tenant(
    p_unit_id uuid,
    p_tenant_name text,
    p_tenant_phone text,
    p_tenant_email text,
    p_tenant_password text,
    p_tenant_access_token text
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
    where id = p_unit_id;

    if not found or not public.can_access_landlord_portfolio(v_unit.landlord_id) then
        return json_build_object('success', false, 'error', 'Unit not found or access denied');
    end if;

    update public.units
    set
        tenant_name = trim(p_tenant_name),
        tenant_phone = trim(p_tenant_phone),
        tenant_email = lower(trim(p_tenant_email)),
        tenant_password = trim(p_tenant_password),
        tenant_access_token = trim(p_tenant_access_token),
        tenant_assigned_at = coalesce(tenant_assigned_at, now()),
        status = 'occupied',
        updated_at = now()
    where id = p_unit_id;

    return json_build_object(
        'success', true,
        'message', 'Tenant assigned and credentials created successfully'
    );
end;
$$ language plpgsql security definer;

-- 8.6 Unassign Tenant from Unit Function
create or replace function public.unassign_unit_tenant(p_unit_id uuid)
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
    where id = p_unit_id;

    if not found or not public.can_access_landlord_portfolio(v_unit.landlord_id) then
        return json_build_object('success', false, 'error', 'Unit not found or access denied');
    end if;

    update public.units
    set
        tenant_name = null,
        tenant_phone = null,
        tenant_email = null,
        tenant_password = null,
        tenant_access_token = null,
        tenant_assigned_at = null,
        status = 'vacant',
        updated_at = now()
    where id = p_unit_id;

    return json_build_object('success', true, 'message', 'Tenant unassigned successfully');
end;
$$ language plpgsql security definer;

-- 8.7 Secure Tenant Portal Data Lookup via Token
create or replace function public.get_tenant_portal_data(p_token text)
returns json as $$
declare
    v_clean_token text;
    v_res json;
begin
    v_clean_token := trim(coalesce(p_token, ''));
    if v_clean_token = '' then
        return json_build_object('success', false, 'error', 'Token is required');
    end if;

    select json_build_object(
        'tenant_name', u.tenant_name,
        'tenant_phone', u.tenant_phone,
        'tenant_email', u.tenant_email,
        'unit_id', u.id,
        'unit_number', u.unit_number,
        'rent_amount', u.rent_amount,
        'parlors', u.parlors,
        'rooms', u.rooms,
        'bathrooms', u.bathrooms,
        'kitchens', u.kitchens,
        'notes', u.notes,
        'building_id', b.id,
        'building_name', b.name,
        'building_address', b.address,
        'building_city', b.city,
        'landlord_id', p.id,
        'landlord_name', p.full_name,
        'landlord_phone', p.phone,
        'landlord_email', p.email,
        'assigned_at', u.tenant_assigned_at,
        'access_token', u.tenant_access_token
    ) into v_res
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.profiles p on p.id = u.landlord_id
    where u.tenant_access_token = v_clean_token and u.status = 'occupied';

    if v_res is null then
        return json_build_object('success', false, 'error', 'Invalid or expired access token');
    end if;

    return json_build_object('success', true, 'data', v_res);
end;
$$ language plpgsql security definer;

-- 8.8 Secure Tenant Login via Identifier & Password
create or replace function public.authenticate_tenant(p_identifier text, p_password text)
returns json as $$
declare
    v_clean_id text;
    v_clean_digits text;
    v_res json;
begin
    v_clean_id := lower(trim(coalesce(p_identifier, '')));
    v_clean_digits := regexp_replace(v_clean_id, '\D', '', 'g');

    if v_clean_id = '' or coalesce(p_password, '') = '' then
        return json_build_object('success', false, 'error', 'Identifier and password are required');
    end if;

    select json_build_object(
        'tenant_name', u.tenant_name,
        'tenant_phone', u.tenant_phone,
        'tenant_email', u.tenant_email,
        'unit_id', u.id,
        'unit_number', u.unit_number,
        'rent_amount', u.rent_amount,
        'parlors', u.parlors,
        'rooms', u.rooms,
        'bathrooms', u.bathrooms,
        'kitchens', u.kitchens,
        'notes', u.notes,
        'building_id', b.id,
        'building_name', b.name,
        'building_address', b.address,
        'building_city', b.city,
        'landlord_id', p.id,
        'landlord_name', p.full_name,
        'landlord_phone', p.phone,
        'landlord_email', p.email,
        'assigned_at', u.tenant_assigned_at,
        'access_token', u.tenant_access_token
    ) into v_res
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.profiles p on p.id = u.landlord_id
    where (
        (lower(coalesce(u.tenant_email, '')) = v_clean_id and v_clean_id != '')
        or
        (length(v_clean_digits) >= 6 and regexp_replace(coalesce(u.tenant_phone, ''), '\D', '', 'g') = v_clean_digits)
    )
    and u.tenant_password = trim(p_password)
    and u.status = 'occupied'
    limit 1;

    if v_res is null then
        return json_build_object('success', false, 'error', 'Invalid email/phone or password.');
    end if;

    return json_build_object('success', true, 'data', v_res);
end;
$$ language plpgsql security definer;

-- 8.9 Secure Tenant Maintenance Requests Lookup
create or replace function public.get_tenant_maintenance_requests(p_token text)
returns json as $$
declare
    v_unit_id uuid;
    v_res json;
begin
    select id into v_unit_id
    from public.units
    where tenant_access_token = trim(p_token) and status = 'occupied';

    if v_unit_id is null then
        return json_build_object('success', false, 'error', 'Invalid token');
    end if;

    select coalesce(json_agg(row_to_json(m.*) order by m.created_at desc), '[]'::json)
    into v_res
    from public.maintenance_requests m
    where m.unit_id = v_unit_id;

    return json_build_object('success', true, 'data', v_res);
end;
$$ language plpgsql security definer;

-- 8.10 Secure Tenant Rent Payments Lookup
create or replace function public.get_tenant_rent_payments(p_token text)
returns json as $$
declare
    v_unit_id uuid;
    v_res json;
begin
    select id into v_unit_id
    from public.units
    where tenant_access_token = trim(p_token) and status = 'occupied';

    if v_unit_id is null then
        return json_build_object('success', false, 'error', 'Invalid token');
    end if;

    select coalesce(json_agg(row_to_json(r.*) order by r.created_at desc), '[]'::json)
    into v_res
    from public.rent_payments r
    where r.unit_id = v_unit_id;

    return json_build_object('success', true, 'data', v_res);
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- 9. Permissions & Execution Grants
-- ==============================================================================
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public.buildings to anon, authenticated, service_role;
grant select, insert, update, delete on table public.units to anon, authenticated, service_role;
grant select, insert, update, delete on table public.maintenance_requests to anon, authenticated, service_role;
grant select, insert, update, delete on table public.rent_payments to anon, authenticated, service_role;
grant select, insert, update, delete on table public.notifications to anon, authenticated, service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;

-- ==============================================================================
-- 10. Realtime Publication Setup (Safe & Permissive)
-- ==============================================================================
do $$
begin
    begin
        alter table public.profiles replica identity full;
        alter table public.buildings replica identity full;
        alter table public.units replica identity full;
        alter table public.maintenance_requests replica identity full;
        alter table public.rent_payments replica identity full;
        alter table public.notifications replica identity full;
    exception when others then
        raise notice 'Replica identity setup notice: %', sqlerrm;
    end;

    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'profiles') then
        alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'buildings') then
        alter publication supabase_realtime add table public.buildings;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'units') then
        alter publication supabase_realtime add table public.units;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'maintenance_requests') then
        alter publication supabase_realtime add table public.maintenance_requests;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rent_payments') then
        alter publication supabase_realtime add table public.rent_payments;
    end if;

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
        alter publication supabase_realtime add table public.notifications;
    end if;
exception
    when others then
        raise notice 'Realtime publication setup notice: %', sqlerrm;
end;
$$;

-- ==============================================================================
-- 11. Refresh PostgREST Schema Cache
-- ==============================================================================
notify pgrst, 'reload schema';
