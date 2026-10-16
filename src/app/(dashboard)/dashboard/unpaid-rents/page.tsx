"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LandlordProfile,
  Building,
  TenantRentStatus,
  RentPayment,
} from "@/types/database";
import { getBuildingsWithUnits } from "@/lib/services/buildingService";
import {
  getTenantRentStatusSummary,
  getCurrentRentMonth,
  getUpcomingRentMonths,
  recordRentPayment,
  buildPaymentReminderWhatsAppUrl,
} from "@/lib/services/paymentService";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  AlertTriangle,
  Receipt,
  Search,
  Filter,
  RefreshCw,
  ArrowLeft,
  DollarSign,
  MessageCircle,
  Building2,
  DoorOpen,
  Phone,
  CheckCircle2,
  Calendar,
  X,
  ShieldAlert,
  User,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export default function UnpaidRentsPage() {
  const router = useRouter();
  const { isFrench, formatCurrency } = useLanguage();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [statuses, setStatuses] = useState<TenantRentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "overdue" | "partial">("all");

  // Cash Payment Recording Modal state
  const [recordTarget, setRecordTarget] = useState<TenantRentStatus | null>(null);
  const [recordAmount, setRecordAmount] = useState<string>("");
  const [recordMonthsCount, setRecordMonthsCount] = useState<number>(1);
  const [recordNotes, setRecordNotes] = useState<string>("");
  const [isSubmittingRecord, setIsSubmittingRecord] = useState<boolean>(false);

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<RentPayment | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [cashConfirmedPayment, setCashConfirmedPayment] = useState<RentPayment | null>(null);

  const [currentMonth, setCurrentMonth] = useState<string>("");

  useEffect(() => {
    setCurrentMonth(getCurrentRentMonth());
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      const activeProfile = profileData as LandlordProfile | null;
      if (activeProfile) {
        setProfile(activeProfile);
      }

      // Determine effective landlord ID: If manager, use their landlord_id
      const effectiveLandlordId =
        activeProfile?.role === "manager" && activeProfile.landlord_id
          ? activeProfile.landlord_id
          : authUser.id;

      const buildingsData = await getBuildingsWithUnits(effectiveLandlordId);
      setBuildings(buildingsData);

      const statusSummary = await getTenantRentStatusSummary(
        effectiveLandlordId,
        buildingsData
      );

      // We focus strictly on tenants who owe rent (is_owing = true)
      setStatuses(statusSummary);
    } catch (err) {
      console.error("Error loading unpaid rents:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter only tenants with unpaid/overdue balances
  const unpaidStatuses = useMemo(() => {
    return statuses.filter((s) => s.is_owing);
  }, [statuses]);

  // Apply search & building filters
  const filteredUnpaid = useMemo(() => {
    let result = unpaidStatuses;

    if (selectedBuildingId !== "all") {
      result = result.filter((s) => s.building_id === selectedBuildingId);
    }

    if (urgencyFilter === "overdue") {
      result = result.filter((s) => s.status === "overdue");
    } else if (urgencyFilter === "partial") {
      result = result.filter((s) => s.status === "partial");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.tenant_name.toLowerCase().includes(q) ||
          s.unit_number.toLowerCase().includes(q) ||
          s.building_name.toLowerCase().includes(q) ||
          s.tenant_phone.includes(q)
      );
    }

    return result;
  }, [unpaidStatuses, selectedBuildingId, urgencyFilter, searchQuery]);

  // Aggregate Metrics
  const totalOwingBalance = unpaidStatuses.reduce(
    (sum, s) => sum + s.balance_owing_current_month,
    0
  );
  const totalOverdueTenants = unpaidStatuses.filter((s) => s.status === "overdue").length;
  const totalPartialTenants = unpaidStatuses.filter((s) => s.status === "partial").length;

  // Open modal to record cash payment
  const openRecordModal = (tenant: TenantRentStatus) => {
    setRecordTarget(tenant);
    setRecordAmount(tenant.balance_owing_current_month.toString());
    setRecordMonthsCount(1);
    setRecordNotes("");
  };

  // Submit cash collection
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(recordAmount);
    if (!recordTarget || !cleanAmount || isNaN(cleanAmount) || cleanAmount <= 0) return;

    const targetMonths = getUpcomingRentMonths(recordMonthsCount);
    const periodLabel =
      recordMonthsCount > 1
        ? `${targetMonths[0]} – ${targetMonths[recordMonthsCount - 1]} (${recordMonthsCount} Months)`
        : targetMonths[0] || currentMonth;

    const effectiveLandlordId =
      profile?.role === "manager" && profile.landlord_id
        ? profile.landlord_id
        : user?.id || "mock-landlord";

    setIsSubmittingRecord(true);
    try {
      const res = await recordRentPayment({
        unit_id: recordTarget.unit_id,
        building_id: recordTarget.building_id,
        landlord_id: effectiveLandlordId,
        landlord_name: profile?.full_name || "Property Management",
        tenant_name: recordTarget.tenant_name,
        tenant_phone: recordTarget.tenant_phone,
        tenant_email: recordTarget.tenant_email,
        unit_number: recordTarget.unit_number,
        building_name: recordTarget.building_name,
        rent_month: periodLabel,
        months_count: recordMonthsCount,
        months_covered: targetMonths,
        monthly_rent_amount: recordTarget.monthly_rent,
        amount_paid: cleanAmount,
        payment_method: "cash",
        notes:
          recordNotes ||
          (isFrench
            ? "Perçu en espèces sur place par le gestionnaire"
            : "Collected in physical cash on-site by manager"),
      });

      if (res.success && res.payment) {
        await loadData();
        const savedPayment = res.payment;
        setRecordTarget(null);
        setCashConfirmedPayment(savedPayment);
      }
    } catch (err) {
      console.error("Error recording cash payment:", err);
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isFrench
              ? "Recherche des loyers impayés et arriérés..."
              : "Scanning for unpaid rents and overdue tenants..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-amber-500 selection:text-white">
      <DashboardNav
        user={user}
        profile={profile}
        buildingsCount={buildings.length}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24 lg:pb-12 min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isFrench ? "Tableau de Bord" : "Dashboard"}</span>
              </Link>
              <span>/</span>
              <span className="text-slate-700 dark:text-slate-200 font-semibold">
                {isFrench ? "Loyers Impayés" : "Unpaid Rents"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
              <span>{isFrench ? "Suivi des Loyers Impayés & Relances" : "Unpaid Rents & Payment Recovery"}</span>
              {unpaidStatuses.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  {unpaidStatuses.length} {isFrench ? "Impayés" : "Owing"}
                </span>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              {isFrench
                ? "Identifiez les locataires avec solde dû, envoyez des rappels WhatsApp personnalisés et enregistrez immédiatement les paiements en espèces perçus."
                : "Identify tenants with outstanding balances, dispatch personalized WhatsApp payment reminders, and record on-site cash collections."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                {isFrench ? "Période active" : "Active Period"}
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 inline-block shadow-sm">
                {currentMonth}
              </span>
            </div>

            <button
              onClick={() => {
                setRefreshing(true);
                loadData();
              }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs transition cursor-pointer shadow-xs"
              title={isFrench ? "Actualiser" : "Refresh"}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-amber-500" : ""}`} />
            </button>
          </div>
        </div>

        {/* Manager Mode Banner */}
        {profile?.role === "manager" && (
          <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-300 flex items-center gap-3 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="leading-relaxed">
              <strong>{isFrench ? "Portail Gestionnaire Délégué :" : "Property Manager Portal:"}</strong>{" "}
              {isFrench
                ? "Vous avez accès à la liste des locataires avec des loyers impayés pour effectuer vos relances et enregistrer les règlements en espèces. La comptabilité générale reste sous le contrôle exclusif du bailleur."
                : "You have access to tenants with outstanding rent to send reminders and record on-site cash collections. Overall financial revenue remains under landlord administration."}
            </p>
          </div>
        )}

        {/* Operational Recovery KPIs Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Tenants Owing */}
          <div className="bg-gradient-to-br from-rose-50 via-red-50 to-rose-50/40 dark:bg-none dark:bg-slate-900 border-2 border-rose-300 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-rose-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Locataires avec Solde Dû" : "Tenants Owing Rent"}</span>
              <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-rose-950 dark:text-rose-400 font-mono block">
              {unpaidStatuses.length}
            </span>
            <span className="text-[10px] text-rose-800 dark:text-slate-400 block font-semibold">
              {isFrench
                ? `Sur ${statuses.length} logements occupés`
                : `Out of ${statuses.length} occupied units`}
            </span>
          </div>

          {/* Card 2: Total Balance Owed */}
          <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50/40 dark:bg-none dark:bg-slate-900 border-2 border-amber-300 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-amber-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Montant Total des Arriérés" : "Total Arrears Owed"}</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-amber-950 dark:text-amber-400 font-mono block">
              {totalOwingBalance.toLocaleString()} <span className="text-xs text-amber-700 dark:text-slate-500 font-normal">XAF</span>
            </span>
            <span className="text-[10px] text-amber-800 dark:text-slate-400 block font-semibold">
              {isFrench ? "À recouvrer ce mois" : "To collect this month"}
            </span>
          </div>

          {/* Card 3: Overdue Critical */}
          <div className="bg-gradient-to-br from-red-50 via-orange-50 to-amber-50/30 dark:bg-none dark:bg-slate-900 border-2 border-red-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-red-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Délai Dépassé (Critique)" : "Overdue (Past 5th)"}</span>
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-red-950 dark:text-red-400 font-mono block">
              {totalOverdueTenants}
            </span>
            <span className="text-[10px] text-red-800 dark:text-slate-400 block font-bold">
              {isFrench ? "Relance urgente recommandée" : "Urgent reminder advised"}
            </span>
          </div>

          {/* Card 4: Partial Payments */}
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50/30 dark:bg-none dark:bg-slate-900 border-2 border-blue-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-blue-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Paiements Partiels" : "Partial Payments"}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-blue-950 dark:text-blue-400 font-mono block">
              {totalPartialTenants}
            </span>
            <span className="text-[10px] text-blue-800 dark:text-slate-400 block font-semibold">
              {isFrench ? "Acompte versé, solde restant" : "Installment paid, balance due"}
            </span>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isFrench ? "Filtrer par nom de locataire, logement ou téléphone..." : "Filter by tenant name, unit or phone..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Building Filter */}
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">{isFrench ? "Tous les immeubles" : "All Buildings"}</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                onClick={() => setUrgencyFilter("all")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  urgencyFilter === "all"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {isFrench ? "Tous" : "All"} ({unpaidStatuses.length})
              </button>
              <button
                onClick={() => setUrgencyFilter("overdue")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  urgencyFilter === "overdue"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                }`}
              >
                {isFrench ? "En retard" : "Overdue"} ({totalOverdueTenants})
              </button>
              <button
                onClick={() => setUrgencyFilter("partial")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  urgencyFilter === "partial"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                }`}
              >
                {isFrench ? "Partiels" : "Partial"} ({totalPartialTenants})
              </button>
            </div>
          </div>
        </div>

        {/* Unpaid Tenant Cards */}
        {filteredUnpaid.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-emerald-300 dark:border-emerald-900/40 rounded-3xl p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Félicitations ! Aucun loyer impayé" : "Congratulations! No Unpaid Rents"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {isFrench
                  ? "Tous vos locataires actifs sont à jour dans leurs règlements pour le mois en cours."
                  : "All active tenants in your selected filter are fully settled for the current period."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUnpaid.map((t) => {
              const reminder = buildPaymentReminderWhatsAppUrl({
                tenantPhone: t.tenant_phone,
                tenantName: t.tenant_name,
                buildingName: t.building_name,
                unitNumber: t.unit_number,
                balanceOwing: t.balance_owing_current_month,
                rentMonth: t.current_month,
                daysLate: t.days_late,
                managerName: profile?.full_name || (user?.user_metadata?.full_name as string) || "Gestionnaire",
                language: isFrench ? "fr" : "en",
              });
              const isOverdue = t.status === "overdue";

              return (
                <div
                  key={t.unit_id}
                  className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 space-y-4 shadow-sm transition ${
                    isOverdue
                      ? "border-rose-300 dark:border-rose-900/50 hover:border-rose-400"
                      : "border-amber-300 dark:border-amber-900/50 hover:border-amber-400"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 dark:text-white truncate">
                          {t.tenant_name}
                        </span>
                        {isOverdue ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/30">
                            {isFrench ? "En retard (Délai Dépassé)" : "Overdue"}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                            {t.amount_paid_current_month > 0
                              ? isFrench ? "Acompte Partiel" : "Partial Payment"
                              : isFrench ? "Aucun Versement" : "Unpaid"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <DoorOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>{t.unit_number}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>{t.building_name}</span>
                        </span>
                        <span>•</span>
                        <a
                          href={`tel:${t.tenant_phone}`}
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-mono"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{t.tenant_phone}</span>
                        </a>
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={reminder.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition cursor-pointer"
                        title={isFrench ? "Envoyer un rappel de loyer WhatsApp" : "Send WhatsApp Rent Reminder"}
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-white" />
                        <span>{isFrench ? "Rappel WhatsApp" : "WhatsApp Reminder"}</span>
                      </a>

                      <button
                        onClick={() => openRecordModal(t)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition cursor-pointer"
                        title={isFrench ? "Enregistrer un paiement en espèces" : "Record Cash Handover"}
                      >
                        <DollarSign className="w-3.5 h-3.5 text-white" />
                        <span>{isFrench ? "Enregistrer Espèces" : "Record Cash"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Financial Balance Strip */}
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        {isFrench ? "Loyer Exigible" : "Monthly Rent"}
                      </span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {t.monthly_rent.toLocaleString()} XAF
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        {isFrench ? "Déjà Payé" : "Already Paid"}
                      </span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {t.amount_paid_current_month.toLocaleString()} XAF
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold block">
                        {isFrench ? "Solde Restant Dû" : "Balance Owed"}
                      </span>
                      <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                        {t.balance_owing_current_month.toLocaleString()} XAF
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* RECORD CASH PAYMENT MODAL                                                 */}
      {/* ========================================================================= */}
      {recordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {isFrench ? "Enregistrer Paiement en Espèces" : "Record Physical Cash Payment"}
                  </h3>
                  <span className="text-[11px] text-slate-500 block">
                    {recordTarget.tenant_name} • {recordTarget.unit_number} ({recordTarget.building_name})
                  </span>
                </div>
              </div>

              <button
                onClick={() => setRecordTarget(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex justify-between items-center">
                <span className="text-amber-900 dark:text-amber-300 font-medium">
                  {isFrench ? "Solde actuel restant à régler :" : "Current balance owed:"}
                </span>
                <span className="font-mono font-black text-amber-900 dark:text-amber-300 text-sm">
                  {recordTarget.balance_owing_current_month.toLocaleString()} XAF
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isFrench ? "Montant Perçu en Espèces (XAF) *" : "Cash Amount Received (XAF) *"}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step={500}
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 text-base font-bold font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isFrench ? "Nombre de Mois Couverts" : "Number of Months Covered"}
                </label>
                <select
                  value={recordMonthsCount}
                  onChange={(e) => setRecordMonthsCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={1}>{isFrench ? "1 Mois (Mois en cours)" : "1 Month (Current Month)"}</option>
                  <option value={2}>2 Mois</option>
                  <option value={3}>3 Mois (Trimestre)</option>
                  <option value={6}>6 Mois (Semestre)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  {isFrench ? "Notes ou Remarques du Gestionnaire (Facultatif)" : "Manager Notes (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder={isFrench ? "ex. Remis en mains propres à la conciergerie" : "e.g. Handed over at manager desk"}
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecordTarget(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  {isFrench ? "Annuler" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecord}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition shadow-md shadow-blue-600/25 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingRecord
                    ? isFrench ? "Enregistrement..." : "Recording..."
                    : isFrench ? "Valider & Générer Quittance" : "Confirm & Issue Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CASH PAYMENT CONFIRMATION TOAST / NOTIFICATION                            */}
      {/* ========================================================================= */}
      {cashConfirmedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                {isFrench ? "Paiement en Espèces Enregistré !" : "Cash Payment Recorded!"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFrench
                  ? `Reçu officiel N° ${cashConfirmedPayment.receipt_number} généré pour ${cashConfirmedPayment.tenant_name}.`
                  : `Official receipt N° ${cashConfirmedPayment.receipt_number} generated for ${cashConfirmedPayment.tenant_name}.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedReceipt(cashConfirmedPayment);
                  setShowReceiptModal(true);
                  setCashConfirmedPayment(null);
                }}
                className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition cursor-pointer"
              >
                {isFrench ? "Voir & Télécharger la Quittance" : "View & Download Receipt"}
              </button>

              <button
                onClick={() => setCashConfirmedPayment(null)}
                className="w-full sm:w-auto py-2.5 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition"
              >
                {isFrench ? "Fermer" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Receipt Modal */}
      {selectedReceipt && (
        <PaymentReceiptModal
          payment={selectedReceipt}
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedReceipt(null);
          }}
          landlordName={profile?.full_name}
          landlordPhone={profile?.phone}
        />
      )}
    </div>
  );
}
