"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  Receipt,
  Wrench,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Sparkles,
  ChevronDown,
  TrendingUp,
  CreditCard,
  Users,
  BellRing,
  Lock,
  FileCheck2,
  Zap,
  ExternalLink,
  ChevronRight,
  Send,
  Sliders,
  DollarSign,
  Download,
  ArrowUp,
} from "lucide-react";
import { AVAILABLE_PLANS } from "@/types/database";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";

export default function HomePage() {
  const { isFrench } = useLanguage();
  const [activePreviewTab, setActivePreviewTab] = useState<"ledger" | "buildings" | "receipt" | "repairs">("ledger");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [unitCountSlider, setUnitCountSlider] = useState<number>(24);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Dynamic plan finder based on slider
  const suggestedPlan = useMemo(() => {
    return (
      AVAILABLE_PLANS.find((p) => {
        if (billingCycle === "annual" && p.isFreeTrial) return false;
        return unitCountSlider <= p.maxUnits;
      }) || AVAILABLE_PLANS[AVAILABLE_PLANS.length - 1]
    );
  }, [unitCountSlider, billingCycle]);

  // When annual, hide the 30-day Free Trial because it cannot be subscribed annually
  const displayedPlans = useMemo(() => {
    if (billingCycle === "annual") {
      return AVAILABLE_PLANS.filter((p) => !p.isFreeTrial);
    }
    return AVAILABLE_PLANS;
  }, [billingCycle]);

  const faqs = isFrench
    ? [
        {
          q: "Comment fonctionne l'essai gratuit de 30 jours ?",
          a: "Dès votre inscription, votre compte est immédiatement activé avec la formule Essai Gratuit (jusqu'à 5 logements). Vous bénéficiez d'un accès complet sans aucune carte bancaire requise. À la fin des 30 jours, vous pouvez choisir la formule adaptée à votre portefeuille.",
        },
        {
          q: "Les locataires doivent-ils installer une application depuis Play Store ou App Store ?",
          a: "Non ! LeaseLink est une Progressive Web App (PWA). Les locataires accèdent à leur espace via un lien sécurisé envoyé par WhatsApp ou SMS. Ils peuvent l'ajouter en 1 clic sur leur écran d'accueil sans occuper de stockage sur leur téléphone.",
        },
        {
          q: "Comment sont générées les quittances de loyer ?",
          a: "Dès que vous enregistrez un encaissement (MTN Mobile Money, Orange Money, Espèces), LeaseLink génère instantanément une quittance certifiée conforme avec QR code, tampon officiel et signature du bailleur, prête à être partagée sur WhatsApp ou téléchargée en PDF.",
        },
        {
          q: "Mes locataires reçoivent-ils des notifications lors de l'arrivée de nouveaux voisins ?",
          a: "Oui ! Lorsqu'un nouveau locataire est assigné à un logement dans un immeuble spécifique, le système notifie automatiquement les locataires de ce même bâtiment pour leur souhaiter la bienvenue et préserver l'harmonie de la communauté.",
        },
        {
          q: "Puis-je gérer plusieurs immeubles situés dans différentes villes ?",
          a: "Absolument. Vous pouvez structurer votre portefeuille par immeubles, résidences ou cités, avec des devises, adresses et régimes locatifs distincts sous un seul et même tableau de bord centralisé.",
        },
      ]
    : [
        {
          q: "How does the 30-day free trial work?",
          a: "Upon registration, your account is instantly activated with the Free Trial tier (up to 5 units). You get complete, unconstrained access with zero credit card required. After 30 days, simply select the tier matching your property size.",
        },
        {
          q: "Do tenants have to download an app from an app store?",
          a: "No! LeaseLink is an instant Progressive Web App (PWA). Tenants log in via an encrypted magic link or WhatsApp credentials. They can pin it to their home screen with one tap without consuming phone storage.",
        },
        {
          q: "How are certified rent receipts generated?",
          a: "The moment a payment is recorded (MTN MoMo, Orange Money, Cash), LeaseLink instantly produces a tamper-proof receipt bearing an official seal, QR code, and landlord signature, ready for instant WhatsApp dispatch or PDF download.",
        },
        {
          q: "Are tenants informed when new neighbors move into their building?",
          a: "Yes! Whenever a tenant is assigned to a unit in a specific building, automated notifications announce the arrival to fellow residents of that building, fostering community safety and transparent building management.",
        },
        {
          q: "Can I manage multiple buildings across different locations?",
          a: "Absolutely. You can group your portfolio across distinct properties, duplexes, or student residences, each with independent rent schedules, addresses, and ledgers in a single unified dashboard.",
        },
      ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/80 backdrop-blur-xl sticky top-[var(--pwa-banner-height,0px)] z-50 shadow-xs transition-[top] duration-150">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-8 shrink-0">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300 shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="shrink-0">
                <span className="font-extrabold text-base sm:text-xl text-slate-900 dark:text-white tracking-tight">
                  Lease<span className="text-blue-600 dark:text-blue-500">Link</span>
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 uppercase tracking-widest">
                  PropTech 2026
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-700 dark:text-slate-400">
              <a href="#features" className="hover:text-blue-600 dark:hover:text-white transition">
                {isFrench ? "Fonctionnalités" : "Features"}
              </a>
              <a href="#showcase" className="hover:text-blue-600 dark:hover:text-white transition">
                {isFrench ? "Aperçu en Direct" : "Live Demo"}
              </a>
              <a href="#pricing" className="hover:text-blue-600 dark:hover:text-white transition">
                {isFrench ? "Tarifs" : "Pricing"}
              </a>
              <a href="#faq" className="hover:text-blue-600 dark:hover:text-white transition">
                FAQ
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <LanguageSwitcher variant="pill" />
            <ThemeSwitcher variant="pill" />

            <Link
              href="/tenant/login"
              className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isFrench ? "Espace Locataire" : "Tenant Portal"}</span>
            </Link>

            <Link
              href="/login"
              className="hidden sm:inline-flex text-xs sm:text-sm font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-white px-2 py-1.5 transition shrink-0 whitespace-nowrap"
            >
              {isFrench ? "Connexion" : "Sign In"}
            </Link>

            <Link
              href="/register"
              className="text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5 group cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>{isFrench ? "Essai Gratuit" : "Start Free"}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform hidden sm:inline" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 border-b border-slate-200 dark:border-slate-800/80 bg-gradient-to-b from-blue-50/40 via-white to-white dark:from-blue-900/10 dark:via-slate-950 dark:to-slate-950">
        {/* Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-blue-600/10 via-indigo-600/5 to-sky-400/5 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/5 via-slate-950/0 to-slate-950/0 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-7">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold tracking-wide shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span>
              {isFrench
                ? "Dites adieu aux carnets et reçus papier perdus"
                : "Say Goodbye to Lost Paper Ledgers & Handwritten Receipts"}
            </span>
          </div>

          {/* Main Title: Crisp Slate-900 in Light Mode, White in Dark Mode */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.1]">
            {isFrench ? (
              <>
                Gestion Locative Intelligente <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 dark:from-blue-400 dark:via-sky-300 dark:to-indigo-300 bg-clip-text text-transparent">
                  pour les Bailleurs Modernes.
                </span>
              </>
            ) : (
              <>
                Next-Gen Property Operations <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 dark:from-blue-400 dark:via-sky-300 dark:to-indigo-300 bg-clip-text text-transparent">
                  for High-Performing Landlords.
                </span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="max-w-3xl mx-auto text-base sm:text-xl text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            {isFrench
              ? "Centralisez vos immeubles, logements et locataires dans une Progressive Web App en temps réel. Enregistrez les loyers en 1 clic, délivrez des quittances certifiées avec cachet et traitez les réclamations sans tracas."
              : "Bring your properties, units, and tenant ledgers into a real-time Progressive Web App. Log payments in seconds, dispatch stamped digital receipts, and resolve maintenance tickets with zero friction."}
          </p>

          {/* CTAs with Strict WCAG Contrast Hierarchy */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{isFrench ? "Démarrer l'Essai Gratuit de 30 Jours" : "Start 30-Day Free Trial"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href="#showcase"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{isFrench ? "Explorer la Démo Interactive" : "Explore Interactive Demo"}</span>
              <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </a>

            <Link
              href="/tenant/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-400 dark:border-emerald-600/40 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isFrench ? "Espace Locataire" : "Tenant Portal"}</span>
            </Link>
          </div>

          {/* Mobile-only Sign In Link */}
          <div className="pt-1 flex sm:hidden items-center justify-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-400">
              {isFrench ? "Déjà un compte bailleur ?" : "Already registered as a landlord?"}
            </span>
            <Link
              href="/login"
              className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>{isFrench ? "Se connecter" : "Sign in"}</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Reassurance Badges: High Contrast & Visible */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs text-slate-800 dark:text-slate-300 font-semibold border-t border-slate-200 dark:border-slate-800 max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{isFrench ? "Essai Gratuit 30 Jours" : "30-Day Free Trial"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>{isFrench ? "PWA Mobile & Bureau (Hors-ligne)" : "Mobile & Desktop PWA"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{isFrench ? "Quittances WhatsApp Instantanées" : "Instant WhatsApp Receipts"}</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>{isFrench ? "Isolation Stricte RLS" : "Encrypted RLS Isolation"}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Platform Showcase (Live Demo Sandbox) */}
      <section id="showcase" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 text-xs font-bold mb-3 shadow-sm">
            <Sliders className="w-3.5 h-3.5" />
            <span>{isFrench ? "Aperçu de la Plateforme en Direct" : "Live Product Showcase"}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            {isFrench
              ? "Une Expérience Conçue pour la Vitesse et la Précision"
              : "Engineered for Clarity, Speed, and Compliance"}
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
            {isFrench
              ? "Testez les différents modules de LeaseLink directement depuis cet aperçu interactif."
              : "Interact with LeaseLink's core operational views below."}
          </p>
        </div>

        {/* Mac-Style Window Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-slate-200/80 dark:ring-slate-800/80">
          {/* Window Header */}
          <div className="px-3.5 sm:px-5 py-3 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
            {/* Top row: Traffic dots + clean URL + live sync indicator */}
            <div className="flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono ml-1">
                  app.leaselink.cm<span className="hidden sm:inline">/dashboard</span>
                </span>
              </div>

              {/* Live sync badge - visible on mobile too */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span>{isFrench ? "En direct" : "Live Sync"}</span>
              </div>
            </div>

            {/* Interactive Tabs: 2x2 grid on mobile (<md) so all 4 tabs are 100% visible, flex on desktop (>=md) */}
            <div className="grid grid-cols-2 md:flex md:items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs font-semibold w-full md:w-auto">
              <button
                type="button"
                onClick={() => setActivePreviewTab("ledger")}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                  activePreviewTab === "ledger"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Receipt className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isFrench ? "Registre Loyers" : "Rent Ledger"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab("buildings")}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                  activePreviewTab === "buildings"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isFrench ? "Immeubles" : "Buildings"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab("receipt")}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                  activePreviewTab === "receipt"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isFrench ? "Quittance Certifiée" : "Certified Receipt"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePreviewTab("repairs")}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                  activePreviewTab === "repairs"
                    ? "bg-blue-600 text-white shadow-sm font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{isFrench ? "Réclamations" : "Repairs Desk"}</span>
              </button>
            </div>
          </div>

          {/* Window Canvas */}
          <div className="p-6 sm:p-8 bg-slate-50/60 dark:bg-slate-950/60 min-h-[460px]">
            {/* TAB 1: LIVE RENT LEDGER */}
            {activePreviewTab === "ledger" && (
              <div className="space-y-6">
                {/* Stats Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                      {isFrench ? "Total Loyers Collectés (Ce Mois)" : "Total Collected This Month"}
                    </span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                      2,850,000 XAF
                    </span>
                    <div className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{isFrench ? "94.2% du portefeuille encaissé" : "94.2% collection rate"}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                      {isFrench ? "Paiements en Attente" : "Pending Balance"}
                    </span>
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                      175,000 XAF
                    </span>
                    <span className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 block">
                      {isFrench ? "2 locataires à relancer" : "2 tenants to remind"}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">
                      {isFrench ? "Quittances Émises" : "Receipts Dispatched"}
                    </span>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">
                      24 / 26
                    </span>
                    <span className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 block">
                      {isFrench ? "100% avec cachet certifié" : "100% stamped & verified"}
                    </span>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/50">
                    <span>{isFrench ? "Encaissements Récents" : "Recent Rent Collections"}</span>
                    <span>{isFrench ? "Octobre 2026" : "October 2026"}</span>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                          4B
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">Jean-Pierre Kamga</p>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Résidence La Paix • {isFrench ? "Logement 4B" : "Unit 4B"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">120,000 XAF</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">MTN Mobile Money • #TX-8921</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isFrench ? "Quittance #LL-982" : "Receipt #LL-982"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                          12
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">Dr. Sylvie Mengue</p>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Cité Universitaire • {isFrench ? "Studio 12" : "Studio 12"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">180,000 XAF</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">Orange Money • #OM-4410</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isFrench ? "Quittance #LL-983" : "Receipt #LL-983"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                          02
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white text-sm">Alain Tcheuko</p>
                          <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Villa Horizon • {isFrench ? "Duplex 2" : "Duplex 2"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-black text-emerald-600 dark:text-emerald-400 text-sm">350,000 XAF</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{isFrench ? "Espèces Encaissées" : "Cash Collected"}</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isFrench ? "Quittance #LL-984" : "Receipt #LL-984"}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: BUILDINGS & UNITS */}
            {activePreviewTab === "buildings" && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-blue-500/40 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/20">
                        {isFrench ? "100% Occupé" : "100% Occupied"}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mt-3">Résidence La Paix</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Bonamoussadi, Douala</p>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isFrench ? "12 Logements" : "12 Units"}</span>
                      <span className="font-bold text-slate-900 dark:text-white">1,440,000 XAF/m</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-blue-500/40 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-500/20">
                        {isFrench ? "90% Occupé" : "90% Occupied"}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mt-3">Cité Universitaire</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Ngoa-Ekélé, Yaoundé</p>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isFrench ? "10 Logements" : "10 Units"}</span>
                      <span className="font-bold text-slate-900 dark:text-white">1,060,000 XAF/m</span>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-blue-500/40 hover:shadow-md transition">
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/20">
                        {isFrench ? "100% Occupé" : "100% Occupied"}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mt-3">Villa Horizon</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Bastos, Yaoundé</p>
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">{isFrench ? "4 Duplex" : "4 Duplexes"}</span>
                      <span className="font-bold text-slate-900 dark:text-white">1,400,000 XAF/m</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between">
                  <span>
                    💡{" "}
                    {isFrench
                      ? "Chaque bâtiment dispose de son propre registre des locataires et de notifications d'arrivée/départ automatiques."
                      : "Each building contains its dedicated tenant directory and automated community move-in/move-out alerts."}
                  </span>
                  <Link href="/register" className="font-bold underline ml-2 shrink-0 text-blue-700 dark:text-blue-300">
                    {isFrench ? "Créer un Immeuble" : "Add Property"}
                  </Link>
                </div>
              </div>
            )}

            {/* TAB 3: CERTIFIED RECEIPT PREVIEW */}
            {activePreviewTab === "receipt" && (
              <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl relative">
                {/* Certified Stamp */}
                <div className="absolute top-6 right-6 border-2 border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400 rounded-xl px-3 py-1 font-mono font-black text-xs uppercase tracking-wider rotate-6 bg-emerald-50 dark:bg-emerald-950/20">
                  ✓ {isFrench ? "CERTIFIÉ PAYÉ" : "VERIFIED PAID"}
                </div>

                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base">
                      {isFrench ? "Quittance Officielle de Loyer" : "Official Rent Receipt"}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Réf : #LL-2026-OCT-0941 • LeaseLink Engine</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Bailleur :" : "Landlord:"}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">Cabinet Immobilier K. & Associés</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Locataire :" : "Tenant:"}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">Jean-Pierre Kamga</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Logement & Immeuble :" : "Unit & Property:"}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">Apt 4B • Résidence La Paix</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">{isFrench ? "Période réclamée :" : "Rent Period:"}</span>
                    <span className="font-semibold text-slate-900 dark:text-white">01 Octobre 2026 - 31 Octobre 2026</span>
                  </div>
                  <div className="flex justify-between py-2 bg-slate-50 dark:bg-slate-950 px-3 rounded-lg mt-2 border border-slate-200/70 dark:border-slate-800/60">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">{isFrench ? "Montant Versé :" : "Amount Paid:"}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">120,000 XAF</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isFrench ? "Authentifié par QR Code & Empreinte RLS" : "Authenticated with QR Code & Digital Signature"}
                  </span>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer shadow-xs transition">
                      <Send className="w-3 h-3 text-white" />
                      <span>WhatsApp</span>
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1 cursor-pointer transition">
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: REPAIRS & MAINTENANCE DESK */}
            {activePreviewTab === "repairs" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold border border-rose-200 dark:border-rose-500/20">
                          {isFrench ? "Urgence Élevée" : "High Urgency"}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Apt 2B • Résidence La Paix</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1">
                        {isFrench ? "Fuite d'eau sous l'évier de la cuisine" : "Under-sink water leak in kitchen"}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        {isFrench
                          ? "Photo attachée • Note vocale du locataire (0:45s) • Assigné au Plombier Mbarga"
                          : "Photo attached • Tenant voice note (0:45s) • Assigned to Plumber Mbarga"}
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 text-xs font-bold self-start sm:self-center">
                    {isFrench ? "En cours de traitement" : "In Progress"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-[10px] font-bold border border-blue-200 dark:border-blue-500/20">
                          {isFrench ? "Électricité" : "Electrical"}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Studio 08 • Cité Universitaire</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm mt-1">
                        {isFrench ? "Disjoncteur différentiel qui saute" : "Circuit breaker trip on heavy load"}
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                        {isFrench ? "Intervention effectuée • Vérifié par le locataire" : "Technician resolved • Confirmed by tenant"}
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold self-start sm:self-center">
                    {isFrench ? "Résolu ✓" : "Resolved ✓"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Core Feature Pillars */}
      <section id="features" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isFrench ? "Fonctionnalités Clés" : "Core Capabilities"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isFrench
                ? "Conçu pour Éliminer Toutes les Frictions Locatives"
                : "Engineered to Eliminate Landlord Friction"}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
              {isFrench
                ? "De l'attribution des logements jusqu'au recouvrement et l'entretien, gérez tout depuis votre smartphone ou votre ordinateur."
                : "From unit occupancy to rent ledgers and emergency repair requests, handle your operations effortlessly."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Multi-building architecture */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 shadow-xs hover:border-blue-500/40 hover:shadow-md hover:-translate-y-1 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Architecture Multi-Immeubles" : "Multi-Building Hierarchy"}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Créez et supervisez vos immeubles, résidences et cités en toute autonomie. Définissez les loyers, chambres, balcons et suivez le taux d'occupation en temps réel."
                  : "Structure properties across distinct addresses and campuses. Configure individual units, monthly rates, and monitor real-time occupancy rates."}
              </p>
            </div>

            {/* 2. Official stamped receipts */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 shadow-xs hover:border-emerald-500/40 hover:shadow-md hover:-translate-y-1 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Quittances Certifiées avec Cachet" : "Stamped Digital Quittances"}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Enregistrez les paiements Mobile Money ou espèces. Générez automatiquement des quittances certifiées avec cachet officiel, QR code et partagez-les en 1 clic sur WhatsApp."
                  : "Record cash and Mobile Money collections with zero delay. Generate certified receipts with authentic landlord stamps, printable PDFs, and instant WhatsApp dispatch."}
              </p>
            </div>

            {/* 3. Community alerts */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 shadow-xs hover:border-sky-500/40 hover:shadow-md hover:-translate-y-1 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-5">
                <BellRing className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Notifications d'Arrivée & Départ" : "Arrival & Departure Alerts"}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Notification automatique ciblée : dès qu'un locataire emménage ou quitte un logement, les résidents de son immeuble sont automatiquement informés pour la sécurité de la communauté."
                  : "Targeted building alerts: automatically inform residents of a specific building when a new neighbor moves in or departs, preserving neighborhood cohesion."}
              </p>
            </div>

            {/* 4. Maintenance Desk */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 shadow-xs hover:border-rose-500/40 hover:shadow-md hover:-translate-y-1 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-5">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Guichet des Réparations & Travaux" : "Repairs & Maintenance Desk"}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Les locataires transmettent leurs tickets avec photos, vidéos et notes vocales. Suivez le statut de l'intervention et transmettez le rapport directement aux techniciens."
                  : "Tenants report issues with pictures, videos, and voice notes. Track repair progression and dispatch directly to your trusted plumbers and electricians."}
              </p>
            </div>

            {/* 5. Credential Vault */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 shadow-xs hover:border-amber-500/40 hover:shadow-md hover:-translate-y-1 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Coffre-fort des Accès Locataires" : "Tenant Credential Vault"}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Générez des mots de passe sécurisés et des liens d'accès direct. Transmettez les fiches d'accueil par WhatsApp en un seul clic sans configuration complexe."
                  : "Generate secure passwords and 1-click login tokens for each tenant. Send personalized access messages directly over WhatsApp with full encryption."}
              </p>
            </div>

            {/* 6. PWA Mobile-First */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-7 shadow-xs hover:border-indigo-500/40 hover:shadow-md hover:-translate-y-1 transition duration-300">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5">
                <Smartphone className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isFrench ? "Application Mobile PWA & Hors-Ligne" : "Offline-First Mobile PWA"}
              </h3>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Installez l'application en un tap sur iPhone ou Android. Continuez de consulter vos biens et fiches locataires même en cas de coupure de réseau."
                  : "Install in one tap on iOS and Android without app store downloads. Cache property records locally to access ledgers even when internet connectivity drops."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Pricing Calculator & Subscription Plans */}
      <section id="pricing" className="py-20 bg-white dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isFrench ? "Formules & Tarification" : "Pricing & Plans"}
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isFrench ? "Tarifs Clairs, sans Frais Cachés" : "Transparent Plans Tailored to Your Units"}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
              {isFrench
                ? "Choisissez entre une facturation mensuelle souple ou un abonnement annuel pour réaliser des économies substantielles."
                : "Choose between flexible monthly billing or an annual subscription for substantial savings."}
            </p>

            {/* Monthly / Annual Billing Toggle Switch */}
            <div className="mt-6 inline-flex items-center p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`py-2 px-5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {isFrench ? "Facturation Mensuelle" : "Monthly Billing"}
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`py-2 px-5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                  billingCycle === "annual"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>{isFrench ? "Facturation Annuelle" : "Annual Billing"}</span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs ${
                    billingCycle === "annual"
                      ? "bg-emerald-400 text-slate-950"
                      : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {isFrench ? "Économisez" : "Save"}
                </span>
              </button>
            </div>

            {/* Interactive Capacity Slider */}
            <div className="mt-8 p-5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl mx-auto text-left shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800 dark:text-slate-300">
                  {isFrench ? "Combien de logements gérez-vous ?" : "How many units do you manage?"}
                </span>
                <span className="text-blue-600 dark:text-blue-400 text-sm font-black">
                  {unitCountSlider > 300
                    ? isFrench ? "300+ Logements (Sur-mesure)" : "300+ Units (Custom Pack)"
                    : `${unitCountSlider} ${isFrench ? "Logements" : "Units"}`}
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="320"
                value={unitCountSlider}
                onChange={(e) => setUnitCountSlider(Number(e.target.value))}
                className="w-full mt-3 accent-blue-600 cursor-pointer"
              />

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>{isFrench ? "Formule recommandée :" : "Recommended tier:"}</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/20 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-500/30">
                  {unitCountSlider > 300
                    ? isFrench ? "Pack Grands Comptes (Sur-mesure)" : "Enterprise Pack (Custom Quote)"
                    : `${isFrench && suggestedPlan.nameFr ? suggestedPlan.nameFr : suggestedPlan.name} (${suggestedPlan.unitRange})`}
                </span>
              </div>
            </div>
          </div>

          {/* Default Free Registration & Safe Upgrade Notice */}
          <div className="max-w-3xl mx-auto mt-6 mb-8 p-3.5 sm:p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-500/30 text-xs text-slate-700 dark:text-slate-300 flex items-start sm:items-center gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="flex-1 text-left">
              <span className="font-bold text-slate-900 dark:text-white block">
                {isFrench ? "Inscription Directe & Formule Gratuite Immédiate" : "Direct Registration & Default Free Plan"}
              </span>
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {isFrench
                  ? "Tous les comptes démarrent automatiquement avec 30 jours d'essai gratuit (jusqu'à 5 logements). Augmentez votre formule à tout moment depuis votre espace bailleur pour ajouter plus de logements : toutes vos données (immeubles, logements, locataires et quittances) restent 100% conservées et intactes !"
                  : "All accounts begin with an automatic 30-day free trial (up to 5 units). Upgrade your plan at any time right from your landlord interface to manage more units: all your existing data (buildings, units, tenants, and receipts) remains 100% intact!"}
              </p>
            </div>
          </div>

          {/* Pricing Cards Grid */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 ${
              billingCycle === "annual" ? "lg:grid-cols-4 max-w-6xl mx-auto" : "lg:grid-cols-5"
            } gap-4 lg:gap-5`}
          >
            {displayedPlans.map((plan) => {
              const isSelected = suggestedPlan.id === plan.id;
              const priceDisplay =
                billingCycle === "annual" ? plan.annualPriceDisplay : plan.monthlyPriceDisplay;
              const savingsDisplay =
                billingCycle === "annual"
                  ? isFrench && plan.annualSavingsFr
                    ? plan.annualSavingsFr
                    : plan.annualSavings
                  : null;

              return (
                <div
                  key={plan.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 relative shadow-sm ${
                    isSelected
                      ? "border-2 border-blue-600 shadow-lg shadow-blue-500/10 scale-[1.02] z-10"
                      : plan.isFreeTrial
                      ? "border-2 border-amber-500/60"
                      : "border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-black text-[9px] uppercase tracking-wider shadow-md whitespace-nowrap">
                      {isFrench ? "Recommandé" : "Best Fit"}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {isFrench && plan.nameFr ? plan.nameFr : plan.name}
                      </h3>
                      {plan.badge && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 shrink-0">
                          {isFrench && plan.badgeFr ? plan.badgeFr : plan.badge}
                        </span>
                      )}
                    </div>

                    {/* Unit Capacity */}
                    <div className="mt-3">
                      <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                        {isFrench ? plan.unitRangeFr : plan.unitRange}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {priceDisplay}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        {plan.isFreeTrial
                          ? isFrench
                            ? "Essai 30 jours (Sans carte)"
                            : "30-day trial (No card)"
                          : billingCycle === "annual"
                          ? isFrench
                            ? "/ an (Facturation annuelle)"
                            : "/ year (Annual billing)"
                          : isFrench
                          ? "/ mois (Facturation mensuelle)"
                          : "/ month (Monthly billing)"}
                      </span>

                      {savingsDisplay && (
                        <div className="mt-1.5 inline-block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                          {savingsDisplay}
                        </div>
                      )}
                    </div>

                    {/* Target Audience */}
                    <div className="mt-4 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-bold text-slate-900 dark:text-slate-200 block mb-0.5">
                        {isFrench ? "Cible recommandée :" : "Target Audience:"}
                      </span>
                      <span>{isFrench ? plan.targetFr : plan.target}</span>
                    </div>

                    {/* Features list */}
                    <div className="mt-4 space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{isFrench ? "Quittances certifiées" : "Certified receipts"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{isFrench ? "Portail Locataire PWA" : "Tenant Web App"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{isFrench ? "Mémos vocaux & Tickets" : "Voice notes & Repairs"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-3">
                    <Link
                      href="/register"
                      className={`w-full block text-center py-2.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                        isSelected
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/25"
                          : plan.isFreeTrial
                          ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-2 border-amber-400 dark:border-amber-500/30"
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {plan.isFreeTrial
                        ? isFrench
                          ? "Démarrer l'Essai Gratuit"
                          : "Start Free Trial"
                        : isFrench
                        ? "Commencer (Essai Inclus)"
                        : "Get Started (Free Trial)"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Enterprise / Grands Comptes Banner (> 300 units) */}
          <div
            id="enterprise-tier"
            className={`mt-12 rounded-3xl p-8 sm:p-10 border transition-all duration-300 relative overflow-hidden ${
              unitCountSlider > 300
                ? "border-amber-400/80 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 shadow-2xl shadow-blue-500/20 ring-2 ring-amber-400/50"
                : "border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl"
            }`}
          >
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/10 border border-amber-400/30 text-amber-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isFrench ? "Sur-Mesure & Grands Comptes • 300+ Logements" : "Custom Enterprise • 300+ Units"}
                </div>
                
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isFrench
                    ? "Vous gérez un parc de plus de 300 logements ?"
                    : "Managing a portfolio of over 300 units?"}
                </h3>
                
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  {isFrench
                    ? "Sociétés immobilières, foncières institutionnelles et syndics professionnels : bénéficiez d'une infrastructure dédiée, de migrations de données clés en main et d'un contrat de niveau de service (SLA) sur-mesure."
                    : "Institutional asset managers, real estate agencies, and large property syndics: get dedicated infrastructure, white-glove data onboarding, and guaranteed custom SLAs."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-semibold text-slate-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isFrench ? "Account Manager dédié & support WhatsApp VIP" : "Dedicated Account Manager & VIP WhatsApp"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isFrench ? "Importation & migration gratuite de vos baux" : "Free data & lease migration onboarding"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isFrench ? "Exports comptables & intégrations sur-mesure" : "Custom accounting sync & API exports"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isFrench ? "Tarification dégressive par tranche de volume" : "Volume-tiered progressive volume pricing"}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col gap-3 w-full lg:w-auto shrink-0">
                <a
                  href={`https://wa.me/237675993378?text=${encodeURIComponent(
                    isFrench
                      ? "Bonjour LeaseLink, je gère un portefeuille de plus de 300 logements et je souhaite obtenir un devis Grands Comptes sur-mesure."
                      : "Hello LeaseLink, I manage a real estate portfolio of 300+ units and would like a custom Enterprise quote."
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition hover:scale-[1.02] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{isFrench ? "Discuter sur WhatsApp" : "Chat on WhatsApp"}</span>
                </a>
                
                <a
                  href={`mailto:nanakamdomraoulrusselalvares@gmail.com?subject=${encodeURIComponent(
                    isFrench
                      ? "Demande de Devis Grands Comptes (300+ logements) - LeaseLink"
                      : "Enterprise Custom Quote Request (300+ units) - LeaseLink"
                  )}&body=${encodeURIComponent(
                    isFrench
                      ? "Bonjour,\n\nJe gère un portefeuille immobilier de plus de 300 logements et je souhaite recevoir une proposition commerciale et un devis sur-mesure pour la solution LeaseLink.\n\nNom / Société :\nTéléphone :\nNombre approximatif de logements :\nVille / Pays :\n\nMerci d'avance pour votre retour."
                      : "Hello,\n\nI manage a real estate portfolio of over 300 units and would like to receive a tailored Enterprise proposal and custom quote for LeaseLink.\n\nName / Company:\nPhone number:\nApproximate number of units:\nCity / Country:\n\nThank you."
                  )}`}
                  className="px-6 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm flex items-center justify-center gap-2 transition hover:scale-[1.02] text-center cursor-pointer"
                >
                  <span>{isFrench ? "Demander un Devis par Email" : "Request Quote by Email"}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-20 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isFrench ? "Questions Fréquentes" : "Frequently Asked Questions"}
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {isFrench ? "Tout ce que Vous Devez Savoir" : "Everything You Need to Know"}
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-5 text-left font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 bg-gradient-to-b from-blue-50/40 via-white to-white dark:from-slate-950 dark:to-blue-950/30 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
            {isFrench
              ? "Prêt à Moderniser la Gestion de vos Biens ?"
              : "Ready to Supercharge Your Rental Operations?"}
          </h2>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
            {isFrench
              ? "Rejoignez les bailleurs qui ont éliminé les litiges de paiement et les quittances papier."
              : "Join forward-thinking landlords who have automated rent collection and eliminated paper disputes."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{isFrench ? "Créer un Compte Gratuitement" : "Create Free Account Now"}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-200 border-2 border-slate-300 hover:border-slate-400 dark:border-slate-700 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{isFrench ? "Connexion Bailleur" : "Landlord Sign In"}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-10 bg-white dark:bg-slate-950 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  Lease<span className="text-blue-600 dark:text-blue-500">Link</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  &copy; 2026 LeaseLink Inc. {isFrench ? "Tous droits réservés." : "All rights reserved."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 dark:text-slate-400">
              <Link href="/tenant/login" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition font-medium">
                {isFrench ? "Espace Locataire" : "Tenant Portal"}
              </Link>
              <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition font-medium">
                {isFrench ? "Connexion Bailleur" : "Landlord Login"}
              </Link>
              <Link href="/register" className="hover:text-slate-900 dark:hover:text-white transition font-medium">
                {isFrench ? "Créer un Compte" : "Register"}
              </Link>
              <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition font-medium">
                {isFrench ? "Fonctionnalités" : "Features"}
              </a>
              <a href="#pricing" className="hover:text-slate-900 dark:hover:text-white transition font-medium">
                {isFrench ? "Tarifs" : "Pricing"}
              </a>
              <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 transition font-medium">
                {isFrench ? "Conditions & Confidentialité" : "Terms & Privacy"}
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="pill" />
              <ThemeSwitcher variant="pill" />
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Back to Top Button - Appears only when scrolling on public home page */}
      <button
        type="button"
        id="back-to-top-btn"
        onClick={scrollToTop}
        aria-label={isFrench ? "Retour en haut de page" : "Back to top"}
        className={`fixed bottom-6 right-6 z-40 p-3 sm:p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/30 dark:shadow-blue-500/20 border border-white/20 active:scale-95 transition-all duration-300 flex items-center justify-center group cursor-pointer ${
          showScrollTop
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-6 pointer-events-none"
        }`}
      >
        <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-200" />
      </button>
    </div>
  );
}
