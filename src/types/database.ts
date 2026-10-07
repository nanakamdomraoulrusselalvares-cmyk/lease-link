export type SubscriptionPlanId = 'free' | 'tier_1_30' | 'tier_31_60' | 'tier_61_100';

export interface PlanConfig {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  unitRange: string;
  maxUnits: number;
  durationDays: number;
  isFreeTrial: boolean;
  badge?: string;
}

export const AVAILABLE_PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free Trial',
    tagline: 'Get started and test features for 30 days',
    unitRange: 'Up to 5 units',
    maxUnits: 5,
    durationDays: 30,
    isFreeTrial: true,
    badge: '1-Time Only',
  },
  {
    id: 'tier_1_30',
    name: 'Starter Plan',
    tagline: 'Ideal for single buildings or duplexes',
    unitRange: '1 - 30 units',
    maxUnits: 30,
    durationDays: 30,
    isFreeTrial: false,
    badge: 'Popular',
  },
  {
    id: 'tier_31_60',
    name: 'Growth Plan',
    tagline: 'For landlords managing mid-sized portfolios',
    unitRange: '31 - 60 units',
    maxUnits: 60,
    durationDays: 30,
    isFreeTrial: false,
  },
  {
    id: 'tier_61_100',
    name: 'Pro Portfolio',
    tagline: 'Full-scale property operations and multi-building scale',
    unitRange: '61 - 100 units',
    maxUnits: 100,
    durationDays: 30,
    isFreeTrial: false,
    badge: 'Max Scale',
  },
];

export interface LandlordProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role: 'landlord';
  plan: SubscriptionPlanId;
  plan_name: string;
  plan_unit_limit: number;
  plan_duration_days: number;
  plan_starts_at: string;
  plan_expires_at: string;
  plan_status: 'active' | 'expired' | 'renewed';
  has_used_free_trial: boolean;
  created_at: string;
  updated_at: string;
}
