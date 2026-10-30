-- ==============================================================================
-- MIGRATION: Fix Infinite Recursion in public.profiles RLS Policies (ERROR 42P17)
-- ==============================================================================
-- Run this script directly in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run)
--
-- Root cause fixed:
--   "Profiles select policy" previously contained an inline SQL subquery against
--   public.profiles:
--     `or id = (select p.landlord_id from public.profiles p where p.id = auth.uid())`
--   Because inline subqueries run under the caller's role rather than a
--   SECURITY DEFINER function, PostgreSQL recursively re-applied RLS on
--   public.profiles and aborted SELECT & UPDATE queries with HTTP 500:
--     `infinite recursion detected in policy for relation "profiles"`
-- ==============================================================================

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

-- 4. Ensure multi-tenant isolation triggers execute as SECURITY DEFINER
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
$$ language plpgsql security definer set search_path = public, auth;

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
$$ language plpgsql security definer set search_path = public, auth;

create or replace function public.enforce_maintenance_status_rules()
returns trigger as $$
declare
    v_updater_role text;
begin
    if new.status = 'resolved' and (old.status is null or old.status <> 'resolved') then
        if auth.uid() is not null then
            select role into v_updater_role from public.profiles where id = auth.uid();
            if v_updater_role in ('landlord', 'manager') and not public.is_admin() then
                raise exception 'Only the tenant can mark a reparation request as resolved (Seul le locataire peut marquer sa demande de réparation comme résolue).';
            end if;
        end if;
    end if;
    return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

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
$$ language plpgsql security definer set search_path = public, auth;

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
$$ language plpgsql security definer set search_path = public, auth;

-- 5. SECURITY DEFINER Profile RPCs (RLS-immune self-profile read & phone update)
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

grant execute on function public.get_my_profile() to authenticated, service_role;
grant execute on function public.update_my_profile_phone(text) to authenticated, service_role;

notify pgrst, 'reload schema';

