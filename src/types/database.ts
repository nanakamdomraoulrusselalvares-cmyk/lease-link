export type SubscriptionPlanId = 'free' | 'tier_1_30' | 'tier_31_60' | 'tier_61_100';

export interface PlanConfig {
  id: SubscriptionPlanId;
  name: string;
  nameFr?: string;
  tagline: string;
  taglineFr?: string;
  unitRange: string;
  maxUnits: number;
  durationDays: number;
  isFreeTrial: boolean;
  badge?: string;
  badgeFr?: string;
}

export const AVAILABLE_PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free Trial',
    nameFr: 'Essai Gratuit',
    tagline: 'Get started and test features for 30 days',
    taglineFr: 'Commencez et testez les fonctionnalités pendant 30 jours',
    unitRange: 'Up to 5 units',
    maxUnits: 5,
    durationDays: 30,
    isFreeTrial: true,
    badge: '1-Time Only',
    badgeFr: 'Offre Unique',
  },
  {
    id: 'tier_1_30',
    name: 'Starter Plan',
    nameFr: 'Formule Starter',
    tagline: 'Ideal for single buildings or duplexes',
    taglineFr: 'Idéal pour petits immeubles ou duplex',
    unitRange: '1 - 30 units',
    maxUnits: 30,
    durationDays: 30,
    isFreeTrial: false,
    badge: 'Popular',
    badgeFr: 'Populaire',
  },
  {
    id: 'tier_31_60',
    name: 'Growth Plan',
    nameFr: 'Formule Croissance',
    tagline: 'For landlords managing mid-sized portfolios',
    taglineFr: 'Pour les bailleurs gérant des patrimoines moyens',
    unitRange: '31 - 60 units',
    maxUnits: 60,
    durationDays: 30,
    isFreeTrial: false,
  },
  {
    id: 'tier_61_100',
    name: 'Pro Portfolio',
    nameFr: 'Formule Pro',
    tagline: 'Full-scale property operations and multi-building scale',
    taglineFr: 'Gestion intégrale multi-immeubles à grande échelle',
    unitRange: '61 - 100 units',
    maxUnits: 100,
    durationDays: 30,
    isFreeTrial: false,
    badge: 'Max Scale',
    badgeFr: 'Capacité Max',
  },
];

export type UserRole = 'landlord' | 'manager';

export interface ManagerProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role: 'manager';
  landlord_id: string;
  assigned_building_ids?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface CreateManagerInput {
  full_name: string;
  email: string;
  phone: string;
  password?: string;
  assigned_building_ids?: string[];
}

export interface LandlordProfile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  role: UserRole;
  landlord_id?: string | null;
  assigned_building_ids?: string[] | null;
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
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_email?: string | null;
  tenant_password?: string | null;
  tenant_access_token?: string | null;
  tenant_assigned_at?: string | null;
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
  tenant_name?: string | null;
  tenant_phone?: string | null;
  tenant_email?: string | null;
  tenant_password?: string | null;
  tenant_access_token?: string | null;
  status?: UnitStatus;
}

export interface TenantPortalData {
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  unit_id: string;
  unit_number: string;
  rent_amount: number;
  parlors: number;
  rooms: number;
  bathrooms: number;
  kitchens: number;
  notes?: string | null;
  building_id: string;
  building_name: string;
  building_address: string;
  building_city?: string | null;
  landlord_id: string;
  landlord_name: string;
  landlord_phone: string;
  landlord_email: string;
  assigned_at?: string | null;
  access_token: string;
}

export interface TenantSession {
  token: string;
  portalData: TenantPortalData;
  authenticatedAt: string;
}

// ============================================================================
// Maintenance & Reparation Request Types
// ============================================================================
export type MaintenanceCategory =
  | "plumbing"
  | "electrical"
  | "structural"
  | "appliances"
  | "carpentry_locks"
  | "other";

export type MaintenanceUrgency = "low" | "medium" | "high" | "emergency";

export type MaintenanceStatus = "pending" | "in_progress" | "resolved" | "rejected";

export interface MaintenanceRequest {
  id: string;
  unit_id: string;
  building_id: string;
  landlord_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string | null;
  unit_number: string;
  building_name: string;
  category: MaintenanceCategory;
  urgency: MaintenanceUrgency;
  title: string;
  description: string;
  status: MaintenanceStatus;
  photo_url?: string | null;
  video_url?: string | null;
  voice_url?: string | null;
  voice_duration_seconds?: number | null;
  landlord_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMaintenanceInput {
  unit_id: string;
  building_id: string;
  landlord_id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string | null;
  unit_number: string;
  building_name: string;
  category: MaintenanceCategory;
  urgency: MaintenanceUrgency;
  title: string;
  description: string;
  photo_url?: string | null;
  video_url?: string | null;
  voice_url?: string | null;
  voice_duration_seconds?: number | null;
}

export interface UpdateMaintenanceStatusInput {
  status: MaintenanceStatus;
  landlord_notes?: string | null;
}

// ============================================================================
// Rent Payments & Receipts Types
// ============================================================================
export type PaymentMethod =
  | 'momo'
  | 'orange_money'
  | 'card'
  | 'bank_transfer'
  | 'cash';

export type PaymentType = 'full' | 'partial';

export type PaymentStatus = 'completed' | 'pending' | 'failed';

export interface RentPayment {
  id: string;
  receipt_number: string;
  unit_id: string;
  building_id: string;
  landlord_id: string;
  landlord_name?: string | null;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string | null;
  unit_number: string;
  building_name: string;
  rent_month: string; // e.g. "October 2026" or "October 2026 - November 2026"
  months_count?: number; // Number of months covered (default 1)
  months_covered?: string[]; // Specific list of months covered
  monthly_rent_amount: number;
  amount_paid: number;
  balance_remaining: number; // remaining for this month/cycle
  payment_type: PaymentType;
  payment_method: PaymentMethod;
  transaction_ref: string;
  status: PaymentStatus;
  payer_phone?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantRentStatus {
  unit_id: string;
  unit_number: string;
  building_id: string;
  building_name: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string | null;
  monthly_rent: number;
  current_month: string;
  amount_paid_current_month: number;
  balance_owing_current_month: number;
  is_owing: boolean;
  is_late: boolean;
  days_late: number;
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';
  advance_months_paid?: string[]; // Any future months already settled in advance
  last_payment_date?: string | null;
  last_receipt_number?: string | null;
  payments: RentPayment[];
}

export interface CreateRentPaymentInput {
  unit_id: string;
  building_id: string;
  landlord_id: string;
  landlord_name?: string | null;
  tenant_name: string;
  tenant_phone: string;
  tenant_email?: string | null;
  unit_number: string;
  building_name: string;
  rent_month: string;
  months_count?: number;
  months_covered?: string[];
  monthly_rent_amount: number;
  amount_paid: number;
  payment_method: PaymentMethod;
  payer_phone?: string | null;
  notes?: string | null;
}

// ============================================================================
// Notifications Types
// ============================================================================
export type NotificationType =
  | 'payment_received'
  | 'tenant_arrived'
  | 'tenant_departed'
  | 'maintenance_update'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  title_fr?: string;
  message: string;
  message_fr?: string;
  recipient_role: 'landlord' | 'tenant' | 'building_community';
  landlord_id?: string | null;
  building_id?: string | null;
  building_name?: string | null;
  unit_id?: string | null;
  unit_number?: string | null;
  tenant_name?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  receipt_number?: string | null;
  rent_month?: string | null;
  is_read: boolean;
  read_by?: string[]; // IDs of users or tenant units that have acknowledged this
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  title_fr?: string;
  message: string;
  message_fr?: string;
  recipient_role: 'landlord' | 'tenant' | 'building_community';
  landlord_id?: string | null;
  building_id?: string | null;
  building_name?: string | null;
  unit_id?: string | null;
  unit_number?: string | null;
  tenant_name?: string | null;
  amount?: number | null;
  payment_method?: string | null;
  receipt_number?: string | null;
  rent_month?: string | null;
  metadata?: Record<string, unknown>;
}
