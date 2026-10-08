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

export type UnitStatus = 'vacant' | 'occupied' | 'maintenance';

export type PropertyType =
  | 'apartment'
  | 'residential'
  | 'commercial'
  | 'mixed_use'
  | 'duplex'
  | 'other';

export interface Building {
  id: string;
  landlord_id: string;
  name: string;
  address: string;
  city?: string | null;
  state_region?: string | null;
  country?: string | null;
  postal_code?: string | null;
  property_type: PropertyType;
  total_floors?: number | null;
  total_units: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
  units?: Unit[];
}

export interface Unit {
  id: string;
  building_id: string;
  landlord_id: string;
  unit_number: string;
  floor?: number | null;
  status: UnitStatus;
  rent_amount: number;
  deposit_amount?: number;
  parlors: number;
  rooms: number;
  bathrooms: number;
  kitchens: number;
  bedrooms?: number;
  size_sqft?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBuildingFormInput {
  name: string;
  address: string;
  city: string;
  state_region: string;
  property_type: PropertyType;
  total_units: number;
  unit_prefix: string;
  description: string;
}

export interface UpdateUnitInput {
  unit_number?: string;
  rent_amount: number;
  parlors: number;
  rooms: number;
  bathrooms: number;
  kitchens: number;
  notes?: string | null;
}


