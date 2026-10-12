export type Language = "en" | "fr";

export interface Translations {
  // Common / Navigation
  brandName: string;
  dashboard: string;
  buildingsAndUnits: string;
  tenantCredentials: string;
  rentPaymentsAndLedgers: string;
  repairs: string;
  repairsAndMaintenance: string;
  tenantPortal: string;
  tenantSpace: string;
  landlordSignIn: string;
  getStarted: string;
  signOut: string;
  signingOut: string;
  backToDashboard: string;
  sync: string;
  refresh: string;
  refreshing: string;
  save: string;
  saving: string;
  cancel: string;
  confirm: string;
  delete: string;
  edit: string;
  close: string;
  loading: string;
  search: string;
  filter: string;
  all: string;
  view: string;
  viewAll: string;
  copied: string;
  copy: string;
  whatsapp: string;
  call: string;
  done: string;
  status: string;
  actions: string;
  notes: string;
  optional: string;
  yes: string;
  no: string;
  currency: string;
  month: string;
  months: string;
  emptyStateNoData: string;

  // Status badges
  statusPaid: string;
  statusPartial: string;
  statusUnpaid: string;
  statusOwing: string;
  statusOverdue: string;
  statusVacant: string;
  statusOccupied: string;
  statusMaintenance: string;
  statusPending: string;
  statusInProgress: string;
  statusResolved: string;
  statusRejected: string;

  // Property types
  propertyApartment: string;
  propertyStudio: string;
  propertyVilla: string;
  propertyCommercial: string;

  // Units specifications
  unitNumber: string;
  floor: string;
  parlors: string;
  rooms: string;
  bedrooms: string;
  bathrooms: string;
  kitchens: string;
  monthlyRent: string;
  depositAmount: string;
  agreedRent: string;

  // Home Page
  homeHeroBadge: string;
  homeHeroTitle1: string;
  homeHeroTitle2: string;
  homeHeroDescription: string;
  homeStartTrial: string;
  homeFeaturePWA: string;
  homeFeaturePWADesc: string;
  homeFeatureTickets: string;
  homeFeatureTicketsDesc: string;
  homeFeatureReceipts: string;
  homeFeatureReceiptsDesc: string;
  homeFeatureMultiTenant: string;
  homeFeatureMultiTenantDesc: string;

  // Landlord Dashboard Home (/dashboard)
  dashWelcome: string;
  dashWelcomeSub: string;
  dashManageBuildings: string;
  dashPublicHome: string;
  dashLandlordProfile: string;
  dashAuthenticated: string;
  dashFullName: string;
  dashEmail: string;
  dashPhone: string;
  dashRegisteredOn: string;
  dashUserId: string;
  dashSubscriptionTier: string;
  dashPlanActive: string;
  dashCapacity: string;
  dashUsedUnits: string;
  dashRenewalDate: string;
  dashOccupiedUnits: string;
  dashVacantUnits: string;
  dashUpgradePlan: string;
  dashPendingRepairs: string;
  dashFinancialOverview: string;
  dashExpectedRent: string;
  dashCollectedRent: string;
  dashTotalOwing: string;

  // Buildings & Units Page (/dashboard/buildings)
  bldTitle: string;
  bldSubtitle: string;
  bldAddNewBuilding: string;
  bldBuildingName: string;
  bldAddress: string;
  bldCity: string;
  bldRegion: string;
  bldTotalUnits: string;
  bldUnitPrefix: string;
  bldDescription: string;
  bldCreateButton: string;
  bldUnitsList: string;
  bldEditUnit: string;
  bldDeleteBuilding: string;
  bldDeleteConfirm: string;
  bldAssignTenant: string;
  bldCustomizeSpecs: string;

  // Tenant Credentials Page (/dashboard/credentials)
  credTitle: string;
  credSubtitle: string;
  credGenerateTitle: string;
  credTenantName: string;
  credTenantPhone: string;
  credTenantEmail: string;
  credGeneratedPassword: string;
  credAccessToken: string;
  credSendWhatsApp: string;
  credCopyLink: string;
  credFilterOccupied: string;
  credCredentialsReady: string;
  credRegenerate: string;
  credRevoke: string;

  // Rent Payments & Ledgers Page (/dashboard/payments)
  payTitle: string;
  paySubtitle: string;
  payBillingPeriod: string;
  payExpectedMonthly: string;
  payCollectedSoFar: string;
  payRecoveryRate: string;
  payTotalBalanceOwing: string;
  payTenantsOwingCount: string;
  payAllSettled: string;
  paySettlementStatus: string;
  payPaidCount: string;
  payOwingCount: string;
  payOverdueAlert: string;
  paySearchPlaceholder: string;
  payFilterAll: string;
  payFilterOwing: string;
  payFilterPaid: string;
  payFilterOverdue: string;
  payResetFilters: string;
  payAdvancePaidBadge: string;
  payRecordCashBtn: string;
  payAmountOwingSolde: string;
  payReceiptsIssued: string;
  payLatestPayment: string;
  payInspectLatestReceipt: string;
  payNoReceiptsYet: string;
  payRecordFirstPayment: string;

  // Landlord Record Cash Modal
  cashModalTitle: string;
  cashModalTenantUnit: string;
  cashModalMonthsLabel: string;
  cashModalMonthsSub: string;
  cashModalPeriodCovered: string;
  cashModalStandardExpected: string;
  cashModalAmountReceivedLabel: string;
  cashModalFillStandardBtn: string;
  cashModalAmountPlaceholder: string;
  cashModalStatusWillBeFull: string;
  cashModalStatusWillBePartial: string;
  cashModalRemainingSolde: string;
  cashModalNotesPlaceholder: string;
  cashModalSubmitBtn: string;
  cashModalSubmittingBtn: string;

  // Landlord Cash Notice / WhatsApp Dispatch Modal
  cashNoticeBadge: string;
  cashNoticeTitle: string;
  cashNoticeBody: string;
  cashNoticeReceiptNo: string;
  cashNoticePeriod: string;
  cashNoticeBalance: string;
  cashNoticeStampNote: string;
  cashNoticeWhatsAppBtn: string;
  cashNoticeInspectReceiptBtn: string;
  cashNoticeCopyTextBtn: string;
  cashNoticeCopiedText: string;

  // Maintenance Page (/dashboard/maintenance)
  maintTitle: string;
  maintSubtitle: string;
  maintCategoryFilter: string;
  maintUrgencyFilter: string;
  maintStatusFilter: string;
  maintAudioRecording: string;
  maintPhotoProof: string;
  maintVideoProof: string;
  maintUpdateStatus: string;
  maintLandlordNotes: string;
  maintDispatchTechnician: string;
  maintNoRequests: string;

  // Tenant Portal (/tenant/portal)
  tpWelcome: string;
  tpMyApartment: string;
  tpLandlordContact: string;
  tpCallLandlord: string;
  tpWhatsAppLandlord: string;
  tpRentLedgerTitle: string;
  tpAdvanceRentCovered: string;
  tpPayRentBtn: string;
  tpMakeAdvanceBtn: string;
  tpDedicatedReceiptsBtn: string;
  tpRecentReceipts: string;
  tpMyMaintenanceRequests: string;
  tpSubmitNewRequest: string;
  tpIssueTitlePlaceholder: string;
  tpIssueDescPlaceholder: string;
  tpCategoryLabel: string;
  tpUrgencyLabel: string;
  tpRecordVoiceNote: string;
  tpUploadPhoto: string;
  tpUploadVideo: string;
  tpSubmittingRequest: string;

  // Tenant Pay Rent Modal (PayRentModal.tsx)
  tpayModalTitle: string;
  tpayModalSub: string;
  tpayMonthlyRate: string;
  tpayRemainingCycle: string;
  tpayPaidEarlier: string;
  tpayMonthsQuestion: string;
  tpayMonthsSub: string;
  tpayCoveredPeriod: string;
  tpayPeriodTotalDue: string;
  tpayFillStandardBtn: string;
  tpayEnterAmountLabel: string;
  tpayPayerPhoneLabel: string;
  tpaySelectMethodLabel: string;
  tpayMethodMomo: string;
  tpayMethodOrange: string;
  tpayMethodCard: string;
  tpayMethodBank: string;
  tpayProcessBtn: string;
  tpayProcessingStep: string;
  tpaySuccessTitle: string;

  // Payment Receipt Modal (PaymentReceiptModal.tsx)
  recModalTitle: string;
  recModalSub: string;
  recOfficialReceipt: string;
  recReceiptNo: string;
  recDateIssued: string;
  recTenantBilled: string;
  recPropertyUnit: string;
  recRentPeriod: string;
  recMonthlyRent: string;
  recAmountPaid: string;
  recBalanceRemaining: string;
  recPaymentMethod: string;
  recTransactionRef: string;
  recCertifiedStamp: string;
  recOfficialSeal: string;
  recDownloadPdf: string;
  recDownloadImage: string;
  recSendWhatsApp: string;

  // Tenant Receipts Dedicated Page (/tenant/receipts)
  trecTitle: string;
  trecSubtitle: string;
  trecBackToPortal: string;
  trecTotalPaidSoFar: string;
  trecReceiptsCount: string;
  trecLatestSettlement: string;
  trecFilterMonth: string;
  trecNoReceiptsFound: string;
  trecPayNowBtn: string;

  // Auth pages (/login, /register, /tenant/login)
  authSignInTitle: string;
  authSignInSub: string;
  authRegisterTitle: string;
  authRegisterSub: string;
  authTenantLoginTitle: string;
  authTenantLoginSub: string;
  authEmailLabel: string;
  authPasswordLabel: string;
  authFullNameLabel: string;
  authPhoneLabel: string;
  authTokenLabel: string;
  authSignInBtn: string;
  authRegisterBtn: string;
  authTenantSignInBtn: string;
  authNoAccount: string;
  authHaveAccount: string;
  authOr: string;
  authReturnHome: string;

  // Platform & Community Notifications
  notifTitle: string;
  notifNewBadge: string;
  notifMarkAllRead: string;
  notifFilterAll: string;
  notifFilterUnread: string;
  notifEmptyNone: string;
  notifEmptyAllCaughtUp: string;
  notifEmptyDesc: string;
  notifLandlordFooter: string;
  notifTenantFooter: string;
  notifPaymentReceived: string;
  notifTenantArrived: string;
  notifTenantDeparted: string;
  notifJustNow: string;
  notifYesterday: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    brandName: "LeaseLink",
    dashboard: "Dashboard",
    buildingsAndUnits: "Buildings & Units",
    tenantCredentials: "Tenant Credentials",
    rentPaymentsAndLedgers: "Rent Payments & Ledgers",
    repairs: "Repairs",
    repairsAndMaintenance: "Repairs & Maintenance",
    tenantPortal: "Tenant Portal",
    tenantSpace: "Tenant Space",
    landlordSignIn: "Landlord Sign In",
    getStarted: "Get Started",
    signOut: "Sign Out",
    signingOut: "Signing Out...",
    backToDashboard: "Back to Dashboard",
    sync: "Sync",
    refresh: "Refresh",
    refreshing: "Refreshing...",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    loading: "Loading...",
    search: "Search",
    filter: "Filter",
    all: "All",
    view: "View",
    viewAll: "View All",
    copied: "Copied!",
    copy: "Copy",
    whatsapp: "WhatsApp",
    call: "Call",
    done: "Done",
    status: "Status",
    actions: "Actions",
    notes: "Notes",
    optional: "Optional",
    yes: "Yes",
    no: "No",
    currency: "XAF",
    month: "Month",
    months: "Months",
    emptyStateNoData: "No records found.",

    // Status badges
    statusPaid: "Paid in Full",
    statusPartial: "Partial Payment",
    statusUnpaid: "Unpaid",
    statusOwing: "Owing",
    statusOverdue: "Overdue",
    statusVacant: "Vacant",
    statusOccupied: "Occupied",
    statusMaintenance: "Maintenance",
    statusPending: "Pending",
    statusInProgress: "In Progress",
    statusResolved: "Resolved",
    statusRejected: "Rejected",

    // Property types
    propertyApartment: "Apartment Building",
    propertyStudio: "Studio / Single Unit",
    propertyVilla: "Villa / Residence",
    propertyCommercial: "Commercial Property",

    // Units specifications
    unitNumber: "Unit Number",
    floor: "Floor",
    parlors: "Parlors (Salons)",
    rooms: "Rooms (Chambres)",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    kitchens: "Kitchens",
    monthlyRent: "Monthly Rent",
    depositAmount: "Deposit Amount",
    agreedRent: "Agreed Rent",

    // Home Page
    homeHeroBadge: "Say Goodbye to Paper Property Ledgers",
    homeHeroTitle1: "Digital Property Management",
    homeHeroTitle2: "Built for Modern Landlords",
    homeHeroDescription:
      "Transition your buildings, units, and tenants to a real-time Progressive Web App. Log monthly rent payments, resolve tenant tickets, and access your portfolio from anywhere.",
    homeStartTrial: "Start 30-Day Free Trial",
    homeFeaturePWA: "Offline-Ready PWA",
    homeFeaturePWADesc:
      "Installs directly onto your phone or laptop. Works seamlessly even when offline.",
    homeFeatureTickets: "Multimedia Repair Requests",
    homeFeatureTicketsDesc:
      "Tenants submit voice recordings, photos, and descriptions for instant maintenance triage.",
    homeFeatureReceipts: "Digital Rent Ledgers & Stamped Receipts",
    homeFeatureReceiptsDesc:
      "Instant certified digital receipts with unique stamp, multi-month advances, and WhatsApp dispatch.",
    homeFeatureMultiTenant: "Secure Tenant Portals",
    homeFeatureMultiTenantDesc:
      "Instant credential generation with unique tenant access tokens and private tenant spaces.",

    // Landlord Dashboard Home
    dashWelcome: "Welcome to LeaseLink",
    dashWelcomeSub:
      "Your landlord account is active. You are now logged into the LeaseLink management portal.",
    dashManageBuildings: "Manage Buildings & Units",
    dashPublicHome: "View Public Homepage",
    dashLandlordProfile: "Landlord Profile",
    dashAuthenticated: "Authenticated",
    dashFullName: "Full Name",
    dashEmail: "Email Address",
    dashPhone: "Phone Number",
    dashRegisteredOn: "Registered On",
    dashUserId: "Landlord ID",
    dashSubscriptionTier: "Subscription Tier",
    dashPlanActive: "Active Subscription",
    dashCapacity: "Capacity",
    dashUsedUnits: "Occupied Units",
    dashRenewalDate: "Renewal Date",
    dashOccupiedUnits: "Occupied",
    dashVacantUnits: "Vacant",
    dashUpgradePlan: "Upgrade Subscription Plan",
    dashPendingRepairs: "Pending Repairs",
    dashFinancialOverview: "Financial Overview",
    dashExpectedRent: "Expected Monthly Rent",
    dashCollectedRent: "Collected Rent",
    dashTotalOwing: "Total Arrears Balance",

    // Buildings & Units Page
    bldTitle: "Buildings & Units Management",
    bldSubtitle:
      "Add your residential buildings, configure individual units, and customize room configurations.",
    bldAddNewBuilding: "Add New Building",
    bldBuildingName: "Building Name",
    bldAddress: "Address",
    bldCity: "City",
    bldRegion: "Region / State",
    bldTotalUnits: "Number of Units",
    bldUnitPrefix: "Unit Prefix (e.g. Unit, Apt)",
    bldDescription: "Description / Notes",
    bldCreateButton: "Create Building & Units",
    bldUnitsList: "Units Directory",
    bldEditUnit: "Edit Unit Specs",
    bldDeleteBuilding: "Delete Building",
    bldDeleteConfirm: "Are you sure you want to delete this building and all its units?",
    bldAssignTenant: "Assign Tenant",
    bldCustomizeSpecs: "Customize Unit Configuration",

    // Tenant Credentials Page
    credTitle: "Tenant Credentials & Access Tokens",
    credSubtitle:
      "Generate secure access links, view temporary credentials, and dispatch them directly via WhatsApp.",
    credGenerateTitle: "Generate Access Credentials",
    credTenantName: "Tenant Name",
    credTenantPhone: "Tenant Phone",
    credTenantEmail: "Tenant Email",
    credGeneratedPassword: "Password",
    credAccessToken: "Direct Access Token",
    credSendWhatsApp: "Send via WhatsApp",
    credCopyLink: "Copy Portal Link",
    credFilterOccupied: "Occupied Units Only",
    credCredentialsReady: "Credentials Generated Successfully",
    credRegenerate: "Regenerate Link",
    credRevoke: "Revoke Access",

    // Rent Payments & Ledgers Page
    payTitle: "Rent Collection & Tenant Arrears Consultation",
    paySubtitle:
      "Consult rent payment status for every tenant, track partial payments, inspect outstanding arrears, and review certified receipts.",
    payBillingPeriod: "Billing Period",
    payExpectedMonthly: "Expected Monthly",
    payCollectedSoFar: "Collected So Far",
    payRecoveryRate: "Recovery Rate",
    payTotalBalanceOwing: "Total Balance Owing",
    payTenantsOwingCount: "tenants currently owing",
    payAllSettled: "All tenants fully settled",
    paySettlementStatus: "Settlement Status",
    payPaidCount: "Paid",
    payOwingCount: "Owing",
    payOverdueAlert: "overdue (past due date)",
    paySearchPlaceholder: "Search tenant name, unit, phone...",
    payFilterAll: "All Tenants",
    payFilterOwing: "Owing Only",
    payFilterPaid: "Paid in Full",
    payFilterOverdue: "Overdue Only",
    payResetFilters: "Reset Filters",
    payAdvancePaidBadge: "Advance Paid",
    payRecordCashBtn: "Record Cash Payment",
    payAmountOwingSolde: "Amount Owing (Solde)",
    payReceiptsIssued: "Receipts Issued",
    payLatestPayment: "Latest Payment",
    payInspectLatestReceipt: "Inspect Latest Receipt",
    payNoReceiptsYet: "No receipts registered yet for this tenant.",
    payRecordFirstPayment: "+ Record Cash Payment",

    // Landlord Record Cash Modal
    cashModalTitle: "Record Physical Cash Payment",
    cashModalTenantUnit: "Tenant & Apartment",
    cashModalMonthsLabel: "Number of Months Tenant is Paying:",
    cashModalMonthsSub: "Default is 1 month. You can add future months if tenant is advancing.",
    cashModalPeriodCovered: "Period Covered",
    cashModalStandardExpected: "Standard Expected Rent",
    cashModalAmountReceivedLabel: "Amount Handed Over / Received (XAF):",
    cashModalFillStandardBtn: "Fill Standard Total",
    cashModalAmountPlaceholder: "e.g. 40000, 20000, 13000...",
    cashModalStatusWillBeFull: "Tenant status will directly become: Completely Paid (Soldé) ✅",
    cashModalStatusWillBePartial: "Tenant status will directly become: Partially Paid ⏳",
    cashModalRemainingSolde: "Remaining balance",
    cashModalNotesPlaceholder: "e.g. Received in cash at residence, deposit receipt...",
    cashModalSubmitBtn: "Confirm Cash & Generate Receipt",
    cashModalSubmittingBtn: "Recording & Issuing Receipt...",

    // Landlord Cash Notice / WhatsApp Dispatch Modal
    cashNoticeBadge: "💵 Cash Received Physically",
    cashNoticeTitle: "Receipt Certified & Ready to Dispatch",
    cashNoticeBody:
      "The physical cash payment has been saved. The tenant's ledger status directly changed in the system.",
    cashNoticeReceiptNo: "Official Receipt N°",
    cashNoticePeriod: "Period Covered",
    cashNoticeBalance: "Remaining Balance",
    cashNoticeStampNote: "Certified with unique stamp for",
    cashNoticeWhatsAppBtn: "Notify & Send Receipt to Tenant via WhatsApp",
    cashNoticeInspectReceiptBtn: "Inspect & Download Stamped Official Receipt",
    cashNoticeCopyTextBtn: "Copy Receipt Notification Text",
    cashNoticeCopiedText: "Receipt text copied to clipboard!",

    // Maintenance Page
    maintTitle: "Repairs & Maintenance Requests",
    maintSubtitle:
      "Review issues submitted by tenants with voice recordings, photos, and dispatch updates.",
    maintCategoryFilter: "Filter Category",
    maintUrgencyFilter: "Filter Urgency",
    maintStatusFilter: "Filter Status",
    maintAudioRecording: "Tenant Voice Audio Note",
    maintPhotoProof: "Attached Photo",
    maintVideoProof: "Attached Video",
    maintUpdateStatus: "Update Ticket Status",
    maintLandlordNotes: "Technician / Landlord Notes",
    maintDispatchTechnician: "Reply via WhatsApp",
    maintNoRequests: "No maintenance requests registered.",

    // Tenant Portal
    tpWelcome: "Welcome to your Tenant Portal",
    tpMyApartment: "My Apartment Specs",
    tpLandlordContact: "Landlord Contact",
    tpCallLandlord: "Call Landlord",
    tpWhatsAppLandlord: "WhatsApp Landlord",
    tpRentLedgerTitle: "Rent Ledger & Receipts",
    tpAdvanceRentCovered: "Advance rent already covered for:",
    tpPayRentBtn: "Pay Rent (Digital Gateway)",
    tpMakeAdvanceBtn: "Make an Advance Rent Payment",
    tpDedicatedReceiptsBtn: "Dedicated Receipts Page",
    tpRecentReceipts: "Recent Digital Receipts",
    tpMyMaintenanceRequests: "My Maintenance Requests",
    tpSubmitNewRequest: "Submit Repair Request",
    tpIssueTitlePlaceholder: "e.g. Leaking kitchen tap, Power outage in parlor...",
    tpIssueDescPlaceholder: "Describe what happened, where it is located, and how urgent it is...",
    tpCategoryLabel: "Problem Category",
    tpUrgencyLabel: "Urgency Level",
    tpRecordVoiceNote: "Record Voice Note",
    tpUploadPhoto: "Attach Photo Proof",
    tpUploadVideo: "Attach Video Clip",
    tpSubmittingRequest: "Submitting Request...",

    // Tenant Pay Rent Modal
    tpayModalTitle: "Pay Rent (Digital Gateway)",
    tpayModalSub: "Instant Stamped Receipt Issued",
    tpayMonthlyRate: "Monthly Rent Rate",
    tpayRemainingCycle: "Remaining for Current Month",
    tpayPaidEarlier: "Paid earlier this month:",
    tpayMonthsQuestion: "How many months are you paying for?",
    tpayMonthsSub: "Default is 1 month. You can advance 2, 3, or more months.",
    tpayCoveredPeriod: "Period Covered",
    tpayPeriodTotalDue: "Total Period Due",
    tpayFillStandardBtn: "Fill Total Amount",
    tpayEnterAmountLabel: "Amount to Pay (XAF):",
    tpayPayerPhoneLabel: "Mobile Money / Payer Phone Number:",
    tpaySelectMethodLabel: "Select Real Payment Method (No Cash):",
    tpayMethodMomo: "MTN Mobile Money",
    tpayMethodOrange: "Orange Money",
    tpayMethodCard: "Debit / Credit Card",
    tpayMethodBank: "Bank Wire Transfer",
    tpayProcessBtn: "Authorize & Confirm Payment",
    tpayProcessingStep: "Processing payment gateway simulation...",
    tpaySuccessTitle: "Payment Approved! Generating Official Receipt...",

    // Payment Receipt Modal
    recModalTitle: "Certified Official Rent Receipt",
    recModalSub: "Official digital receipt certified with landlord stamp",
    recOfficialReceipt: "OFFICIAL RENT RECEIPT",
    recReceiptNo: "Receipt N°",
    recDateIssued: "Date Issued",
    recTenantBilled: "Tenant Name",
    recPropertyUnit: "Residence & Apartment",
    recRentPeriod: "Rent Period",
    recMonthlyRent: "Monthly Rent Rate",
    recAmountPaid: "Amount Paid",
    recBalanceRemaining: "Balance Remaining",
    recPaymentMethod: "Payment Method",
    recTransactionRef: "Transaction Ref",
    recCertifiedStamp: "CERTIFIED OFFICIAL SEAL",
    recOfficialSeal: "OFFICIAL LANDLORD STAMP",
    recDownloadPdf: "Download Receipt",
    recDownloadImage: "Save as Image",
    recSendWhatsApp: "Share Receipt on WhatsApp",

    // Tenant Receipts Dedicated Page
    trecTitle: "Rent Receipts & Payment History",
    trecSubtitle:
      "Consult all certified rent receipts issued for your tenancy, inspect amounts paid, and download receipts.",
    trecBackToPortal: "Back to Tenant Space",
    trecTotalPaidSoFar: "Total Paid So Far",
    trecReceiptsCount: "Receipts Issued",
    trecLatestSettlement: "Latest Settlement",
    trecFilterMonth: "Filter by Billing Period",
    trecNoReceiptsFound: "No payment receipts found.",
    trecPayNowBtn: "Make a Rent Payment",

    // Auth pages
    authSignInTitle: "Sign in to LeaseLink",
    authSignInSub: "Manage your properties, tenants, and collections.",
    authRegisterTitle: "Create your Landlord Account",
    authRegisterSub: "Start your 30-day free trial. No credit card required.",
    authTenantLoginTitle: "Tenant Portal Login",
    authTenantLoginSub: "Access your apartment, rent receipts, and submit repairs.",
    authEmailLabel: "Email Address",
    authPasswordLabel: "Password",
    authFullNameLabel: "Full Name",
    authPhoneLabel: "Phone Number",
    authTokenLabel: "Access Token or Credentials",
    authSignInBtn: "Sign In",
    authRegisterBtn: "Create Free Account",
    authTenantSignInBtn: "Access My Tenant Space",
    authNoAccount: "Don't have an account?",
    authHaveAccount: "Already have an account?",
    authOr: "or",
    authReturnHome: "Return to Homepage",

    // Platform & Community Notifications
    notifTitle: "Notifications",
    notifNewBadge: "new",
    notifMarkAllRead: "Mark all read",
    notifFilterAll: "All",
    notifFilterUnread: "Unread",
    notifEmptyNone: "No notifications",
    notifEmptyAllCaughtUp: "You're all caught up with unread alerts!",
    notifEmptyDesc: "Rent payments and tenant arrival/departure notices will appear here.",
    notifLandlordFooter: "Live alerts for payments and property portfolio",
    notifTenantFooter: "Building community arrivals, departures & notices",
    notifPaymentReceived: "Rent Payment Received",
    notifTenantArrived: "New Neighbor Arrival",
    notifTenantDeparted: "Tenant Departure Notice",
    notifJustNow: "Just now",
    notifYesterday: "Yesterday",
  },

  fr: {
    brandName: "LeaseLink",
    dashboard: "Tableau de Bord",
    buildingsAndUnits: "Immeubles & Logements",
    tenantCredentials: "Identifiants Locataires",
    rentPaymentsAndLedgers: "Paiements & Registres de Loyer",
    repairs: "Réparations",
    repairsAndMaintenance: "Réparations & Entretien",
    tenantPortal: "Espace Locataire",
    tenantSpace: "Espace Locataire",
    landlordSignIn: "Connexion Bailleur",
    getStarted: "Commencer Gratuitement",
    signOut: "Déconnexion",
    signingOut: "Déconnexion en cours...",
    backToDashboard: "Retour au Tableau de Bord",
    sync: "Synchroniser",
    refresh: "Actualiser",
    refreshing: "Actualisation...",
    save: "Enregistrer",
    saving: "Enregistrement...",
    cancel: "Annuler",
    confirm: "Confirmer",
    delete: "Supprimer",
    edit: "Modifier",
    close: "Fermer",
    loading: "Chargement...",
    search: "Rechercher",
    filter: "Filtrer",
    all: "Tous",
    view: "Voir",
    viewAll: "Voir Tout",
    copied: "Copié !",
    copy: "Copier",
    whatsapp: "WhatsApp",
    call: "Appeler",
    done: "Terminé",
    status: "Statut",
    actions: "Actions",
    notes: "Remarques",
    optional: "Facultatif",
    yes: "Oui",
    no: "Non",
    currency: "XAF",
    month: "Mois",
    months: "Mois",
    emptyStateNoData: "Aucun enregistrement trouvé.",

    // Status badges
    statusPaid: "Totalement Réglé",
    statusPartial: "Paiement Partiel",
    statusUnpaid: "Non Payé",
    statusOwing: "En Dette (Solde Dû)",
    statusOverdue: "En Retard",
    statusVacant: "Vacant (Libre)",
    statusOccupied: "Occupé",
    statusMaintenance: "En Maintenance",
    statusPending: "En Attente",
    statusInProgress: "En Cours",
    statusResolved: "Résolu",
    statusRejected: "Rejeté",

    // Property types
    propertyApartment: "Immeuble Résidentiel",
    propertyStudio: "Studio / Logement Unique",
    propertyVilla: "Villa / Résidence Privée",
    propertyCommercial: "Local Commercial",

    // Units specifications
    unitNumber: "Numéro de Logement",
    floor: "Étage",
    parlors: "Salons",
    rooms: "Chambres",
    bedrooms: "Chambres",
    bathrooms: "Douches / Salles de bain",
    kitchens: "Cuisines",
    monthlyRent: "Loyer Mensuel",
    depositAmount: "Montant de la Caution",
    agreedRent: "Loyer Convenu",

    // Home Page
    homeHeroBadge: "Dites adieu aux registres de loyer sur papier",
    homeHeroTitle1: "Gestion Immobilière Numérique",
    homeHeroTitle2: "Conçue pour les Bailleurs Modernes",
    homeHeroDescription:
      "Faites passer vos immeubles, logements et locataires à une application web progressive en temps réel. Enregistrez les loyers, gérez les réparations et consultez votre patrimoine où que vous soyez.",
    homeStartTrial: "Démarrer l'Essai Gratuit de 30 Jours",
    homeFeaturePWA: "Application Progressive PWA",
    homeFeaturePWADesc:
      "S'installe directement sur votre téléphone ou PC. Fonctionne parfaitement même sans connexion Internet.",
    homeFeatureTickets: "Signalements Multimédias",
    homeFeatureTicketsDesc:
      "Les locataires envoient notes vocales, photos et descriptions pour un traitement instantané des pannes.",
    homeFeatureReceipts: "Registres Numériques & Reçus Cachetés",
    homeFeatureReceiptsDesc:
      "Reçus certifiés avec cachet unique du bailleur, avances multi-mois et envoi instantané sur WhatsApp.",
    homeFeatureMultiTenant: "Portails Locataires Sécurisés",
    homeFeatureMultiTenantDesc:
      "Génération immédiate d'identifiants et de liens d'accès privés pour chaque locataire.",

    // Landlord Dashboard Home
    dashWelcome: "Bienvenue sur LeaseLink",
    dashWelcomeSub:
      "Votre compte bailleur est actif. Vous êtes connecté à votre portail de gestion immobilière LeaseLink.",
    dashManageBuildings: "Gérer Immeubles & Logements",
    dashPublicHome: "Page d'Accueil Publique",
    dashLandlordProfile: "Profil du Bailleur",
    dashAuthenticated: "Authentifié",
    dashFullName: "Nom Complet",
    dashEmail: "Adresse E-mail",
    dashPhone: "Numéro de Téléphone",
    dashRegisteredOn: "Inscrit le",
    dashUserId: "Identifiant Bailleur",
    dashSubscriptionTier: "Formule d'Abonnement",
    dashPlanActive: "Abonnement Actif",
    dashCapacity: "Capacité Maximale",
    dashUsedUnits: "Logements Occupés",
    dashRenewalDate: "Date de Renouvellement",
    dashOccupiedUnits: "Occupés",
    dashVacantUnits: "Vacants",
    dashUpgradePlan: "Changer de Formule",
    dashPendingRepairs: "Réparations en Attente",
    dashFinancialOverview: "Aperçu Financier",
    dashExpectedRent: "Loyer Mensuel Attendu",
    dashCollectedRent: "Loyers Encaissés",
    dashTotalOwing: "Total des Impayés",

    // Buildings & Units Page
    bldTitle: "Gestion des Immeubles & Logements",
    bldSubtitle:
      "Ajoutez vos résidences, configurez chaque logement et personnalisez les caractéristiques des pièces.",
    bldAddNewBuilding: "Ajouter un Nouvel Immeuble",
    bldBuildingName: "Nom de la Résidence",
    bldAddress: "Adresse",
    bldCity: "Ville",
    bldRegion: "Région / Département",
    bldTotalUnits: "Nombre de Logements",
    bldUnitPrefix: "Préfixe (ex: Porte, Apt, Villa)",
    bldDescription: "Description / Remarques",
    bldCreateButton: "Créer l'Immeuble & Logements",
    bldUnitsList: "Répertoire des Logements",
    bldEditUnit: "Modifier les Caractéristiques",
    bldDeleteBuilding: "Supprimer l'Immeuble",
    bldDeleteConfirm: "Voulez-vous vraiment supprimer cet immeuble et tous ses logements associés ?",
    bldAssignTenant: "Attribuer à un Locataire",
    bldCustomizeSpecs: "Personnaliser les Pièces",

    // Tenant Credentials Page
    credTitle: "Identifiants & Liens d'Accès Locataires",
    credSubtitle:
      "Générez des liens d'accès sécurisés, consultez les codes temporaires et transmettez-les par WhatsApp.",
    credGenerateTitle: "Générer les Identifiants d'Accès",
    credTenantName: "Nom du Locataire",
    credTenantPhone: "Téléphone du Locataire",
    credTenantEmail: "E-mail du Locataire",
    credGeneratedPassword: "Mot de Passe",
    credAccessToken: "Jeton d'Accès Direct",
    credSendWhatsApp: "Envoyer par WhatsApp",
    credCopyLink: "Copier le Lien du Portail",
    credFilterOccupied: "Logements Occupés Uniquement",
    credCredentialsReady: "Identifiants Générés avec Succès",
    credRegenerate: "Régénérer le Lien",
    credRevoke: "Révoquer l'Accès",

    // Rent Payments & Ledgers Page
    payTitle: "Encaissement des Loyers & Consultation des Impayés",
    paySubtitle:
      "Consultez l'état de règlement de chaque locataire, suivez les versements partiels, vérifiez les dettes et éditez les reçus certifiés.",
    payBillingPeriod: "Période de Facturation",
    payExpectedMonthly: "Loyer Mensuel Attendu",
    payCollectedSoFar: "Total Déjà Encaissé",
    payRecoveryRate: "Taux de Recouvrement",
    payTotalBalanceOwing: "Total des Impayés (Dettes)",
    payTenantsOwingCount: "locataires ont un solde débiteur",
    payAllSettled: "Tous les locataires sont totalement à jour",
    paySettlementStatus: "État des Règlements",
    payPaidCount: "À jour",
    payOwingCount: "En dette",
    payOverdueAlert: "en retard critique (délai dépassé)",
    paySearchPlaceholder: "Rechercher par nom, logement, téléphone...",
    payFilterAll: "Tous les Locataires",
    payFilterOwing: "En Dette Uniquement",
    payFilterPaid: "Totalement Soldés",
    payFilterOverdue: "En Retard Uniquement",
    payResetFilters: "Réinitialiser les Filtres",
    payAdvancePaidBadge: "Avance Réglée",
    payRecordCashBtn: "Encaisser en Espèces",
    payAmountOwingSolde: "Solde Restant Dû",
    payReceiptsIssued: "Reçus Délivrés",
    payLatestPayment: "Dernier Versement",
    payInspectLatestReceipt: "Inspecter le Dernier Reçu",
    payNoReceiptsYet: "Aucun reçu enregistré pour le moment pour ce logement.",
    payRecordFirstPayment: "+ Encaisser le Premier Versement",

    // Landlord Record Cash Modal
    cashModalTitle: "Encaisser un Versement en Espèces",
    cashModalTenantUnit: "Locataire & Logement",
    cashModalMonthsLabel: "Nombre de mois réglés par le locataire :",
    cashModalMonthsSub: "Par défaut 1 mois. Vous pouvez ajouter des mois futurs si le locataire avance son loyer.",
    cashModalPeriodCovered: "Période Couverte",
    cashModalStandardExpected: "Loyer Standard Attendu",
    cashModalAmountReceivedLabel: "Montant Reçu en Main Propre (XAF) :",
    cashModalFillStandardBtn: "Remplir Montant Exact",
    cashModalAmountPlaceholder: "ex : 40000, 20000, 13000...",
    cashModalStatusWillBeFull: "Le statut du locataire deviendra : Totalement Réglé (Soldé) ✅",
    cashModalStatusWillBePartial: "Le statut du locataire deviendra : Paiement Partiel ⏳",
    cashModalRemainingSolde: "Solde restant",
    cashModalNotesPlaceholder: "ex : Remis en espèces à la résidence, avance loyer...",
    cashModalSubmitBtn: "Confirmer l'Encaissement & Générer le Reçu",
    cashModalSubmittingBtn: "Enregistrement et certification du reçu...",

    // Landlord Cash Notice / WhatsApp Dispatch Modal
    cashNoticeBadge: "💵 Espèces Reçues en Main Propre",
    cashNoticeTitle: "Reçu Certifié & Prêt pour Envoi",
    cashNoticeBody:
      "Le versement en espèces a été enregistré. Le statut du locataire a été directement mis à jour dans le grand livre.",
    cashNoticeReceiptNo: "Reçu Officiel N°",
    cashNoticePeriod: "Période Couverte",
    cashNoticeBalance: "Solde Restant Dû",
    cashNoticeStampNote: "Certifié avec le cachet unique de",
    cashNoticeWhatsAppBtn: "Notifier & Envoyer le Reçu par WhatsApp",
    cashNoticeInspectReceiptBtn: "Inspecter & Télécharger le Reçu Cacheté",
    cashNoticeCopyTextBtn: "Copier le Message de Notification",
    cashNoticeCopiedText: "Texte du reçu copié dans le presse-papiers !",

    // Maintenance Page
    maintTitle: "Demandes de Réparation & Entretien",
    maintSubtitle:
      "Examinez les problèmes signalés avec notes vocales et photos, puis coordonnez les réparations.",
    maintCategoryFilter: "Filtrer par Catégorie",
    maintUrgencyFilter: "Filtrer par Urgence",
    maintStatusFilter: "Filtrer par Statut",
    maintAudioRecording: "Note Vocale du Locataire",
    maintPhotoProof: "Photo Justificative",
    maintVideoProof: "Vidéo Justificative",
    maintUpdateStatus: "Mettre à Jour le Statut",
    maintLandlordNotes: "Notes du Bailleur / Technicien",
    maintDispatchTechnician: "Répondre par WhatsApp",
    maintNoRequests: "Aucune demande de maintenance enregistrée.",

    // Tenant Portal
    tpWelcome: "Bienvenue sur votre Espace Locataire",
    tpMyApartment: "Détails de mon Logement",
    tpLandlordContact: "Contact du Bailleur",
    tpCallLandlord: "Appeler le Bailleur",
    tpWhatsAppLandlord: "Écrire sur WhatsApp",
    tpRentLedgerTitle: "Registre des Loyers & Reçus",
    tpAdvanceRentCovered: "Avance de loyer déjà réglée pour :",
    tpPayRentBtn: "Payer mon Loyer (Passerelle Numérique)",
    tpMakeAdvanceBtn: "Faire une Avance de Loyer",
    tpDedicatedReceiptsBtn: "Consulter Mes Reçus Officiels",
    tpRecentReceipts: "Reçus Numériques Récents",
    tpMyMaintenanceRequests: "Mes Demandes de Réparation",
    tpSubmitNewRequest: "Signaler une Réparation",
    tpIssueTitlePlaceholder: "ex : Fuite d'eau dans la cuisine, Panne d'électricité...",
    tpIssueDescPlaceholder: "Décrivez le problème en détail, son emplacement et son degré d'urgence...",
    tpCategoryLabel: "Catégorie de la Panne",
    tpUrgencyLabel: "Niveau d'Urgence",
    tpRecordVoiceNote: "Enregistrer une Note Vocale",
    tpUploadPhoto: "Joindre une Photo",
    tpUploadVideo: "Joindre une Vidéo",
    tpSubmittingRequest: "Envoi de la demande en cours...",

    // Tenant Pay Rent Modal
    tpayModalTitle: "Payer mon Loyer (Passerelle Numérique)",
    tpayModalSub: "Reçu officiel cacheté délivré instantanément",
    tpayMonthlyRate: "Tarif du Loyer Mensuel",
    tpayRemainingCycle: "Reste à payer ce mois-ci",
    tpayPaidEarlier: "Déjà réglé ce mois :",
    tpayMonthsQuestion: "Combien de mois souhaitez-vous payer ?",
    tpayMonthsSub: "1 mois par défaut. Vous pouvez avancer 2, 3 mois ou plus.",
    tpayCoveredPeriod: "Période Couverte",
    tpayPeriodTotalDue: "Total Dû pour la Période",
    tpayFillStandardBtn: "Remplir Montant Total",
    tpayEnterAmountLabel: "Montant à Payer (XAF) :",
    tpayPayerPhoneLabel: "Numéro de Téléphone Mobile Money / Payeur :",
    tpaySelectMethodLabel: "Sélectionnez votre Mode de Paiement (Espèces non admises en ligne) :",
    tpayMethodMomo: "MTN Mobile Money",
    tpayMethodOrange: "Orange Money",
    tpayMethodCard: "Carte Bancaire (Débit / Crédit)",
    tpayMethodBank: "Virement Bancaire",
    tpayProcessBtn: "Valider & Payer en Ligne",
    tpayProcessingStep: "Connexion sécurisée à la passerelle de paiement...",
    tpaySuccessTitle: "Paiement Validé ! Génération du Reçu Officiel...",

    // Payment Receipt Modal
    recModalTitle: "Quittance de Loyer Certifiée",
    recModalSub: "Reçu numérique officiel certifié avec cachet unique du bailleur",
    recOfficialReceipt: "QUITTANCE OFFICIELLE DE LOYER",
    recReceiptNo: "Reçu N°",
    recDateIssued: "Date d'Émission",
    recTenantBilled: "Nom du Locataire",
    recPropertyUnit: "Résidence & Logement",
    recRentPeriod: "Période Concernée",
    recMonthlyRent: "Loyer Mensuel",
    recAmountPaid: "Montant Réglé",
    recBalanceRemaining: "Solde Restant Dû",
    recPaymentMethod: "Mode de Règlement",
    recTransactionRef: "Réf. Transaction",
    recCertifiedStamp: "SCEAU OFFICIEL CERTIFIÉ",
    recOfficialSeal: "CACHET DU BAILLEUR",
    recDownloadPdf: "Télécharger le Reçu",
    recDownloadImage: "Enregistrer comme Image",
    recSendWhatsApp: "Partager le Reçu sur WhatsApp",

    // Tenant Receipts Dedicated Page
    trecTitle: "Reçus de Loyer & Historique des Règlements",
    trecSubtitle:
      "Consultez toutes les quittances de loyer certifiées délivrées pour votre logement et téléchargez vos reçus.",
    trecBackToPortal: "Retour à l'Espace Locataire",
    trecTotalPaidSoFar: "Total Déjà Versé",
    trecReceiptsCount: "Reçus Délivrés",
    trecLatestSettlement: "Dernier Règlement",
    trecFilterMonth: "Filtrer par Période",
    trecNoReceiptsFound: "Aucun reçu de paiement trouvé.",
    trecPayNowBtn: "Effectuer un Paiement",

    // Auth pages
    authSignInTitle: "Connexion à LeaseLink",
    authSignInSub: "Gérez vos biens, vos locataires et vos encaissements.",
    authRegisterTitle: "Créer votre Compte Bailleur",
    authRegisterSub: "Démarrez votre essai gratuit de 30 jours sans engagement.",
    authTenantLoginTitle: "Connexion Espace Locataire",
    authTenantLoginSub: "Accédez à votre logement, vos quittances et vos réparations.",
    authEmailLabel: "Adresse E-mail",
    authPasswordLabel: "Mot de Passe",
    authFullNameLabel: "Nom Complet",
    authPhoneLabel: "Numéro de Téléphone",
    authTokenLabel: "Jeton d'Accès ou Code Reçu",
    authSignInBtn: "Se Connecter",
    authRegisterBtn: "Créer un Compte Gratuit",
    authTenantSignInBtn: "Accéder à mon Espace Locataire",
    authNoAccount: "Vous n'avez pas de compte ?",
    authHaveAccount: "Vous avez déjà un compte ?",
    authOr: "ou",
    authReturnHome: "Retour à l'accueil",

    // Platform & Community Notifications
    notifTitle: "Notifications",
    notifNewBadge: "non lus",
    notifMarkAllRead: "Tout lire",
    notifFilterAll: "Toutes",
    notifFilterUnread: "Non lues",
    notifEmptyNone: "Aucune notification",
    notifEmptyAllCaughtUp: "Vous avez lu toutes vos notifications !",
    notifEmptyDesc: "Les paiements de loyers et les arrivées/départs de locataires s'afficheront ici.",
    notifLandlordFooter: "Alertes en direct de vos locataires et paiements",
    notifTenantFooter: "Nouvelles de votre communauté et de votre immeuble",
    notifPaymentReceived: "Paiement de Loyer Reçu",
    notifTenantArrived: "Nouvel Arrivant",
    notifTenantDeparted: "Avis de Départ de Locataire",
    notifJustNow: "À l'instant",
    notifYesterday: "Hier",
  },
};
