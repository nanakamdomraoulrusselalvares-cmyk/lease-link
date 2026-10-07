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
