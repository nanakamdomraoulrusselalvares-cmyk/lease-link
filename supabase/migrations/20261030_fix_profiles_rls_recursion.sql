-- ==============================================================================
-- MIGRATION: Backfill Missing Columns & Fix public.profiles RLS Recursion (42P17 / 42703)
-- ==============================================================================
-- Run this script directly in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run)
--
-- 100% IDEMPOTENT & SAFE ON EXISTING DATABASES:
--   1. Adds any missing columns (including `landlord_id`, `role`, `assigned_building_ids`,
--      `phone`, and subscription plan columns) on `public.profiles` and related tables
--      BEFORE creating functions or RLS policies (fixes ERROR 42703).
--   2. Dynamically drops all recursive policies on `public.profiles` and replaces them
--      with non-recursive SECURITY DEFINER helpers (fixes ERROR 42P17).
-- ==============================================================================

set check_function_bodies = false;

-- 0. Ensure public.profiles exists and has ALL required columns (including landlord_id)
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade
);

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

-- Safely ensure landlord_id also exists on any pre-existing portfolio tables
do $$
begin
    if to_regclass('public.buildings') is not null then
        alter table public.buildings add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
    end if;
    if to_regclass('public.units') is not null then
        alter table public.units add column if not exists building_id uuid references public.buildings(id) on delete cascade;
        alter table public.units add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
    end if;
    if to_regclass('public.maintenance_requests') is not null then
        alter table public.maintenance_requests add column if not exists unit_id uuid references public.units(id) on delete cascade;
        alter table public.maintenance_requests add column if not exists building_id uuid references public.buildings(id) on delete cascade;
        alter table public.maintenance_requests add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
    end if;
    if to_regclass('public.rent_payments') is not null then
        alter table public.rent_payments add column if not exists unit_id uuid references public.units(id) on delete cascade;
        alter table public.rent_payments add column if not exists building_id uuid references public.buildings(id) on delete cascade;
        alter table public.rent_payments add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
    end if;
    if to_regclass('public.notifications') is not null then
        alter table public.notifications add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
        alter table public.notifications add column if not exists building_id uuid references public.buildings(id) on delete cascade;
        alter table public.notifications add column if not exists unit_id uuid references public.units(id) on delete cascade;
    end if;
    if to_regclass('public.subscriptions') is not null then
        alter table public.subscriptions add column if not exists landlord_id uuid references public.profiles(id) on delete cascade;
    end if;
end;
$$;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_landlord_id on public.profiles(landlord_id);

-- 1. Ensure SECURITY DEFINER helper functions bypass RLS cleanly (owned by postgres)
alter table public.profiles no force row level security;
alter table public.profiles enable row level security;

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

-- 2. Dynamically drop ALL existing policies on public.profiles (including any legacy names)
do $$
declare
    v_pol record;
begin
    for v_pol in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
    loop
        execute format('drop policy if exists %I on public.profiles', v_pol.policyname);
    end loop;
end;
$$;

-- 3. Recreate clean, non-recursive RLS policies on public.profiles
create policy "Profiles select policy"
    on public.profiles for select
    using (
        auth.uid() is not null and (
            auth.uid() = id
            or landlord_id = auth.uid()
            or id = public.get_auth_landlord_id()
            or public.is_admin()
        )
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

-- 4. SECURITY DEFINER Profile RPCs (RLS-immune self-profile read & phone update)
create or replace function public.get_my_profile()
returns json as $$
declare
    v_uid uuid;
    v_profile public.profiles%rowtype;
    v_auth_user record;
begin
    v_uid := auth.uid();
    if v_uid is null then
        return json_build_object('success', false, 'error', 'Not authenticated');
    end if;

    select * into v_profile from public.profiles where id = v_uid;

    if v_profile.id is null then
        select id, email, raw_user_meta_data into v_auth_user
        from auth.users
        where id = v_uid;

        if v_auth_user.id is not null then
            insert into public.profiles (
                id,
                email,
                full_name,
                phone,
                role
            ) values (
                v_uid,
                coalesce(v_auth_user.email, ''),
                coalesce(v_auth_user.raw_user_meta_data->>'full_name', v_auth_user.raw_user_meta_data->>'name', ''),
                coalesce(v_auth_user.raw_user_meta_data->>'phone', ''),
                coalesce(v_auth_user.raw_user_meta_data->>'role', 'landlord')
            )
            on conflict (id) do update set
                updated_at = now()
            returning * into v_profile;
        end if;
    end if;

    return json_build_object('success', true, 'profile', row_to_json(v_profile));
end;
$$ language plpgsql security definer set search_path = public, auth;

create or replace function public.update_my_profile_phone(p_phone text)
returns json as $$
declare
    v_uid uuid;
    v_clean_phone text;
    v_profile public.profiles%rowtype;
    v_auth_user record;
begin
    v_uid := auth.uid();
    if v_uid is null then
        return json_build_object('success', false, 'error', 'Not authenticated');
    end if;

    v_clean_phone := trim(coalesce(p_phone, ''));
    if v_clean_phone = '' then
        return json_build_object('success', false, 'error', 'Phone number is required');
    end if;

    update public.profiles
    set
        phone = v_clean_phone,
        updated_at = now()
    where id = v_uid
    returning * into v_profile;

    if v_profile.id is null then
        select id, email, raw_user_meta_data into v_auth_user
        from auth.users
        where id = v_uid;

        insert into public.profiles (
            id,
            email,
            full_name,
            phone,
            role
        ) values (
            v_uid,
            coalesce(v_auth_user.email, ''),
            coalesce(v_auth_user.raw_user_meta_data->>'full_name', v_auth_user.raw_user_meta_data->>'name', ''),
            v_clean_phone,
            coalesce(v_auth_user.raw_user_meta_data->>'role', 'landlord')
        )
        on conflict (id) do update set
            phone = excluded.phone,
            updated_at = now()
        returning * into v_profile;
    end if;

    return json_build_object('success', true, 'profile', row_to_json(v_profile));
end;
$$ language plpgsql security definer set search_path = public, auth;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.get_auth_landlord_id() to anon, authenticated, service_role;
grant execute on function public.can_access_landlord_portfolio(uuid) to anon, authenticated, service_role;
grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.update_my_profile_phone(text) to authenticated, service_role;

notify pgrst, 'reload schema';
