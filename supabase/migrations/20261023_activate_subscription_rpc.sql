-- ==============================================================================
-- LEASELINK: ACTIVATE LANDLORD SUBSCRIPTION RPC & RLS POLICY
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run)
--
-- This function allows instant, atomic activation of landlord subscriptions
-- with elevated permissions (security definer), ensuring that both profiles
-- and subscriptions tables are updated regardless of RLS restrictions.
-- ==============================================================================

-- 1. Ensure public.subscriptions insert policy permits server-side/anon insertion
drop policy if exists "Subscriptions insert policy" on public.subscriptions;
create policy "Subscriptions insert policy"
    on public.subscriptions for insert
    with check (
        auth.uid() = landlord_id or public.is_admin() or auth.role() = 'anon'
    );

-- 2. Atomic Landlord Subscription Upgrade & Provisioning (Security Definer)
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

    -- A. Update public.profiles with upgraded tier, max allowance, status and expiration
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

    -- B. Insert into public.subscriptions for complete immutable audit trail
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

    -- C. Insert system notification for the landlord
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
        'Subscription Activated',
        'Abonnement Activé',
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
            'receipt_number', p_receipt_number
        ),
        now()
    );

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

-- 3. Grant execute permissions to all roles
grant execute on function public.activate_landlord_subscription to authenticated, anon, service_role;

-- 4. Reload schema cache
notify pgrst, 'reload schema';
