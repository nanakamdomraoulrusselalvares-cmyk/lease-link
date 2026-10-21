export type SubscriptionPlanId =
  | 'free'
  | 'tier_1_30'
  | 'tier_31_60'
  | 'tier_61_100'
  | 'tier_100_plus'
  | 'ultimate';

export type BillingCycle = 'monthly' | 'annual';

export interface PlanConfig {
  id: SubscriptionPlanId;
  name: string;
  nameFr: string;
  tagline: string;
  taglineFr: string;
  target: string;
  targetFr: string;
  unitRange: string;
  unitRangeFr: string;
  maxUnits: number;
  monthlyPrice: number;
  annualPrice: number | null;
  monthlyPriceDisplay: string;
  annualPriceDisplay: string;
  annualSavings?: string;
  annualSavingsFr?: string;
  durationDays: number;
  durationDaysAnnual: number;
  isFreeTrial: boolean;
  badge?: string;
  badgeFr?: string;
}

export const AVAILABLE_PLANS: PlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    nameFr: 'Gratuit',
    tagline: 'Lead magnet / owners on trial',
    taglineFr: 'Pour découvrir et tester LeaseLink sans aucun engagement',
    target: 'Lead magnet / owners on trial',
    targetFr: 'Propriétaires en phase de test',
    unitRange: 'Up to 5 units',
    unitRangeFr: 'Jusqu\'à 5 logements',
    maxUnits: 5,
    monthlyPrice: 0,
    annualPrice: null,
    monthlyPriceDisplay: '0 FCFA',
    annualPriceDisplay: '—',
    durationDays: 30,
    durationDaysAnnual: 30,
    isFreeTrial: true,
    badge: 'Trial',
    badgeFr: 'Essai',
  },
  {
    id: 'tier_1_30',
    name: 'Starter',
    nameFr: 'Starter',
    tagline: 'Individual owners / small landlords',
    taglineFr: 'Idéal pour propriétaires individuels et petits immeubles',
    target: 'Individual owners / small landlords',
    targetFr: 'Propriétaires particuliers / Petits bailleurs',
    unitRange: '1 to 30 units',
    unitRangeFr: '1 à 30 logements',
    maxUnits: 30,
    monthlyPrice: 9900,
    annualPrice: 100800,
    monthlyPriceDisplay: '9,900 FCFA',
    annualPriceDisplay: '100,800 FCFA',
    annualSavings: 'Save 18,000 FCFA / yr',
    annualSavingsFr: 'Économisez 18 000 FCFA / an',
    durationDays: 30,
    durationDaysAnnual: 365,
    isFreeTrial: false,
    badge: 'Popular',
    badgeFr: 'Populaire',
  },
  {
    id: 'tier_31_60',
    name: 'Growth',
    nameFr: 'Growth',
    tagline: 'Mid-sized property owners',
    taglineFr: 'Pour bailleurs et gestionnaires avec patrimoine en expansion',
    target: 'Mid-sized property owners',
    targetFr: 'Propriétaires de parcs moyens',
    unitRange: '31 to 60 units',
    unitRangeFr: '31 à 60 logements',
    maxUnits: 60,
    monthlyPrice: 18900,
    annualPrice: 200800,
    monthlyPriceDisplay: '18,900 FCFA',
    annualPriceDisplay: '200,800 FCFA',
    annualSavings: 'Save 26,000 FCFA / yr',
    annualSavingsFr: 'Économisez 26 000 FCFA / an',
    durationDays: 30,
    durationDaysAnnual: 365,
    isFreeTrial: false,
    badge: 'Best Value',
    badgeFr: 'Recommandé',
  },
  {
    id: 'tier_61_100',
    name: 'Pro',
    nameFr: 'Pro',
    tagline: 'Large real estate investors',
    taglineFr: 'Gestion intégrale multi-immeubles à grande échelle',
    target: 'Large real estate investors',
    targetFr: 'Grands investisseurs immobiliers',
    unitRange: '61 to 100 units',
    unitRangeFr: '61 à 100 logements',
    maxUnits: 100,
    monthlyPrice: 36900,
    annualPrice: 400800,
    monthlyPriceDisplay: '36,900 FCFA',
    annualPriceDisplay: '400,800 FCFA',
    annualSavings: 'Save 42,000 FCFA / yr',
    annualSavingsFr: 'Économisez 42 000 FCFA / an',
    durationDays: 30,
    durationDaysAnnual: 365,
    isFreeTrial: false,
    badge: 'High Scale',
    badgeFr: 'Haute Capacité',
  },
  {
    id: 'tier_100_plus',
    name: 'Ultimate',
    nameFr: 'Ultimate',
    tagline: 'Enterprise asset managers (101 to 300 units)',
    taglineFr: 'Pour foncières, syndics et grands parcs de 101 à 300 logements',
    target: 'Enterprise asset managers (101 to 300 units)',
    targetFr: 'Gestionnaires d\'actifs & Syndics (101 à 300 logements)',
    unitRange: '101 to 300 units',
    unitRangeFr: '101 à 300 logements',
    maxUnits: 300,
    monthlyPrice: 100900,
    annualPrice: 1110800,
    monthlyPriceDisplay: '100,900 FCFA',
    annualPriceDisplay: '1,110,800 FCFA',
    annualSavings: 'Save 100,000 FCFA / yr',
    annualSavingsFr: 'Économisez 100 000 FCFA / an',
    durationDays: 30,
    durationDaysAnnual: 365,
    isFreeTrial: false,
    badge: 'Enterprise',
    badgeFr: 'Entreprise',
  },
];

export type UserRole = 'landlord' | 'manager' | 'admin';

export interface AdminStats {
  total_landlords: number;
  total_managers: number;
  total_tenants: number;
  total_buildings: number;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  occupancy_rate: number;
  total_volume_xaf: number;
  total_payments_count: number;
  total_maintenance_requests: number;
  pending_maintenance_requests: number;
  emergency_maintenance_requests: number;
  plan_distribution: Record<string, number>;
  cash_volume_xaf: number;
  digital_volume_xaf: number;
}

export interface AdminManagerSummary {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  landlord_id: string;
  landlord_name: string;
  assigned_building_ids: string[];
  assigned_building_names: string[];
  created_at: string;
}

export interface AdminTenantSummary {
  id: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  building_id: string;
  building_name: string;
  unit_id: string;
  unit_number: string;
  rent_amount: number;
  landlord_id: string;
  landlord_name: string;
  status: string;
  created_at: string;
}

export interface AdminLandlordSummary {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  plan: SubscriptionPlanId;
  plan_name: string;
  billing_cycle?: BillingCycle;
  plan_status: string;
  plan_unit_limit: number;
  buildings_count: number;
  units_count: number;
  occupied_units_count: number;
  managers_count: number;
  total_revenue_collected_xaf: number;
  created_at: string;
}

export interface AdminActivityEvent {
  id: string;
  type: 'payment' | 'signup' | 'maintenance' | 'manager_created' | 'unit_added';
  title: string;
  description: string;
  actor_name: string;
  actor_role: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AdminGlobalTransaction {
  id: string;
  receipt_number: string;
  amount_paid: number;
  rent_month: string;
  payment_method: PaymentMethod;
  tenant_name: string;
  tenant_phone: string;
  building_name: string;
  unit_number: string;
  landlord_name: string;
  landlord_id: string;
  created_at: string;
  notes?: string | null;
  months_covered?: string[] | null;
}

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
  assigned_building_ids?: string[] | null;
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
  billing_cycle?: BillingCycle;
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
  | 'commercial'
  | 'residential'
  | 'mixed_use'
  | 'other'
  | 'apartment'
  | 'duplex';

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
  lease_start_date?: string | null;
  rent_due_day?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBuildingFormInput {
  name: string;
  address: string;
  city: string;
  state_region: string;
  property_type: PropertyType;
  total_units: number | string;
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
  lease_start_date?: string | null;
  rent_due_day?: number | null;
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
  lease_start_date?: string | null;
  rent_due_day?: number | null;
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
  rent_due_day?: number;
  days_until_due?: number;
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
  | 'landlord_registered'
  | 'maintenance_update'
  | 'rent_due_reminder'
  | 'rent_overdue'
  | 'broadcast_reminder'
  | 'system';

export type NotificationRecipientRole =
  | 'landlord'
  | 'manager'
  | 'management'
  | 'tenant'
  | 'building_community'
  | 'admin';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  title_fr?: string;
  message: string;
  message_fr?: string;
  recipient_role: NotificationRecipientRole;
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
  recipient_role: NotificationRecipientRole;
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

