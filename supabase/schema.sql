-- ==============================================================================
-- LEASELINK DATABASE SCHEMA & SUPABASE CONFIGURATION
-- ==============================================================================
-- Run this script directly in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run)
--
-- 100% IDEMPOTENT, SAFE & NON-DESTRUCTIVE:
-- - Preserves all existing tables, records, users, and uploaded media.
-- - Can be run on fresh databases, partial databases, or live databases with zero errors.
-- - Arranged in strict PostgreSQL dependency order (Tables -> Functions -> Triggers -> Policies -> RPCs).
-- - Fully configured for Landlords, Delegated Managers, Super-Admins, and Tenants.
-- ==============================================================================

-- Disable function body validation during creation to guarantee seamless dependency resolution
set check_function_bodies = false;

-- Base Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";


-- ==============================================================================
-- PHASE 1: Core Table Definitions (Created in Foreign Key Dependency Order)
-- ==============================================================================

-- 1.1 Profiles Table (Landlords, Delegated Managers, Super-Admins, Tenants)
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
    billing_cycle text not null default 'monthly',
    plan_unit_limit integer not null default 5,
    unit_limit integer not null default 5,
    plan_duration_days integer not null default 30,
    plan_starts_at timestamptz not null default now(),
    plan_expires_at timestamptz not null default (now() + interval '30 days'),
    trial_expires_at timestamptz not null default (now() + interval '30 days'),
    subscription_expires_at timestamptz not null default (now() + interval '30 days'),
    plan_status text not null default 'active',
    subscription_status text not null default 'active',
    has_used_free_trial boolean not null default false,
    has_used_trial boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Idempotent column migrations for existing databases
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists plan_name text not null default 'Free Trial (30 Days)';
alter table public.profiles add column if not exists billing_cycle text not null default 'monthly';
alter table public.profiles add column if not exists plan_unit_limit integer not null default 5;
alter table public.profiles add column if not exists unit_limit integer not null default 5;
alter table public.profiles add column if not exists plan_duration_days integer not null default 30;
alter table public.profiles add column if not exists plan_starts_at timestamptz not null default now();
alter table public.profiles add column if not exists plan_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists trial_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists subscription_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists plan_status text not null default 'active';
alter table public.profiles add column if not exists subscription_status text not null default 'active';
alter table public.profiles add column if not exists has_used_free_trial boolean not null default false;
alter table public.profiles add column if not exists has_used_trial boolean not null default false;

-- Idempotent column migrations for financial receipts storage
alter table public.rent_payments add column if not exists receipt_url text;
alter table public.subscriptions add column if not exists receipt_url text;

-- 1.2 Buildings Table (Properties, Complexes & Residences)
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

-- 1.3 Units Table (Apartments, Flats, Studios & Rooms)
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

-- 1.4 Maintenance Requests Table (Repairs, Work Orders & Tenant Tickets)
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

-- 1.5 Rent Payments Table (Official Financial Receipts & Tracking)
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
    receipt_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 1.6 Notifications Table (Multi-Channel In-App Alerts)
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

-- 1.7 Subscriptions Table (Landlord Tier Renewals & Payment Records)
create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    receipt_number text not null unique,
    landlord_id uuid not null references public.profiles(id) on delete cascade,
    landlord_name text,
    landlord_email text,
    landlord_phone text,
    plan_id text not null,
    plan_name text not null,
    billing_cycle text not null default 'monthly',
    amount_paid numeric(12, 2) not null default 0.00,
    payment_method text not null default 'momo',
    transaction_ref text not null,
    duration_days integer not null default 30,
    starts_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '30 days'),
    status text not null default 'completed',
    payer_phone text,
    notes text,
    created_at timestamptz not null default now()
);


-- ==============================================================================
-- PHASE 2: Core Helper Functions
-- ==============================================================================

-- 2.1 Automatically set updated_at on record changes
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- 2.2 Check if current authenticated user is a platform administrator
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
$$ language plpgsql security definer set search_path = public, auth stable;

-- 2.3 Resolve effective landlord ID (for managers returns their parent landlord ID)
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
$$ language plpgsql security definer set search_path = public, auth stable;

-- 2.4 Check if authenticated user can view or manage a landlord's portfolio
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
$$ language plpgsql security definer set search_path = public, auth stable;

-- 2.5 Profile Column Harmonization Trigger (Syncs legacy & modern column conventions)
create or replace function public.sync_profile_columns()
returns trigger as $$
begin
    if new.plan_unit_limit is not null and new.unit_limit is null then
        new.unit_limit := new.plan_unit_limit;
    elsif new.unit_limit is not null and new.plan_unit_limit is null then
        new.plan_unit_limit := new.unit_limit;
    end if;

    if new.plan_status is not null and new.subscription_status is null then
        new.subscription_status := new.plan_status;
    elsif new.subscription_status is not null and new.plan_status is null then
        new.plan_status := new.subscription_status;
    end if;

    if new.has_used_free_trial is not null and new.has_used_trial is null then
        new.has_used_trial := new.has_used_free_trial;
    elsif new.has_used_trial is not null and new.has_used_free_trial is null then
        new.has_used_free_trial := new.has_used_trial;
    end if;

    if new.plan = 'free_trial' then
        new.plan := 'free';
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_profile_columns on public.profiles;
create trigger trg_sync_profile_columns
    before insert or update on public.profiles
    for each row execute function public.sync_profile_columns();


-- ==============================================================================
-- PHASE 3: Non-Destructive Migrations & Safe Column Backfills
-- ==============================================================================

-- 3.1 Profiles Table Columns
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists role text not null default 'landlord';
alter table public.profiles add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.profiles add column if not exists assigned_building_ids uuid[] default null;
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists plan_name text not null default 'Free Trial (30 Days)';
alter table public.profiles add column if not exists billing_cycle text not null default 'monthly';
alter table public.profiles add column if not exists plan_unit_limit integer not null default 5;
alter table public.profiles add column if not exists unit_limit integer not null default 5;
alter table public.profiles add column if not exists plan_duration_days integer not null default 30;
alter table public.profiles add column if not exists plan_starts_at timestamptz not null default now();
alter table public.profiles add column if not exists plan_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists trial_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists subscription_expires_at timestamptz not null default (now() + interval '30 days');
alter table public.profiles add column if not exists plan_status text not null default 'active';
alter table public.profiles add column if not exists subscription_status text not null default 'active';
alter table public.profiles add column if not exists has_used_free_trial boolean not null default false;
alter table public.profiles add column if not exists has_used_trial boolean not null default false;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

do $$
begin
    update public.profiles set role = 'landlord' where role is null or role not in ('landlord', 'manager', 'admin', 'tenant');
    update public.profiles set plan = 'free' where plan is null or plan not in ('free', 'free_trial', 'tier_1_30', 'starter', 'tier_31_60', 'growth', 'tier_61_100', 'pro', 'tier_100_plus', 'ultimate');
    update public.profiles set billing_cycle = 'monthly' where billing_cycle is null or billing_cycle not in ('monthly', 'annual');
    update public.profiles set plan_status = 'active' where plan_status is null or plan_status not in ('active', 'expired', 'renewed', 'suspended');
    update public.profiles set subscription_status = plan_status where subscription_status is null;
    update public.profiles set plan_unit_limit = 5 where plan_unit_limit is null or plan_unit_limit < 1;
    update public.profiles set unit_limit = plan_unit_limit where unit_limit is null or unit_limit < 1;
    update public.profiles set has_used_trial = has_used_free_trial where has_used_trial is null;
    update public.profiles set plan_duration_days = 30 where plan_duration_days is null;

    alter table public.profiles drop constraint if exists profiles_role_check;
    alter table public.profiles add constraint profiles_role_check check (role in ('landlord', 'manager', 'admin', 'tenant'));

    alter table public.profiles drop constraint if exists profiles_plan_check;
    alter table public.profiles add constraint profiles_plan_check check (plan in ('free', 'free_trial', 'tier_1_30', 'starter', 'tier_31_60', 'growth', 'tier_61_100', 'pro', 'tier_100_plus', 'ultimate'));

    alter table public.profiles drop constraint if exists profiles_billing_cycle_check;
    alter table public.profiles add constraint profiles_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));

    alter table public.profiles drop constraint if exists profiles_plan_status_check;
    alter table public.profiles add constraint profiles_plan_status_check check (plan_status in ('active', 'expired', 'renewed', 'suspended'));

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

-- 3.2 Buildings Table Columns & Constraints
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
    update public.buildings set property_type = 'apartment' where property_type is null or property_type not in ('apartment', 'residential', 'commercial', 'mixed_use', 'duplex', 'other');
    alter table public.buildings drop constraint if exists buildings_property_type_check;
    alter table public.buildings add constraint buildings_property_type_check check (property_type in ('apartment', 'residential', 'commercial', 'mixed_use', 'duplex', 'other'));
exception
    when others then
        raise notice 'Buildings migration notice: %', sqlerrm;
end;
$$;

-- 3.3 Units Table Columns & Constraints
alter table public.units add column if not exists building_id uuid references public.buildings(id) on delete cascade;
alter table public.units add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.units add column if not exists unit_number text not null default '1';
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

do $$
begin
    update public.units set status = 'vacant' where status is null or status not in ('vacant', 'occupied', 'maintenance');
    update public.units set rent_due_day = 5 where rent_due_day is null or rent_due_day < 1 or rent_due_day > 31;
    update public.units set rent_amount = 0.00 where rent_amount is null;
    update public.units set deposit_amount = 0.00 where deposit_amount is null;

    alter table public.units drop constraint if exists units_status_check;
    alter table public.units add constraint units_status_check check (status in ('vacant', 'occupied', 'maintenance'));

    alter table public.units drop constraint if exists units_rent_due_day_check;
    alter table public.units add constraint units_rent_due_day_check check (rent_due_day between 1 and 31);
exception
    when others then
        raise notice 'Units migration notice: %', sqlerrm;
end;
$$;

-- 3.4 Maintenance Requests Columns & Constraints
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
alter table public.maintenance_requests add column if not exists title text not null default 'Request';
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
    update public.maintenance_requests set status = 'pending' where status is null or status not in ('pending', 'in_progress', 'resolved', 'rejected', 'completed', 'cancelled');
    update public.maintenance_requests set urgency = 'medium' where urgency is null or urgency not in ('low', 'medium', 'high', 'emergency');

    alter table public.maintenance_requests drop constraint if exists maintenance_status_check;
    alter table public.maintenance_requests add constraint maintenance_status_check check (status in ('pending', 'in_progress', 'resolved', 'rejected', 'completed', 'cancelled'));

    alter table public.maintenance_requests drop constraint if exists maintenance_urgency_check;
    alter table public.maintenance_requests add constraint maintenance_urgency_check check (urgency in ('low', 'medium', 'high', 'emergency'));
exception
    when others then
        raise notice 'Maintenance migration notice: %', sqlerrm;
end;
$$;

-- 3.5 Rent Payments Columns & Constraints
alter table public.rent_payments add column if not exists receipt_number text not null default 'REC-000';
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
alter table public.rent_payments add column if not exists transaction_ref text not null default 'REF-000';
alter table public.rent_payments add column if not exists status text not null default 'completed';
alter table public.rent_payments add column if not exists payer_phone text;
alter table public.rent_payments add column if not exists notes text;
alter table public.rent_payments add column if not exists receipt_url text;
alter table public.rent_payments add column if not exists created_at timestamptz not null default now();
alter table public.rent_payments add column if not exists updated_at timestamptz not null default now();

do $$
begin
    update public.rent_payments set status = 'completed' where status is null or status not in ('completed', 'pending', 'failed');
    update public.rent_payments set payment_type = 'full' where payment_type is null or payment_type not in ('full', 'partial');
    update public.rent_payments set payment_method = 'momo' where payment_method is null or payment_method not in ('momo', 'orange_money', 'card', 'bank_transfer', 'cash');

    alter table public.rent_payments drop constraint if exists payments_status_check;
    alter table public.rent_payments add constraint payments_status_check check (status in ('completed', 'pending', 'failed'));

    alter table public.rent_payments drop constraint if exists payments_type_check;
    alter table public.rent_payments add constraint payments_type_check check (payment_type in ('full', 'partial'));

    alter table public.rent_payments drop constraint if exists payments_method_check;
    alter table public.rent_payments add constraint payments_method_check check (payment_method in ('momo', 'orange_money', 'card', 'bank_transfer', 'cash'));

    if not exists (
        select 1 from pg_indexes
        where schemaname = 'public' and tablename = 'rent_payments' and indexname = 'rent_payments_receipt_number_idx'
    ) then
        create unique index rent_payments_receipt_number_idx on public.rent_payments (receipt_number);
    end if;
exception
    when others then
        raise notice 'Rent payments migration notice: %', sqlerrm;
end;
$$;

-- 3.6 Notifications Columns
alter table public.notifications add column if not exists type text not null default 'system';
alter table public.notifications add column if not exists title text not null default 'Notification';
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

-- 3.7 Subscriptions Columns & Constraints
alter table public.subscriptions add column if not exists receipt_number text not null default 'SUB-000';
alter table public.subscriptions add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
alter table public.subscriptions add column if not exists landlord_name text;
alter table public.subscriptions add column if not exists landlord_email text;
alter table public.subscriptions add column if not exists landlord_phone text;
alter table public.subscriptions add column if not exists plan_id text not null default 'free';
alter table public.subscriptions add column if not exists plan_name text not null default 'Free Trial';
alter table public.subscriptions add column if not exists billing_cycle text not null default 'monthly';
alter table public.subscriptions add column if not exists amount_paid numeric(12, 2) not null default 0.00;
alter table public.subscriptions add column if not exists payment_method text not null default 'momo';
alter table public.subscriptions add column if not exists transaction_ref text not null default 'REF-000';
alter table public.subscriptions add column if not exists duration_days integer not null default 30;
alter table public.subscriptions add column if not exists starts_at timestamptz not null default now();
alter table public.subscriptions add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
alter table public.subscriptions add column if not exists status text not null default 'completed';
alter table public.subscriptions add column if not exists payer_phone text;
alter table public.subscriptions add column if not exists notes text;
alter table public.subscriptions add column if not exists created_at timestamptz not null default now();

do $$
begin
    update public.subscriptions set status = 'completed' where status is null or status not in ('completed', 'pending', 'failed');
    update public.subscriptions set payment_method = 'momo' where payment_method is null or payment_method not in ('momo', 'orange_money', 'card', 'bank_transfer', 'cash');
    update public.subscriptions set billing_cycle = 'monthly' where billing_cycle is null or billing_cycle not in ('monthly', 'annual');

    alter table public.subscriptions drop constraint if exists subscriptions_status_check;
    alter table public.subscriptions add constraint subscriptions_status_check check (status in ('completed', 'pending', 'failed'));

    alter table public.subscriptions drop constraint if exists subscriptions_method_check;
    alter table public.subscriptions add constraint subscriptions_method_check check (payment_method in ('momo', 'orange_money', 'card', 'bank_transfer', 'cash'));

    alter table public.subscriptions drop constraint if exists subscriptions_billing_cycle_check;
    alter table public.subscriptions add constraint subscriptions_billing_cycle_check check (billing_cycle in ('monthly', 'annual'));
exception
    when others then
        raise notice 'Subscriptions migration notice: %', sqlerrm;
end;
$$;


-- ==============================================================================
-- PHASE 4: Database Performance Indexes
-- ==============================================================================

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_landlord_id on public.profiles(landlord_id);

create index if not exists idx_buildings_landlord_id on public.buildings(landlord_id);

create index if not exists idx_units_building_id on public.units(building_id);
create index if not exists idx_units_landlord_id on public.units(landlord_id);
create index if not exists idx_units_status on public.units(status);
create index if not exists idx_units_tenant_access_token on public.units(tenant_access_token);
create index if not exists idx_units_tenant_phone on public.units(tenant_phone);
create index if not exists idx_units_tenant_email on public.units(lower(trim(tenant_email)));
create index if not exists idx_units_rent_due_day on public.units(rent_due_day);

create index if not exists idx_maintenance_unit_id on public.maintenance_requests(unit_id);
create index if not exists idx_maintenance_building_id on public.maintenance_requests(building_id);
create index if not exists idx_maintenance_landlord_id on public.maintenance_requests(landlord_id);
create index if not exists idx_maintenance_status on public.maintenance_requests(status);

create index if not exists idx_rent_payments_unit_id on public.rent_payments(unit_id);
create index if not exists idx_rent_payments_building_id on public.rent_payments(building_id);
create index if not exists idx_rent_payments_landlord_id on public.rent_payments(landlord_id);
create index if not exists idx_rent_payments_rent_month on public.rent_payments(rent_month);
create index if not exists idx_rent_payments_status on public.rent_payments(status);

create index if not exists idx_notifications_recipient_role on public.notifications(recipient_role);
create index if not exists idx_notifications_landlord_id on public.notifications(landlord_id);
create index if not exists idx_notifications_building_id on public.notifications(building_id);
create index if not exists idx_notifications_unit_id on public.notifications(unit_id);
create index if not exists idx_notifications_is_read on public.notifications(is_read);


-- ==============================================================================
-- PHASE 5: Timestamp Update Triggers
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
-- PHASE 6: Engine-Level Multi-Tenant Isolation Triggers
-- ==============================================================================

-- 6.1 Units Isolation (Building must belong to the landlord or manager's landlord)
create or replace function public.enforce_unit_tenant_isolation()
returns trigger as $$
begin
    if new.building_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.buildings b
            where b.id = new.building_id 
              and (
                  b.landlord_id = new.landlord_id
                  or exists (
                      select 1 from public.profiles p
                      where p.id = new.landlord_id and p.landlord_id = b.landlord_id
                  )
              )
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
              and (
                  (u.landlord_id = new.landlord_id and b.landlord_id = new.landlord_id)
                  or exists (
                      select 1 from public.profiles p
                      where p.id = new.landlord_id and p.landlord_id = u.landlord_id
                  )
              )
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

-- 6.3 Maintenance Resolution Rule (Only the Tenant Can Mark Requests as Resolved)
create or replace function public.enforce_maintenance_status_rules()
returns trigger as $$
declare
    v_updater_role text;
begin
    -- If status is being transitioned to 'resolved'
    if new.status = 'resolved' and (old.status is null or old.status <> 'resolved') then
        if auth.uid() is not null then
            select role into v_updater_role from public.profiles where id = auth.uid();
            -- Landlords and delegated managers cannot set status to resolved directly
            if v_updater_role in ('landlord', 'manager') and not public.is_admin() then
                raise exception 'Only the tenant can mark a reparation request as resolved (Seul le locataire peut marquer sa demande de réparation comme résolue).';
            end if;
        end if;
    end if;

    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_maintenance_status_rules on public.maintenance_requests;
create trigger trg_enforce_maintenance_status_rules
    before update on public.maintenance_requests
    for each row execute function public.enforce_maintenance_status_rules();

-- 6.4 Rent Payments Isolation
create or replace function public.enforce_payment_tenant_isolation()
returns trigger as $$
begin
    if new.unit_id is not null and new.building_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.units u
            join public.buildings b on b.id = u.building_id
            where u.id = new.unit_id
              and u.building_id = new.building_id
              and (
                  (u.landlord_id = new.landlord_id and b.landlord_id = new.landlord_id)
                  or exists (
                      select 1 from public.profiles p
                      where p.id = new.landlord_id and p.landlord_id = u.landlord_id
                  )
              )
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
            where b.id = new.building_id
              and (
                  b.landlord_id = new.landlord_id
                  or exists (
                      select 1 from public.profiles p
                      where p.id = new.landlord_id and p.landlord_id = b.landlord_id
                  )
              )
        ) then
            raise exception 'Multi-tenant isolation violation: Notification building does not belong to specified landlord.';
        end if;
    end if;

    if new.unit_id is not null and new.landlord_id is not null then
        if not exists (
            select 1 from public.units u
            where u.id = new.unit_id
              and (
                  u.landlord_id = new.landlord_id
                  or exists (
                      select 1 from public.profiles p
                      where p.id = new.landlord_id and p.landlord_id = u.landlord_id
                  )
              )
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
-- PHASE 7: Row-Level Security (RLS) Multi-Tenant Policies
-- ==============================================================================

-- 7.1 Profiles RLS
alter table public.profiles enable row level security;

drop policy if exists "Profiles select policy" on public.profiles;
drop policy if exists "Profiles insert policy" on public.profiles;
drop policy if exists "Profiles update policy" on public.profiles;
drop policy if exists "Profiles delete policy" on public.profiles;

create policy "Profiles select policy"
    on public.profiles for select
    using (
        (auth.uid() is not null and (
            auth.uid() = id
            or landlord_id = auth.uid()
            or id = (select p.landlord_id from public.profiles p where p.id = auth.uid())
            or public.is_admin()
        ))
    );

create policy "Profiles insert policy"
    on public.profiles for insert
    with check (
        (auth.uid() is not null and auth.uid() = id)
        or
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

drop policy if exists "Buildings select policy" on public.buildings;
drop policy if exists "Buildings insert policy" on public.buildings;
drop policy if exists "Buildings update policy" on public.buildings;
drop policy if exists "Buildings delete policy" on public.buildings;

create policy "Buildings select policy"
    on public.buildings for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
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

drop policy if exists "Units select policy" on public.units;
drop policy if exists "Units insert policy" on public.units;
drop policy if exists "Units update policy" on public.units;
drop policy if exists "Units delete policy" on public.units;

create policy "Units select policy"
    on public.units for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Units insert policy"
    on public.units for insert
    with check (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Units update policy"
    on public.units for update
    using (public.can_access_landlord_portfolio(landlord_id))
    with check (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Units delete policy"
    on public.units for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.4 Maintenance Requests RLS
alter table public.maintenance_requests enable row level security;

drop policy if exists "Maintenance select policy" on public.maintenance_requests;
drop policy if exists "Maintenance insert policy" on public.maintenance_requests;
drop policy if exists "Maintenance update policy" on public.maintenance_requests;
drop policy if exists "Maintenance delete policy" on public.maintenance_requests;

create policy "Maintenance select policy"
    on public.maintenance_requests for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Maintenance insert policy"
    on public.maintenance_requests for insert
    with check (
        public.can_access_landlord_portfolio(landlord_id)
        or
        exists (
            select 1 from public.units u
            where u.id = unit_id
              and u.status = 'occupied'
              and u.building_id = building_id
              and u.landlord_id = landlord_id
        )
    );

create policy "Maintenance update policy"
    on public.maintenance_requests for update
    using (
        public.can_access_landlord_portfolio(landlord_id)
    )
    with check (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Maintenance delete policy"
    on public.maintenance_requests for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.5 Rent Payments RLS
alter table public.rent_payments enable row level security;

drop policy if exists "Payments select policy" on public.rent_payments;
drop policy if exists "Payments insert policy" on public.rent_payments;
drop policy if exists "Payments update policy" on public.rent_payments;
drop policy if exists "Payments delete policy" on public.rent_payments;

create policy "Payments select policy"
    on public.rent_payments for select
    using (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Payments insert policy"
    on public.rent_payments for insert
    with check (
        public.can_access_landlord_portfolio(landlord_id)
    );

create policy "Payments update policy"
    on public.rent_payments for update
    using (public.can_access_landlord_portfolio(landlord_id))
    with check (public.can_access_landlord_portfolio(landlord_id));

create policy "Payments delete policy"
    on public.rent_payments for delete
    using (auth.uid() = landlord_id or public.is_admin());

-- 7.6 Notifications RLS
alter table public.notifications enable row level security;

drop policy if exists "Notifications select policy" on public.notifications;
drop policy if exists "Notifications insert policy" on public.notifications;
drop policy if exists "Notifications update policy" on public.notifications;
drop policy if exists "Notifications delete policy" on public.notifications;

create policy "Notifications select policy"
    on public.notifications for select
    using (
        public.is_admin()
        or
        (auth.uid() is not null and (
            landlord_id = auth.uid()
            or public.can_access_landlord_portfolio(landlord_id)
        ))
    );

create policy "Notifications insert policy"
    on public.notifications for insert
    with check (
        public.is_admin()
        or
        (auth.uid() is not null and (
            landlord_id = auth.uid()
            or public.can_access_landlord_portfolio(landlord_id)
        ))
    );

create policy "Notifications update policy"
    on public.notifications for update
    using (
        public.is_admin()
        or (auth.uid() is not null and (auth.uid() = landlord_id or public.can_access_landlord_portfolio(landlord_id)))
    )
    with check (
        public.is_admin()
        or (auth.uid() is not null and (auth.uid() = landlord_id or public.can_access_landlord_portfolio(landlord_id)))
    );

create policy "Notifications delete policy"
    on public.notifications for delete
    using (auth.uid() = landlord_id or public.is_admin() or public.can_access_landlord_portfolio(landlord_id));

-- 7.7 Subscriptions RLS
alter table public.subscriptions enable row level security;

drop policy if exists "Subscriptions select policy" on public.subscriptions;
drop policy if exists "Subscriptions insert policy" on public.subscriptions;
drop policy if exists "Subscriptions update policy" on public.subscriptions;

create policy "Subscriptions select policy"
    on public.subscriptions for select
    using (
        auth.uid() = landlord_id or public.is_admin()
    );

create policy "Subscriptions insert policy"
    on public.subscriptions for insert
    with check (
        auth.uid() = landlord_id or public.is_admin()
    );

create policy "Subscriptions update policy"
    on public.subscriptions for update
    using (public.is_admin())
    with check (public.is_admin());


-- ==============================================================================
-- PHASE 8: Stored Procedures & Application RPCs
-- ==============================================================================

-- 8.1 Signup Profile Provisioning Trigger Handler
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
    v_billing_cycle text;
    v_duration_days integer;
    v_expires_at timestamptz;
begin
    v_full_name := coalesce(new.raw_user_meta_data->>'full_name', '');
    v_phone := coalesce(new.raw_user_meta_data->>'phone', '');
    v_plan := coalesce(new.raw_user_meta_data->>'plan', 'free');
    v_role := coalesce(new.raw_user_meta_data->>'role', 'landlord');
    v_billing_cycle := coalesce(new.raw_user_meta_data->>'billing_cycle', 'monthly');

    if v_billing_cycle not in ('monthly', 'annual') then
        v_billing_cycle := 'monthly';
    end if;

    if new.raw_user_meta_data->>'landlord_id' is not null and new.raw_user_meta_data->>'landlord_id' != '' then
        begin
            v_landlord_id := (new.raw_user_meta_data->>'landlord_id')::uuid;
        exception when others then
            v_landlord_id := null;
        end;
    else
        v_landlord_id := null;
    end if;

    if v_plan in ('free', 'free_trial') then
        v_plan := 'free';
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
    elsif v_plan in ('tier_100_plus', 'ultimate') then
        v_plan_name := 'Ultimate (101 to 300 Units)';
        v_unit_limit := 300;
        v_has_trial := false;
    else
        v_plan := 'free';
        v_plan_name := 'Free Trial (30 Days)';
        v_unit_limit := 5;
        v_has_trial := true;
    end if;

    if v_billing_cycle = 'annual' and not v_has_trial then
        v_duration_days := 365;
        v_expires_at := now() + interval '365 days';
    else
        v_duration_days := 30;
        v_expires_at := now() + interval '30 days';
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
        billing_cycle,
        plan_unit_limit,
        unit_limit,
        plan_duration_days,
        plan_starts_at,
        plan_expires_at,
        trial_expires_at,
        subscription_expires_at,
        plan_status,
        subscription_status,
        has_used_free_trial,
        has_used_trial
    ) values (
        new.id,
        v_full_name,
        v_phone,
        coalesce(new.email, ''),
        v_role,
        v_landlord_id,
        v_plan,
        v_plan_name,
        v_billing_cycle,
        v_unit_limit,
        v_unit_limit,
        v_duration_days,
        now(),
        v_expires_at,
        v_expires_at,
        v_expires_at,
        'active',
        'active',
        v_has_trial,
        v_has_trial
    )
    on conflict (id) do update set
        full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
        phone = case when public.profiles.phone = '' then excluded.phone else public.profiles.phone end,
        email = coalesce(excluded.email, public.profiles.email),
        role = coalesce(public.profiles.role, excluded.role),
        updated_at = now();

    -- Notify platform administrators when a new landlord registers
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
$$ language plpgsql security definer set search_path = public, auth;

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

    if p_plan in ('free', 'free_trial') and v_has_used_trial then
        return json_build_object('success', false, 'error', 'Free trial has already been used and cannot be selected again.');
    end if;

    if p_plan in ('free', 'free_trial') then
        v_plan_name := 'Free Trial (30 Days)';
        v_unit_limit := 5;
    elsif p_plan in ('tier_1_30', 'starter') then
        v_plan_name := 'Starter (1 to 30 Units)';
        v_unit_limit := 30;
    elsif p_plan in ('tier_31_60', 'growth') then
        v_plan_name := 'Growth (31 to 60 Units)';
        v_unit_limit := 60;
    elsif p_plan in ('tier_61_100', 'pro') then
        v_plan_name := 'Pro (61 to 100 Units)';
        v_unit_limit := 100;
    elsif p_plan in ('tier_100_plus', 'ultimate') then
        v_plan_name := 'Ultimate (101 to 300 Units)';
        v_unit_limit := 300;
    else
        return json_build_object('success', false, 'error', 'Invalid plan type');
    end if;

    update public.profiles
    set
        plan = case when p_plan = 'free_trial' then 'free' else p_plan end,
        plan_name = v_plan_name,
        plan_unit_limit = v_unit_limit,
        unit_limit = v_unit_limit,
        plan_starts_at = now(),
        plan_expires_at = now() + interval '30 days',
        trial_expires_at = now() + interval '30 days',
        subscription_expires_at = now() + interval '30 days',
        plan_status = 'active',
        subscription_status = 'active',
        has_used_free_trial = case when p_plan in ('free', 'free_trial') then true else v_has_used_trial end,
        has_used_trial = case when p_plan in ('free', 'free_trial') then true else v_has_used_trial end,
        updated_at = now()
    where id = v_user_id;

    return json_build_object('success', true, 'message', 'Subscription renewed successfully for 30 days');
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 8.3 Atomic Building Creation with Pre-Provisioned Vacant Units
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
        'message', format('Building "%s" created successfully with %s vacant units ready for configuration!', trim(p_name), v_units_count)
    );
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 8.4 Update Unit Specs Function
create or replace function public.update_unit_configuration(
    p_unit_id uuid,
    p_unit_number text default null,
    p_rent_amount numeric default null,
    p_parlors integer default null,
    p_rooms integer default null,
    p_bathrooms numeric default null,
    p_kitchens integer default null,
    p_notes text default null,
    p_lease_start_date date default null,
    p_rent_due_day integer default null
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
        lease_start_date = coalesce(p_lease_start_date, v_unit.lease_start_date),
        rent_due_day = coalesce(p_rent_due_day, v_unit.rent_due_day, 5),
        updated_at = now()
    where id = p_unit_id;

    return json_build_object(
        'success', true,
        'message', 'Unit modified successfully'
    );
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 8.5 Assign Tenant to Unit Function
create or replace function public.assign_unit_tenant(
    p_unit_id uuid,
    p_tenant_name text,
    p_tenant_phone text,
    p_tenant_email text,
    p_tenant_password text,
    p_tenant_access_token text,
    p_lease_start_date date default null,
    p_rent_due_day integer default 5
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
        tenant_password = case
            when trim(p_tenant_password) like '$2%' then trim(p_tenant_password)
            else crypt(trim(p_tenant_password), gen_salt('bf', 10))
        end,
        tenant_access_token = trim(p_tenant_access_token),
        tenant_assigned_at = coalesce(tenant_assigned_at, now()),
        lease_start_date = coalesce(p_lease_start_date, lease_start_date, current_date),
        rent_due_day = coalesce(p_rent_due_day, rent_due_day, 5),
        status = 'occupied',
        updated_at = now()
    where id = p_unit_id;

    return json_build_object(
        'success', true,
        'message', 'Tenant assigned and credentials created successfully'
    );
end;
$$ language plpgsql security definer set search_path = public, auth;

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
        lease_start_date = null,
        status = 'vacant',
        updated_at = now()
    where id = p_unit_id;

    return json_build_object('success', true, 'message', 'Tenant unassigned successfully');
end;
$$ language plpgsql security definer set search_path = public, auth;

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
        'lease_start_date', u.lease_start_date,
        'rent_due_day', coalesce(u.rent_due_day, 5),
        'access_token', u.tenant_access_token,
        'is_landlord_plan_expired', (
            (coalesce(p.plan_expires_at, p.trial_expires_at, p.subscription_expires_at, now()) < now())
            or coalesce(p.plan_status, p.subscription_status, 'active') = 'expired'
        ),
        'landlord_plan_expires_at', coalesce(p.plan_expires_at, p.trial_expires_at, p.subscription_expires_at),
        'landlord_plan_status', coalesce(p.plan_status, p.subscription_status, 'active')
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
$$ language plpgsql security definer set search_path = public, auth;

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
        'lease_start_date', u.lease_start_date,
        'rent_due_day', coalesce(u.rent_due_day, 5),
        'access_token', u.tenant_access_token,
        'is_landlord_plan_expired', (
            (coalesce(p.plan_expires_at, p.trial_expires_at, p.subscription_expires_at, now()) < now())
            or coalesce(p.plan_status, p.subscription_status, 'active') = 'expired'
        ),
        'landlord_plan_expires_at', coalesce(p.plan_expires_at, p.trial_expires_at, p.subscription_expires_at),
        'landlord_plan_status', coalesce(p.plan_status, p.subscription_status, 'active')
    ) into v_res
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.profiles p on p.id = u.landlord_id
    where (
        (lower(coalesce(u.tenant_email, '')) = v_clean_id and v_clean_id != '')
        or
        (length(v_clean_digits) >= 6 and regexp_replace(coalesce(u.tenant_phone, ''), '\D', '', 'g') = v_clean_digits)
    )
    and (
        -- If stored as bcrypt hash ($2a$ or $2b$)
        (u.tenant_password like '$2%' and u.tenant_password = crypt(trim(p_password), u.tenant_password))
        or
        -- Fallback for legacy plaintext passwords
        (u.tenant_password = trim(p_password))
    )
    and u.status = 'occupied'
    limit 1;

    if v_res is null then
        return json_build_object('success', false, 'error', 'Invalid email/phone or password.');
    end if;

    return json_build_object('success', true, 'data', v_res);
end;
$$ language plpgsql security definer set search_path = public, auth;

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
$$ language plpgsql security definer set search_path = public, auth;

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
$$ language plpgsql security definer set search_path = public, auth;

-- 8.11 Automated Check & Dispatch of Rent Due Reminders & Overdue Notices (Per-Unit Rent Due Day)
create or replace function public.check_and_notify_rent_due_dates()
returns json as $$
declare
    v_unit record;
    v_today_day integer;
    v_due_day integer;
    v_days_diff integer;
    v_notif_count integer := 0;
    v_already_notified boolean;
    v_is_paid boolean;
    v_current_month text;
begin
    v_today_day := extract(day from current_date)::integer;
    v_current_month := to_char(current_date, 'FMMonth YYYY');

    for v_unit in
        select
            u.id as unit_id,
            u.unit_number,
            u.rent_amount,
            coalesce(u.rent_due_day, 5) as due_day,
            u.lease_start_date,
            u.tenant_name,
            u.tenant_phone,
            u.tenant_email,
            u.landlord_id,
            b.id as building_id,
            b.name as building_name
        from public.units u
        join public.buildings b on b.id = u.building_id
        where u.status = 'occupied'
          and u.tenant_name is not null
          and trim(u.tenant_name) != ''
    loop
        v_due_day := v_unit.due_day;

        -- Check if current month is paid
        select exists (
            select 1 from public.rent_payments rp
            where rp.unit_id = v_unit.unit_id
              and rp.status = 'completed'
              and rp.balance_remaining <= 0
              and (
                  rp.rent_month ilike '%' || v_current_month || '%'
                  or v_current_month = any(rp.months_covered)
              )
        ) into v_is_paid;

        if not v_is_paid then
            v_days_diff := v_today_day - v_due_day;

            -- Case 1: Overdue (today > due_day)
            if v_days_diff > 0 then
                select exists (
                    select 1 from public.notifications n
                    where n.unit_id = v_unit.unit_id
                      and n.type = 'rent_overdue'
                      and n.created_at >= (now() - interval '3 days')
                ) into v_already_notified;

                if not v_already_notified then
                    insert into public.notifications (
                        type,
                        recipient_role,
                        landlord_id,
                        building_id,
                        building_name,
                        unit_id,
                        unit_number,
                        tenant_name,
                        amount,
                        rent_month,
                        title,
                        title_fr,
                        message,
                        message_fr,
                        metadata
                    ) values (
                        'rent_overdue',
                        'management',
                        v_unit.landlord_id,
                        v_unit.building_id,
                        v_unit.building_name,
                        v_unit.unit_id,
                        v_unit.unit_number,
                        v_unit.tenant_name,
                        v_unit.rent_amount,
                        v_current_month,
                        'Rent Overdue: ' || v_unit.tenant_name || ' (' || v_days_diff || ' days late)',
                        'Loyer en retard : ' || v_unit.tenant_name || ' (' || v_days_diff || ' j de retard)',
                        'Rent for unit ' || v_unit.unit_number || ' (' || v_unit.building_name || ') of ' || to_char(v_unit.rent_amount, 'FM999,999,999') || ' XAF was due on day ' || v_due_day || ' and is ' || v_days_diff || ' day(s) overdue.',
                        'Le loyer du logement ' || v_unit.unit_number || ' (' || v_unit.building_name || ') de ' || to_char(v_unit.rent_amount, 'FM999,999,999') || ' XAF était dû le ' || v_due_day || ' du mois et accuse ' || v_days_diff || ' jour(s) de retard.',
                        jsonb_build_object('isOverdue', true, 'daysOverdue', v_days_diff, 'dueDay', v_due_day)
                    );
                    v_notif_count := v_notif_count + 1;
                end if;

            -- Case 2: Due Soon (within 5 days before due_day)
            elsif v_days_diff >= -5 and v_days_diff <= 0 then
                select exists (
                    select 1 from public.notifications n
                    where n.unit_id = v_unit.unit_id
                      and n.type = 'rent_due_reminder'
                      and n.created_at >= (now() - interval '5 days')
                ) into v_already_notified;

                if not v_already_notified then
                    insert into public.notifications (
                        type,
                        recipient_role,
                        landlord_id,
                        building_id,
                        building_name,
                        unit_id,
                        unit_number,
                        tenant_name,
                        amount,
                        rent_month,
                        title,
                        title_fr,
                        message,
                        message_fr,
                        metadata
                    ) values (
                        'rent_due_reminder',
                        'management',
                        v_unit.landlord_id,
                        v_unit.building_id,
                        v_unit.building_name,
                        v_unit.unit_id,
                        v_unit.unit_number,
                        v_unit.tenant_name,
                        v_unit.rent_amount,
                        v_current_month,
                        'Rent Due Reminder: Unit ' || v_unit.unit_number,
                        'Rappel d''échéance : Logement ' || v_unit.unit_number,
                        'Rent for ' || v_unit.tenant_name || ' in Unit ' || v_unit.unit_number || ' is due on day ' || v_due_day || ' of this month.',
                        'Le loyer de ' || v_unit.tenant_name || ' pour le logement ' || v_unit.unit_number || ' arrive à échéance le ' || v_due_day || ' du mois.',
                        jsonb_build_object('isOverdue', false, 'daysRemaining', abs(v_days_diff), 'dueDay', v_due_day)
                    );
                    v_notif_count := v_notif_count + 1;
                end if;
            end if;
        end if;
    end loop;

    return json_build_object('success', true, 'notifications_created', v_notif_count);
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 8.12 Secure Tenant Maintenance Request Resolution
create or replace function public.resolve_tenant_maintenance_request(
    p_request_id uuid,
    p_token text
)
returns json as $$
declare
    v_unit_id uuid;
    v_req record;
begin
    -- 1. Identify unit associated with tenant access token
    select id into v_unit_id
    from public.units
    where tenant_access_token = trim(p_token) and status = 'occupied';

    if v_unit_id is null then
        return json_build_object('success', false, 'error', 'Invalid access token (Jeton locataire invalide)');
    end if;

    -- 2. Fetch maintenance request and verify ownership
    select id, unit_id, building_id, landlord_id, unit_number, building_name, title, tenant_name
    into v_req
    from public.maintenance_requests
    where id = p_request_id;

    if v_req.id is null then
        return json_build_object('success', false, 'error', 'Maintenance request not found (Demande introuvable)');
    end if;

    if v_req.unit_id <> v_unit_id then
        return json_build_object('success', false, 'error', 'Unauthorized: Request does not belong to this unit');
    end if;

    -- 3. Update status to resolved
    update public.maintenance_requests
    set
        status = 'resolved',
        updated_at = now()
    where id = p_request_id;

    -- 4. Dispatch notification to landlord and managers
    insert into public.notifications (
        type,
        recipient_role,
        landlord_id,
        building_id,
        building_name,
        unit_id,
        unit_number,
        tenant_name,
        title,
        title_fr,
        message,
        message_fr,
        metadata
    ) values (
        'maintenance_resolved',
        'management',
        v_req.landlord_id,
        v_req.building_id,
        v_req.building_name,
        v_req.unit_id,
        v_req.unit_number,
        v_req.tenant_name,
        'Repair Resolved: Unit ' || v_req.unit_number,
        'Réparation Résolue : Logement ' || v_req.unit_number,
        'Tenant ' || v_req.tenant_name || ' confirmed that the issue "' || v_req.title || '" in Unit ' || v_req.unit_number || ' has been successfully resolved.',
        'Le locataire ' || v_req.tenant_name || ' a confirmé que le problème "' || v_req.title || '" au logement ' || v_req.unit_number || ' a été résolu avec succès.',
        jsonb_build_object(
            'requestId', v_req.id,
            'status', 'resolved',
            'title', v_req.title,
            'unitNumber', v_req.unit_number
        )
    );

    return json_build_object(
        'success', true,
        'message', 'Demande de réparation marquée comme résolue avec succès !'
    );
end;
$$ language plpgsql security definer set search_path = public, auth;

-- 8.13 Atomic Landlord Subscription Upgrade & Provisioning (Security Definer)
create or replace function public.activate_landlord_subscription(
    p_landlord_id uuid,
    p_plan_id text,
    p_plan_name text,
    p_billing_cycle text,
    p_max_units integer,
    p_duration_days integer,
    p_amount_paid numeric,
    p_receipt_number text,
    p_transaction_ref text,
    p_payment_method text,
    p_payer_phone text default null,
    p_notes text default null
)
returns json as $$
declare
    v_expires_at timestamptz;
begin
    v_expires_at := now() + (greatest(coalesce(p_duration_days, 30), 1) || ' days')::interval;

    -- 1. Update public.profiles with upgraded tier, max allowance, status and expiration
    update public.profiles
    set
        plan = p_plan_id,
        plan_name = p_plan_name,
        plan_unit_limit = p_max_units,
        unit_limit = p_max_units,
        plan_duration_days = coalesce(p_duration_days, 30),
        plan_status = 'active',
        subscription_status = 'active',
        has_used_free_trial = true,
        has_used_trial = true,
        plan_starts_at = now(),
        plan_expires_at = v_expires_at,
        subscription_expires_at = v_expires_at,
        billing_cycle = coalesce(nullif(trim(p_billing_cycle), ''), 'monthly'),
        updated_at = now()
    where id = p_landlord_id;

    -- 2. Insert into public.subscriptions for complete immutable audit trail
    insert into public.subscriptions (
        receipt_number,
        landlord_id,
        plan_id,
        plan_name,
        billing_cycle,
        amount_paid,
        payment_method,
        transaction_ref,
        duration_days,
        starts_at,
        expires_at,
        status,
        payer_phone,
        notes,
        created_at
    ) values (
        p_receipt_number,
        p_landlord_id,
        p_plan_id,
        p_plan_name,
        coalesce(nullif(trim(p_billing_cycle), ''), 'monthly'),
        coalesce(p_amount_paid, 0),
        coalesce(nullif(trim(p_payment_method), ''), 'momo'),
        p_transaction_ref,
        coalesce(p_duration_days, 30),
        now(),
        v_expires_at,
        'completed',
        p_payer_phone,
        p_notes,
        now()
    )
    on conflict (receipt_number) do update set
        status = 'completed',
        expires_at = v_expires_at;

    -- 3. Insert system notification for the landlord (idempotent: only if no notification exists for this receipt)
    if not exists (
        select 1 from public.notifications
        where receipt_number = p_receipt_number
          and landlord_id = p_landlord_id
    ) then
        insert into public.notifications (
            type,
            title,
            title_fr,
            message,
            message_fr,
            recipient_role,
            landlord_id,
            receipt_number,
            metadata,
            created_at
        ) values (
            'system',
            format('Subscription %s Activated', p_plan_name),
            format('Abonnement %s Activé', p_plan_name),
            format('Your %s subscription is active until %s with allowance of %s units.', p_plan_name, v_expires_at::date, p_max_units),
            format('Votre abonnement %s est actif jusqu''au %s avec une capacité de %s logements.', p_plan_name, v_expires_at::date, p_max_units),
            'landlord',
            p_landlord_id,
            p_receipt_number,
            json_build_object(
                'plan_id', p_plan_id,
                'billing_cycle', p_billing_cycle,
                'amount', p_amount_paid,
                'max_units', p_max_units,
                'receipt_number', p_receipt_number,
                'title_en', format('Subscription %s Activated', p_plan_name),
                'title_fr', format('Abonnement %s Activé', p_plan_name),
                'message_en', format('Your %s subscription is active until %s with allowance of %s units.', p_plan_name, v_expires_at::date, p_max_units),
                'message_fr', format('Votre abonnement %s est actif jusqu''au %s avec une capacité de %s logements.', p_plan_name, v_expires_at::date, p_max_units)
            ),
            now()
        );
    end if;

    return json_build_object(
        'success', true,
        'plan', p_plan_id,
        'plan_unit_limit', p_max_units,
        'expires_at', v_expires_at,
        'receipt_number', p_receipt_number
    );
exception
    when others then
        return json_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer set search_path = public, auth;

grant execute on function public.activate_landlord_subscription to authenticated, anon, service_role;

-- ==============================================================================
-- PHASE 9: Auth Users Trigger (Safely Wrapped)
-- ==============================================================================

do $$
begin
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_landlord();
exception
    when others then
        raise notice 'Trigger on auth.users skipped (may require superuser or already attached): %', sqlerrm;
end;
$$;


-- ==============================================================================
-- PHASE 10: Permissions & Execution Grants
-- ==============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public.buildings to anon, authenticated, service_role;
grant select, insert, update, delete on table public.units to anon, authenticated, service_role;
grant select, insert, update, delete on table public.maintenance_requests to anon, authenticated, service_role;
grant select, insert, update, delete on table public.rent_payments to anon, authenticated, service_role;
grant select, insert, update, delete on table public.notifications to anon, authenticated, service_role;
grant select, insert, update, delete on table public.subscriptions to anon, authenticated, service_role;

grant all on all sequences in schema public to anon, authenticated, service_role;

grant execute on all functions in schema public to anon, authenticated, service_role;


-- ==============================================================================
-- PHASE 11: Realtime Publication Setup
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
        alter table public.subscriptions replica identity full;
    exception when others then
        raise notice 'Replica identity notice: %', sqlerrm;
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

    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'subscriptions') then
        alter publication supabase_realtime add table public.subscriptions;
    end if;
exception
    when others then
        raise notice 'Realtime publication setup notice: %', sqlerrm;
end;
$$;


-- ==============================================================================
-- PHASE 11.5: Hardened Supabase Storage Buckets & Policies (Private Buckets & Receipts)
-- ==============================================================================

do $$
begin
    if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
        -- 1. Hardened Private Bucket: maintenance-media
        -- Switched to public = false (Private bucket requiring Signed URLs)
        insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        values (
            'maintenance-media',
            'maintenance-media',
            false, -- Strictly Private Bucket
            52428800, -- 50 MB limit
            array[
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'video/mp4', 'video/webm', 'video/quicktime',
                'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav',
                'application/pdf'
            ]
        )
        on conflict (id) do update set
            public = false,
            file_size_limit = 52428800,
            allowed_mime_types = array[
                'image/jpeg', 'image/png', 'image/webp', 'image/gif',
                'video/mp4', 'video/webm', 'video/quicktime',
                'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav',
                'application/pdf'
            ];

        -- 2. New Dedicated Private Bucket: receipts
        -- Securely stores user rent payment receipts & landlord subscription receipts
        insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        values (
            'receipts',
            'receipts',
            false, -- Strictly Private Bucket
            10485760, -- 10 MB limit
            array[
                'application/pdf',
                'image/png',
                'image/jpeg',
                'image/webp'
            ]
        )
        on conflict (id) do update set
            public = false,
            file_size_limit = 10485760,
            allowed_mime_types = array[
                'application/pdf',
                'image/png',
                'image/jpeg',
                'image/webp'
            ];

        -- ======================================================================
        -- Policies for maintenance-media Bucket
        -- ======================================================================
        drop policy if exists "Maintenance media public select" on storage.objects;
        drop policy if exists "Maintenance media authenticated select" on storage.objects;
        drop policy if exists "Maintenance media upload" on storage.objects;
        drop policy if exists "Maintenance media delete" on storage.objects;

        -- Authenticated users and tenants can read maintenance media (or via Signed URLs)
        create policy "Maintenance media authenticated select"
            on storage.objects for select
            using (bucket_id = 'maintenance-media' and (auth.role() = 'authenticated' or auth.role() = 'anon'));

        -- Authenticated and anon users (tenants submitting maintenance tickets) can upload media
        create policy "Maintenance media upload"
            on storage.objects for insert
            with check (
                bucket_id = 'maintenance-media'
                and (
                    (storage.foldername(name))[1] in ('photos', 'videos', 'voices', 'documents')
                )
            );

        -- Only landlord owners, file owners, or super-admins can delete maintenance media
        create policy "Maintenance media delete"
            on storage.objects for delete
            using (
                bucket_id = 'maintenance-media'
                and (
                    public.is_admin()
                    or (auth.role() = 'authenticated' and owner = auth.uid())
                )
            );

        -- ======================================================================
        -- Policies for receipts Bucket (Rent Receipts & Plan Subscriptions)
        -- ======================================================================
        drop policy if exists "Receipts authenticated select" on storage.objects;
        drop policy if exists "Receipts upload" on storage.objects;
        drop policy if exists "Receipts delete" on storage.objects;

        -- Select: Super-Admins, Landlords, Managers, or via Signed URLs
        create policy "Receipts authenticated select"
            on storage.objects for select
            using (
                bucket_id = 'receipts'
                and (
                    public.is_admin()
                    or auth.role() = 'authenticated'
                    or auth.role() = 'service_role'
                )
            );

        -- Insert: Authenticated users (landlords, managers) and service role
        create policy "Receipts upload"
            on storage.objects for insert
            with check (
                bucket_id = 'receipts'
                and (
                    (storage.foldername(name))[1] in ('rent', 'subscriptions', 'plans')
                )
                and (
                    auth.role() = 'authenticated'
                    or auth.role() = 'service_role'
                )
            );

        -- Delete: Protected financial audit records - Only Super-Admins or owner
        create policy "Receipts delete"
            on storage.objects for delete
            using (
                bucket_id = 'receipts'
                and (
                    public.is_admin()
                    or auth.uid() = owner
                )
            );

    end if;
exception
    when others then
        raise notice 'Storage bucket setup notice: %', sqlerrm;
end;
$$;


-- ==============================================================================
-- PHASE 12: Reload PostgREST Schema Cache
-- ==============================================================================

notify pgrst, 'reload schema';

