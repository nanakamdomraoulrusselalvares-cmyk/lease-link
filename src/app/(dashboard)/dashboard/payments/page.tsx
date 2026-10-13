"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Building,
  LandlordProfile,
  RentPayment,
  TenantRentStatus,
  PaymentMethod,
} from "@/types/database";
import { getBuildingsWithUnits } from "@/lib/services/buildingService";
import {
  getTenantRentStatusSummary,
  getCurrentRentMonth,
  getUpcomingRentMonths,
  recordRentPayment,
  PAYMENT_METHOD_LABELS,
  buildPaymentConfirmationWhatsAppUrl,
} from "@/lib/services/paymentService";
import PaymentReceiptModal from "@/components/PaymentReceiptModal";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import DashboardNav from "@/components/DashboardNav";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Receipt,
  ArrowLeft,
  Building2,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Filter,
  Users,
  Eye,
  Plus,
  Minus,
  MessageCircle,
  FileText,
  ShieldCheck,
  AlertCircle,
  DoorOpen,
  Calendar,
  X,
  Phone,
  ArrowRight,
  TrendingUp,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";

function PaymentsContent() {
  const { language, isFrench, t, formatDate, formatCurrency } = useLanguage();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [statuses, setStatuses] = useState<TenantRentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "owing" | "paid" | "overdue"
  >("all");

  // Modals state
  const [selectedReceipt, setSelectedReceipt] = useState<RentPayment | null>(
    null
  );
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Manual payment recording modal state (cash handover / offline payment by landlord)
  const [recordTarget, setRecordTarget] = useState<TenantRentStatus | null>(
    null
  );
  const [recordMonthsCount, setRecordMonthsCount] = useState<number>(1);
  const [recordAmount, setRecordAmount] = useState<string>("");
  const [recordMethod, setRecordMethod] = useState<PaymentMethod>("cash");
  const [recordNotes, setRecordNotes] = useState<string>("");
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);

  // Cash payment physical confirmation modal (prompts landlord to notify tenant & dispatch receipt via WhatsApp)
  const [cashConfirmedPayment, setCashConfirmedPayment] =
    useState<RentPayment | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  // Drawer / view all receipts for a tenant
  const [inspectTenantReceipts, setInspectTenantReceipts] =
    useState<TenantRentStatus | null>(null);

  const currentMonth = getCurrentRentMonth();

  // Helper to open physical cash payment recording modal
  const openRecordModal = (tenant: TenantRentStatus) => {
    setRecordTarget(tenant);
    setRecordMonthsCount(1);
    setRecordAmount(""); // Comes empty with no default numbers
    setRecordMethod("cash");
    setRecordNotes("");
  };

  // Load session, buildings, and payment status summary
  const loadData = async () => {
    setLoading(true);
    const supabase = createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (authUser) {
      setUser(authUser);
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      if (profileData) setProfile(profileData as LandlordProfile);
    }

    const landlordId = authUser?.id || "mock-landlord";

    try {
      const buildingsData = await getBuildingsWithUnits(landlordId);
      setBuildings(buildingsData);

      const statusSummary = await getTenantRentStatusSummary(
        landlordId,
        buildingsData
      );
      setStatuses(statusSummary);
    } catch (err) {
      console.error("Error loading payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered statuses
  const filteredStatuses = useMemo(() => {
    let result = statuses;

    if (selectedBuildingId !== "all") {
      result = result.filter((s) => s.building_id === selectedBuildingId);
    }

    if (statusFilter === "owing") {
      result = result.filter((s) => s.is_owing);
    } else if (statusFilter === "paid") {
      result = result.filter((s) => s.status === "paid");
    } else if (statusFilter === "overdue") {
      result = result.filter((s) => s.status === "overdue");
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
  }, [statuses, selectedBuildingId, statusFilter, searchQuery]);

  // Aggregate KPI metrics
  const totalExpectedRent = statuses.reduce(
    (sum, s) => sum + s.monthly_rent,
    0
  );
  const totalCollectedRent = statuses.reduce(
    (sum, s) => sum + s.amount_paid_current_month,
    0
  );
  const totalOwingBalance = statuses.reduce(
    (sum, s) => sum + s.balance_owing_current_month,
    0
  );
  const totalOwingTenants = statuses.filter((s) => s.is_owing).length;
  const totalPaidTenants = statuses.filter((s) => s.status === "paid").length;
  const totalOverdueTenants = statuses.filter((s) => s.status === "overdue").length;

  // Handle recording payment from landlord side (physical cash or offline)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseFloat(recordAmount);
    if (!recordTarget || !cleanAmount || isNaN(cleanAmount) || cleanAmount <= 0) return;

    const targetMonths = getUpcomingRentMonths(recordMonthsCount);
    const periodLabel =
      recordMonthsCount > 1
        ? `${targetMonths[0]} – ${targetMonths[recordMonthsCount - 1]} (${recordMonthsCount} Months)`
        : targetMonths[0] || currentMonth;

    setIsSubmittingRecord(true);
    try {
      const res = await recordRentPayment({
        unit_id: recordTarget.unit_id,
        building_id: recordTarget.building_id,
        landlord_id: user?.id || "mock-landlord",
        landlord_name: profile?.full_name || "Landlord Management",
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
        payment_method: recordMethod,
        notes:
          recordNotes ||
          (recordMethod === "cash"
            ? (isFrench
                ? "Remis en espèces au bailleur (Paiement physique)"
                : "Remis en espèces au bailleur (Physical cash handover)")
            : (isFrench
                ? "Enregistré manuellement par le bailleur"
                : "Recorded manually by landlord")),
      });

      if (res.success && res.payment) {
        await loadData();
        const savedPayment = res.payment;
        const usedMethod = recordMethod;
        setRecordTarget(null);

        if (usedMethod === "cash") {
          // Immediately prompt landlord with Cash Handover notification to dispatch receipt via WhatsApp
          setCashConfirmedPayment(savedPayment);
        } else {
          setSelectedReceipt(savedPayment);
          setShowReceiptModal(true);
        }
      }
    } catch (err) {
      console.error("Error recording payment:", err);
    } finally {
      setIsSubmittingRecord(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isFrench
              ? "Chargement des registres de loyers et statuts des locataires..."
              : "Loading rent ledgers and tenant statuses..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Unified SaaS Dashboard Navigation Bar */}
      <DashboardNav
        user={user}
        profile={profile}
        buildingsCount={buildings.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24 lg:pb-12">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold mb-2">
              <Receipt className="w-3.5 h-3.5" />
              <span>
                {isFrench
                  ? "Encaissement des Loyers & Suivi des Arriérés"
                  : "Rent Collection & Tenant Arrears Consultation"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {isFrench
                ? "Paiements de Loyer & Registres des Locataires"
                : "Rent Payments & Tenant Ledgers"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
              {isFrench
                ? "Consultez le statut de paiement de chaque locataire, suivez les paiements partiels, inspectez les arriérés et accédez aux quittances officielles."
                : "Consult rent payment status for every tenant, track partial payments, inspect outstanding arrears, and review official receipts."}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
              {isFrench ? "Période de facturation" : "Billing Period"}
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 inline-block mt-0.5 shadow-sm">
              {currentMonth}
            </span>
          </div>
        </div>

        {/* Financial KPI Dashboard Strip: Rich Colors in both Light & Dark Mode */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Expected Rent */}
          <div className="bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50/50 dark:bg-none dark:bg-slate-900 border-2 border-blue-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-blue-800 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Loyer Mensuel Attendu" : "Expected Monthly"}</span>
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-blue-950 dark:text-white font-mono block">
              {totalExpectedRent.toLocaleString()} <span className="text-xs text-blue-700 dark:text-slate-500 font-normal">XAF</span>
            </span>
            <span className="text-[10px] text-blue-700 dark:text-slate-400 block font-semibold">
              {isFrench
                ? `Sur ${statuses.length} logements occupés`
                : `Across ${statuses.length} occupied units`}
            </span>
          </div>

          {/* Collected Rent */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50/40 dark:bg-none dark:bg-slate-900 border-2 border-emerald-300 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-emerald-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Total Encaissé" : "Collected So Far"}</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-emerald-900 dark:text-emerald-400 font-mono block">
              {totalCollectedRent.toLocaleString()} <span className="text-xs text-emerald-700 dark:text-slate-500 font-normal">XAF</span>
            </span>
            <span className="text-[10px] text-emerald-900 dark:text-emerald-400/80 block font-bold">
              {totalExpectedRent > 0
                ? isFrench
                  ? `Taux de recouvrement : ${((totalCollectedRent / totalExpectedRent) * 100).toFixed(0)}%`
                  : `${((totalCollectedRent / totalExpectedRent) * 100).toFixed(0)}% recovery rate`
                : isFrench
                ? "Aucun loyer exigible"
                : "No rent due"}
            </span>
          </div>

          {/* Outstanding Arrears (Owing) */}
          <div
            className={`rounded-2xl p-4.5 space-y-2 border-2 shadow-sm ${
              totalOwingBalance > 0
                ? "bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50/40 border-amber-300 dark:bg-none dark:bg-slate-900 dark:border-amber-500/30"
                : "bg-slate-50 border-slate-200 dark:bg-none dark:bg-slate-900 dark:border-slate-800"
            }`}
          >
            <div className="flex items-center justify-between text-amber-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Arriérés & Soldes Dus" : "Total Balance Owing"}</span>
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <span
              className={`text-2xl font-black font-mono block ${
                totalOwingBalance > 0 ? "text-amber-950 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {totalOwingBalance.toLocaleString()} <span className="text-xs text-amber-700 dark:text-slate-500 font-normal">XAF</span>
            </span>
            <span className="text-[10px] text-amber-900 dark:text-slate-400 block font-bold">
              {totalOwingTenants > 0
                ? isFrench
                  ? `${totalOwingTenants} locataires avec solde dû`
                  : `${totalOwingTenants} tenants currently owing`
                : isFrench
                ? "Tous les locataires sont à jour"
                : "All tenants fully settled"}
            </span>
          </div>

          {/* Tenant Compliance Stats */}
          <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50/40 dark:bg-none dark:bg-slate-900 border-2 border-purple-200 dark:border-slate-800 rounded-2xl p-4.5 space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-purple-900 dark:text-slate-400 text-[11px] font-bold uppercase">
              <span>{isFrench ? "Statut de Règlement" : "Settlement Status"}</span>
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-xl font-black text-emerald-800 dark:text-emerald-400">
                {totalPaidTenants} {isFrench ? "Soldés" : "Paid"}
              </span>
              <span className="text-slate-400 dark:text-slate-600 font-bold">•</span>
              <span className="text-xl font-black text-amber-800 dark:text-amber-400">
                {totalOwingTenants} {isFrench ? "En retard" : "Owing"}
              </span>
            </div>
            {totalOverdueTenants > 0 ? (
              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block animate-pulse">
                {isFrench
                  ? `⚠ ${totalOverdueTenants} en retard (délai dépassé)`
                  : `⚠ ${totalOverdueTenants} overdue (past due date)`}
              </span>
            ) : (
              <span className="text-[10px] text-emerald-800 dark:text-emerald-400 block font-semibold">
                {isFrench ? "Aucun retard critique" : "No critical overdue penalties"}
              </span>
            )}
          </div>
        </div>

        {/* Toolbar: Search, Property Filter & Status Pills */}
        <div className="bg-white dark:bg-slate-900/80 border-2 border-slate-300 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isFrench
                  ? "Rechercher par locataire, logement, téléphone..."
                  : "Search tenant name, unit, phone..."
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl pl-9.5 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Building Selector */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition cursor-pointer"
            >
              <option value="all">
                {isFrench
                  ? `Toutes les Propriétés (${statuses.length} Logements)`
                  : `All Properties (${statuses.length} Units)`}
              </option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-300 dark:border-slate-800 text-xs">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {isFrench ? "Tous" : "All"}
              </button>

              <button
                onClick={() => setStatusFilter("owing")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "owing"
                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-transparent shadow-xs"
                    : "text-amber-800 dark:text-slate-400 hover:text-amber-900 dark:hover:text-white"
                }`}
              >
                {isFrench ? `En Retard / Solde (${totalOwingTenants})` : `Owing (${totalOwingTenants})`}
              </button>

              <button
                onClick={() => setStatusFilter("paid")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  statusFilter === "paid"
                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-transparent shadow-xs"
                    : "text-emerald-800 dark:text-slate-400 hover:text-emerald-900 dark:hover:text-white"
                }`}
              >
                {isFrench ? `Soldés (${totalPaidTenants})` : `Paid (${totalPaidTenants})`}
              </button>

              {totalOverdueTenants > 0 && (
                <button
                  onClick={() => setStatusFilter("overdue")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    statusFilter === "overdue"
                      ? "bg-rose-100 dark:bg-rose-500/20 text-rose-900 dark:text-rose-300 border border-rose-300 dark:border-transparent shadow-xs"
                      : "text-rose-700 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-300"
                  }`}
                >
                  {isFrench ? `Dépassement (${totalOverdueTenants})` : `Overdue (${totalOverdueTenants})`}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Empty State */}
        {statuses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4 max-w-lg mx-auto my-10 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <Receipt className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isFrench ? "Aucun Logement Occupé dans le Portefeuille" : "No Occupied Units in Portfolio"}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isFrench
                  ? "Attribuez des locataires à vos logements dans la section Immeubles & Logements pour générer des registres de loyers, suivre les paiements partiels et consulter les quittances."
                  : "Assign tenants to your units in the Buildings & Units section to start generating rent ledgers, tracking partial payments, and monitoring receipts."}
              </p>
            </div>
            <Link
              href="/dashboard/buildings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm"
            >
              <DoorOpen className="w-4 h-4" />
              <span>{isFrench ? "Aller aux Immeubles & Logements" : "Go to Buildings & Units"}</span>
            </Link>
          </div>
        ) : filteredStatuses.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <AlertCircle className="w-8 h-8 text-amber-500 dark:text-amber-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isFrench ? "Aucun Locataire ne Correspond au Filtre" : "No Tenants Match Your Filter"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isFrench
                ? "Aucun locataire ne correspond aux filtres actuels. Effacez votre recherche ou réinitialisez le filtre."
                : "No tenants match the current filters. Clear your search or reset the filter."}
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedBuildingId("all");
                setStatusFilter("all");
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-white border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              {isFrench ? "Réinitialiser les Filtres" : "Reset Filters"}
            </button>
          </div>
        ) : (
          /* Tenant Rent Status Cards */
          <div className="space-y-4">
            {filteredStatuses.map((tenantStatus) => {
              const isOwing = tenantStatus.is_owing;
              const isOverdue = tenantStatus.status === "overdue";
              const isPaid = tenantStatus.status === "paid";
              const isPartial = tenantStatus.status === "partial";

              // WhatsApp Reminder URL
              const reminderWhatsAppUrl = tenantStatus.tenant_phone
                ? buildPaymentConfirmationWhatsAppUrl({
                    recipientPhone: tenantStatus.tenant_phone,
                    recipientName: tenantStatus.tenant_name,
                    senderRole: "landlord",
                    tenantName: tenantStatus.tenant_name,
                    unitNumber: tenantStatus.unit_number,
                    buildingName: tenantStatus.building_name,
                    amountPaid: tenantStatus.amount_paid_current_month,
                    rentMonth: currentMonth,
                    receiptNumber: tenantStatus.last_receipt_number || "PENDING",
                    balanceRemaining: tenantStatus.balance_owing_current_month,
                    paymentMethod: "momo",
                    language: language,
                  }).url
                : null;

              return (
                <div
                  key={tenantStatus.unit_id}
                  className={`bg-white dark:bg-slate-900 border-2 rounded-2xl p-5 sm:p-6 shadow-md transition space-y-5 ${
                    isOverdue
                      ? "border-rose-400 bg-gradient-to-r from-rose-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-rose-950/10"
                      : isPartial
                      ? "border-amber-400 bg-gradient-to-r from-amber-50/50 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-amber-950/10"
                      : "border-slate-300 dark:border-slate-800 hover:border-blue-400 dark:hover:border-slate-700"
                  }`}
                >
                  {/* Top Bar: Tenant, Apartment, Status Pill */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
                    <div className="flex items-start sm:items-center gap-3.5">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-md">
                        {tenantStatus.tenant_name.substring(0, 2).toUpperCase()}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                            {tenantStatus.tenant_name}
                          </h2>

                          {/* Status Badge */}
                          {isPaid ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/15 border-2 border-emerald-400 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{isFrench ? "Intégralement Payé (Soldé)" : "Paid in Full"}</span>
                            </span>
                          ) : isPartial ? (
                            <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/15 border-2 border-amber-400 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center gap-1 shadow-xs">
                              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                              <span>{isFrench ? "Paiement Partiel (Solde Dû)" : "Partial Payment (Owing)"}</span>
                            </span>
                          ) : isOverdue ? (
                            <span className="px-3 py-1 rounded-full bg-rose-100 dark:bg-rose-500/20 border-2 border-rose-400 dark:border-rose-500/40 text-rose-900 dark:text-rose-300 text-xs font-bold flex items-center gap-1 animate-pulse shadow-xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-300" />
                              <span>
                                {isFrench
                                  ? `En retard de ${tenantStatus.days_late} Jours`
                                  : `Overdue by ${tenantStatus.days_late} Days`}
                              </span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300 text-xs font-bold">
                              {isFrench ? "Non Payé • Exigible le 5" : "Unpaid • Due 5th"}
                            </span>
                          )}

                          {/* Advance Months Badge */}
                          {tenantStatus.advance_months_paid && tenantStatus.advance_months_paid.length > 0 && (
                            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-500/15 border-2 border-blue-300 dark:border-blue-500/30 text-blue-900 dark:text-blue-300 text-xs font-bold flex items-center gap-1 shadow-xs">
                              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>
                                {isFrench
                                  ? `Avance payée : ${tenantStatus.advance_months_paid.join(", ")}`
                                  : `Advance Paid: ${tenantStatus.advance_months_paid.join(", ")}`}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mt-1">
                          <span className="text-slate-900 dark:text-white font-bold">
                            {tenantStatus.building_name}
                          </span>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold">
                            {isFrench ? `Logement ${tenantStatus.unit_number}` : `Unit ${tenantStatus.unit_number}`}
                          </span>
                          {tenantStatus.tenant_phone && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-slate-700 dark:text-slate-400 font-semibold">
                                {tenantStatus.tenant_phone}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Contact & Action Buttons */}
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      {reminderWhatsAppUrl && (
                        <a
                          href={reminderWhatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                          title="WhatsApp Tenant"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-white" />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      <button
                        onClick={() => openRecordModal(tenantStatus)}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition cursor-pointer"
                        title={isFrench ? "Enregistrer un paiement en espèces" : "Record physical cash handed over by tenant"}
                      >
                        <DollarSign className="w-3.5 h-3.5 text-white" />
                        <span>{isFrench ? "Enregistrer Espèces" : "Record Cash Payment"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Financial Overview Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-100 dark:bg-slate-950/70 rounded-xl border border-slate-300 dark:border-slate-800">
                      <span className="text-[10px] text-slate-600 dark:text-slate-500 uppercase font-bold block">
                        {isFrench ? "Loyer Mensuel" : "Monthly Rent"}
                      </span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {tenantStatus.monthly_rent.toLocaleString()} XAF
                      </span>
                    </div>

                    <div className="p-3 bg-emerald-50/80 dark:bg-slate-950/70 rounded-xl border-2 border-emerald-300 dark:border-slate-800">
                      <span className="text-[10px] text-emerald-900 dark:text-slate-500 uppercase font-bold block">
                        {isFrench ? "Payé ce Mois" : "Paid This Month"}
                      </span>
                      <span className="text-sm font-black text-emerald-800 dark:text-emerald-400 font-mono">
                        {tenantStatus.amount_paid_current_month.toLocaleString()} XAF
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl border-2 ${
                        isOwing
                          ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30"
                          : "bg-slate-50 dark:bg-slate-950/70 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <span className={`text-[10px] uppercase font-bold block ${isOwing ? "text-amber-900 dark:text-slate-400" : "text-slate-600 dark:text-slate-500"}`}>
                        {isFrench ? "Solde Restant Dû" : "Amount Owing (Solde)"}
                      </span>
                      <span
                        className={`text-sm font-black font-mono ${
                          isOwing ? "text-amber-950 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {tenantStatus.balance_owing_current_month.toLocaleString()} XAF
                      </span>
                    </div>

                    <div className="p-3 bg-blue-50/80 dark:bg-slate-950/70 rounded-xl border-2 border-blue-200 dark:border-slate-800 flex flex-col justify-between">
                      <span className="text-[10px] text-blue-900 dark:text-slate-500 uppercase font-bold block">
                        {isFrench ? "Quittances Émises" : "Receipts Issued"}
                      </span>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-blue-950 dark:text-white font-mono">
                          {tenantStatus.payments.length}{" "}
                          {isFrench
                            ? tenantStatus.payments.length > 1
                              ? "quittances"
                              : "quittance"
                            : tenantStatus.payments.length > 1
                            ? "receipts"
                            : "receipt"}
                        </span>
                        {tenantStatus.payments.length > 0 && (
                          <button
                            onClick={() => setInspectTenantReceipts(tenantStatus)}
                            className="text-[11px] text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-bold underline cursor-pointer"
                          >
                            {isFrench ? "Voir Tout" : "View All"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Latest Payment / Receipt Strip */}
                  {tenantStatus.payments.length > 0 ? (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-slate-700 dark:text-slate-400 font-medium">
                          {isFrench ? "Dernier Paiement : " : "Latest Payment: "}
                          <strong className="text-slate-900 dark:text-white font-mono font-bold">
                            {tenantStatus.last_receipt_number}
                          </strong>{" "}
                          ({tenantStatus.payments[0].rent_month}){" "}
                          {isFrench ? "le" : "on"}{" "}
                          {new Date(tenantStatus.payments[0].created_at).toLocaleDateString(
                            isFrench ? "fr-FR" : "en-US"
                          )}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedReceipt(tenantStatus.payments[0]);
                          setShowReceiptModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-slate-200 text-xs font-bold border-2 border-blue-200 dark:border-slate-700 transition cursor-pointer self-start sm:self-auto shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{isFrench ? "Voir la Quittance" : "Inspect Latest Receipt"}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-500 flex items-center justify-between">
                      <span>
                        {isFrench
                          ? "Aucune quittance enregistrée pour ce locataire."
                          : "No receipts registered yet for this tenant."}
                      </span>
                      <button
                        onClick={() => openRecordModal(tenantStatus)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                      >
                        {isFrench ? "+ Enregistrer paiement en espèces" : "+ Record Cash Payment"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Manual Payment Recording Modal (Landlord Physical Cash or Offline) */}
      {recordTarget && (() => {
        const targetMonths = getUpcomingRentMonths(recordMonthsCount);
        const periodLabel =
          recordMonthsCount > 1
            ? `${targetMonths[0]} – ${targetMonths[recordMonthsCount - 1]} (${recordMonthsCount} ${
                isFrench ? "Mois" : "Months"
              })`
            : targetMonths[0] || currentMonth;

        const monthlyRent = Number(recordTarget.monthly_rent || 0);
        const owingThisMonth = Math.max(0, Number(recordTarget.balance_owing_current_month || 0));
        const totalPeriodExpected =
          recordMonthsCount === 1
            ? owingThisMonth > 0
              ? owingThisMonth
              : monthlyRent
            : owingThisMonth + (recordMonthsCount - 1) * monthlyRent;

        const numericAmount = parseFloat(recordAmount) || 0;
        const willBeFullyPaid =
          totalPeriodExpected > 0
            ? numericAmount >= totalPeriodExpected
            : numericAmount > 0;
        const balanceAfterPayment = Math.max(0, totalPeriodExpected - numericAmount);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isFrench
                      ? "Enregistrer un Paiement en Espèces"
                      : "Record Physical Cash Payment"}
                  </h3>
                </div>
                <button
                  onClick={() => setRecordTarget(null)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="p-6 space-y-4 text-xs">
                {/* Tenant & Property Overview Strip */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">
                      {isFrench ? "Locataire & Logement" : "Tenant & Apartment"}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {monthlyRent.toLocaleString()} XAF / {isFrench ? "mois" : "month"}
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white text-sm">{recordTarget.tenant_name}</p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">
                    {recordTarget.building_name} • {isFrench ? "Logement" : "Unit"}{" "}
                    {recordTarget.unit_number}
                    {recordTarget.tenant_phone && ` • ${recordTarget.tenant_phone}`}
                  </p>
                  {owingThisMonth > 0 && (
                    <p className="text-amber-600 dark:text-amber-400 font-medium text-[11px] pt-0.5">
                      {isFrench
                        ? `Solde dû pour le mois en cours : ${owingThisMonth.toLocaleString()} XAF`
                        : `Current Month Balance Due: ${owingThisMonth.toLocaleString()} XAF`}
                    </p>
                  )}
                </div>

                {/* MULTI-MONTH RENT SELECTOR */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>
                          {isFrench
                            ? "Nombre de mois réglés par le locataire :"
                            : "Number of Months Tenant is Paying:"}
                        </span>
                      </label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {isFrench
                          ? "Par défaut 1 mois. Vous pouvez ajouter des mois futurs si le locataire avance son loyer."
                          : "Default is 1 month. You can add future months if tenant is advancing."}
                      </p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl p-1">
                      <button
                        type="button"
                        disabled={recordMonthsCount <= 1}
                        onClick={() =>
                          setRecordMonthsCount((prev) => Math.max(1, prev - 1))
                        }
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer text-xs"
                        title={isFrench ? "Diminuer d'un mois" : "Decrease month"}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 font-mono font-bold text-xs text-blue-600 dark:text-blue-400 min-w-[55px] text-center">
                        {recordMonthsCount}{" "}
                        {recordMonthsCount === 1
                          ? isFrench
                            ? "Mois"
                            : "Month"
                          : isFrench
                          ? "Mois"
                          : "Months"}
                      </span>
                      <button
                        type="button"
                        disabled={recordMonthsCount >= 12}
                        onClick={() =>
                          setRecordMonthsCount((prev) => Math.min(12, prev + 1))
                        }
                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer text-xs"
                        title={isFrench ? "Ajouter un mois" : "Add another month"}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Preset Month Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {[1, 2, 3, 6, 12].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setRecordMonthsCount(cnt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer border ${
                          recordMonthsCount === cnt
                            ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                            : "bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {cnt === 1
                          ? isFrench
                            ? "1 Mois (Actuel)"
                            : "1 Month (Current)"
                          : `${cnt} ${isFrench ? "Mois" : "Months"}`}
                      </button>
                    ))}
                  </div>

                  {/* Period & Total Expected Indicator */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isFrench ? "Période couverte :" : "Period Covered:"}{" "}
                      <strong className="text-slate-900 dark:text-white">{periodLabel}</strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {isFrench ? "Attendu :" : "Expected:"}{" "}
                      <strong className="text-slate-900 dark:text-white font-bold">
                        {totalPeriodExpected.toLocaleString()} XAF
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Amount Received Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                      {isFrench
                        ? "Montant remis en mains propres / Reçu (XAF) :"
                        : "Amount Handed Over / Received (XAF):"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setRecordAmount(String(totalPeriodExpected))}
                      className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      {isFrench
                        ? `Remplir montant attendu (${totalPeriodExpected.toLocaleString()} XAF)`
                        : `Fill Standard Total (${totalPeriodExpected.toLocaleString()} XAF)`}
                    </button>
                  </div>

                  {/* Clean input without spinners, empty by default */}
                  <input
                    type="number"
                    step="any"
                    min="1"
                    value={recordAmount}
                    onChange={(e) => setRecordAmount(e.target.value)}
                    placeholder={
                      isFrench
                        ? "ex. 40000, 20000, 13000..."
                        : "e.g. 40000, 20000, 13000..."
                    }
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition"
                    autoFocus
                    required
                  />

                  {/* Real-Time Status Change Preview */}
                  {numericAmount > 0 && (
                    <div
                      className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                        willBeFullyPaid
                          ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                          : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {willBeFullyPaid ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            {isFrench ? (
                              <>
                                Le statut du locataire deviendra directement :{" "}
                                <strong>Complètement Soldé ✅</strong>
                              </>
                            ) : (
                              <>
                                Tenant status will directly become:{" "}
                                <strong>Completely Paid (Soldé) ✅</strong>
                              </>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span>
                            {isFrench ? (
                              <>
                                Le statut du locataire deviendra directement :{" "}
                                <strong>Partiellement Payé ⏳</strong> (Solde restant :{" "}
                                {balanceAfterPayment.toLocaleString()} XAF)
                              </>
                            ) : (
                              <>
                                Tenant status will directly become:{" "}
                                <strong>Partially Paid ⏳</strong> (Remaining solde:{" "}
                                {balanceAfterPayment.toLocaleString()} XAF)
                              </>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Notes Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    {isFrench ? "Remarques (Optionnel) :" : "Notes (Optional):"}
                  </label>
                  <input
                    type="text"
                    value={recordNotes}
                    onChange={(e) => setRecordNotes(e.target.value)}
                    placeholder={
                      isFrench
                        ? "ex. Remis en espèces à la résidence, reçu d'acompte..."
                        : "e.g. Received in cash at residence, deposit receipt..."
                    }
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setRecordTarget(null)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    {isFrench ? "Annuler" : "Cancel"}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingRecord}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingRecord
                      ? isFrench
                        ? "Enregistrement & Délivrance du reçu..."
                        : "Recording & Issuing Receipt..."
                      : isFrench
                      ? "Confirmer Espèces & Générer Quittance"
                      : "Confirm Cash & Generate Receipt"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Cash Payment Handover Confirmation & Direct WhatsApp Receipt Dispatch Modal */}
      {cashConfirmedPayment && (() => {
        const cashWhatsApp = buildPaymentConfirmationWhatsAppUrl({
          recipientPhone: cashConfirmedPayment.tenant_phone,
          recipientName: cashConfirmedPayment.tenant_name,
          senderRole: "landlord",
          tenantName: cashConfirmedPayment.tenant_name,
          unitNumber: cashConfirmedPayment.unit_number,
          buildingName: cashConfirmedPayment.building_name,
          amountPaid: cashConfirmedPayment.amount_paid,
          rentMonth: cashConfirmedPayment.rent_month,
          receiptNumber: cashConfirmedPayment.receipt_number,
          balanceRemaining: cashConfirmedPayment.balance_remaining,
          paymentMethod: "cash",
          language: language,
        });

        const isCompletelyPaid = cashConfirmedPayment.balance_remaining === 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-3xl shadow-2xl overflow-hidden my-6">
              {/* Glow Accent Top Strip */}
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

              <div className="p-6 sm:p-7 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                        {isFrench ? "💵 Espèces Reçues Physiquement" : "💵 Cash Received Physically"}
                      </span>
                      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {isFrench
                          ? "Quittance Certifiée & Prête à être Envoyée"
                          : "Receipt Certified & Ready to Dispatch"}
                      </h3>
                    </div>
                  </div>

                  <button
                    onClick={() => setCashConfirmedPayment(null)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {isFrench ? (
                    <>
                      Le paiement physique en espèces de{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {Number(cashConfirmedPayment.amount_paid).toLocaleString()} XAF
                      </strong>{" "}
                      par <strong className="text-slate-900 dark:text-white">{cashConfirmedPayment.tenant_name}</strong>{" "}
                      a été validé. Le statut de son registre est passé directement à{" "}
                      <strong className={isCompletelyPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                        {isCompletelyPaid ? "Complètement Soldé ✅" : "Partiellement Payé ⏳"}
                      </strong>.
                    </>
                  ) : (
                    <>
                      The physical cash payment of{" "}
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                        {Number(cashConfirmedPayment.amount_paid).toLocaleString()} XAF
                      </strong>{" "}
                      from <strong className="text-slate-900 dark:text-white">{cashConfirmedPayment.tenant_name}</strong>{" "}
                      has been saved. The tenant&apos;s ledger status directly changed to{" "}
                      <strong className={isCompletelyPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                        {isCompletelyPaid ? "Completely Paid (Soldé) ✅" : "Partially Paid ⏳"}
                      </strong>.
                    </>
                  )}
                </p>

                {/* Certified Receipt Card */}
                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isFrench ? "N° de Quittance Officielle" : "Official Receipt N°"}
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {cashConfirmedPayment.receipt_number}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">
                        {isFrench ? "Nom du Locataire" : "Tenant Name"}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {cashConfirmedPayment.tenant_name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {cashConfirmedPayment.tenant_phone}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">
                        {isFrench ? "Logement" : "Apartment"}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {isFrench ? "Logement" : "Unit"} {cashConfirmedPayment.unit_number}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {cashConfirmedPayment.building_name}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200 dark:border-slate-800/60">
                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">
                        {isFrench ? "Période Couverte" : "Period Covered"}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                        {cashConfirmedPayment.rent_month}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold block">
                        {isFrench ? "Solde Restant Dû" : "Remaining Solde"}
                      </span>
                      <span
                        className={`font-bold font-mono ${
                          isCompletelyPaid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {Number(cashConfirmedPayment.balance_remaining).toLocaleString()} XAF
                      </span>
                    </div>
                  </div>

                  {/* Stamp Reference */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {isFrench
                        ? `Certifié avec sceau officiel unique pour ${profile?.full_name || "le bailleur"}.`
                        : `Certified with unique stamp for ${profile?.full_name || "Landlord"}.`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2.5 pt-1">
                  {/* WhatsApp Dispatch Button */}
                  <a
                    href={cashWhatsApp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    <span>
                      {isFrench
                        ? "Notifier & Envoyer la Quittance au Locataire via WhatsApp"
                        : "Notify & Send Receipt to Tenant via WhatsApp"}
                    </span>
                  </a>

                  {/* Inspect Stamped Receipt */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReceipt(cashConfirmedPayment);
                      setShowReceiptModal(true);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>
                      {isFrench
                        ? "Voir & Télécharger la Quittance avec Sceau Officiel"
                        : "Inspect & Download Stamped Official Receipt"}
                    </span>
                  </button>

                  {/* Copy message text */}
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(cashWhatsApp.message);
                        setCopiedNotice(true);
                        setTimeout(() => setCopiedNotice(false), 2500);
                      }
                    }}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    {copiedNotice ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {isFrench
                            ? "Texte de la quittance copié dans le presse-papier !"
                            : "Receipt text copied to clipboard!"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {isFrench
                            ? "Copier le texte de notification de quittance"
                            : "Copy Receipt Notification Text"}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCashConfirmedPayment(null)}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition text-center cursor-pointer"
                  >
                    {isFrench ? "Terminer" : "Done"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Inspect All Tenant Receipts Drawer */}
      {inspectTenantReceipts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isFrench
                    ? `Quittances pour ${inspectTenantReceipts.tenant_name}`
                    : `Receipts for ${inspectTenantReceipts.tenant_name}`}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {inspectTenantReceipts.building_name} • {isFrench ? "Logement" : "Unit"}{" "}
                  {inspectTenantReceipts.unit_number}
                </p>
              </div>
              <button
                onClick={() => setInspectTenantReceipts(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs divide-y divide-slate-100 dark:divide-slate-800">
              {inspectTenantReceipts.payments.map((p) => (
                <div key={p.id} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {p.receipt_number}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {p.rent_month}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                      {isFrench ? "Payé le :" : "Paid:"}{" "}
                      {new Date(p.created_at).toLocaleDateString(isFrench ? "fr-FR" : "en-US")}{" "}
                      via {PAYMENT_METHOD_LABELS[p.payment_method]?.short || p.payment_method}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {Number(p.amount_paid).toLocaleString()} XAF
                    </span>
                    <button
                      onClick={() => {
                        setSelectedReceipt(p);
                        setShowReceiptModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition cursor-pointer"
                    >
                      {isFrench ? "Voir" : "View"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      <PaymentReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        payment={selectedReceipt}
        landlordName={profile?.full_name || (isFrench ? "Gestion Immobilière" : "Landlord Management")}
        landlordPhone={profile?.phone || undefined}
      />
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-800 dark:text-white">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      }
    >
      <PaymentsContent />
    </Suspense>
  );
}
