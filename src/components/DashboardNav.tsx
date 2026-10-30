"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import NotificationBell from "@/components/NotificationBell";
import AttachPhoneModal, { isMissingPhone } from "@/components/AttachPhoneModal";
import SubscriptionExpirationBanner from "@/components/SubscriptionExpirationBanner";
import SubscriptionLockBarrier from "@/components/SubscriptionLockBarrier";
import SubscriptionPaymentModal from "@/components/SubscriptionPaymentModal";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { LandlordProfile, AVAILABLE_PLANS, resolvePlanConfig } from "@/types/database";
import {
  Building2,
  LayoutDashboard,
  KeyRound,
  Receipt,
  Wrench,
  LogOut,
  Sparkles,
  Loader2,
  X,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  User,
  Plus,
  AlertTriangle,
  Users,
  ShieldAlert,
  Globe,
  Sun,
  Moon,
  Smartphone,
  Phone,
  Download,
} from "lucide-react";

interface DashboardNavProps {
  user?: SupabaseUser | null;
  profile?: LandlordProfile | null;
  pendingRepairsCount?: number;
  buildingsCount?: number;
}

export default function DashboardNav({
  user: initialUser,
  profile: initialProfile,
  pendingRepairsCount = 0,
  buildingsCount = 0,
}: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, isFrench } = useLanguage();
  const { theme, setTheme, isDark } = useTheme();

  const [user, setUser] = useState<SupabaseUser | null>(initialUser || null);
  const [profile, setProfile] = useState<LandlordProfile | null>(initialProfile || null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Check if running in installed PWA standalone window
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isStandaloneMQ = window.matchMedia("(display-mode: standalone)").matches;
      const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      const isPwaUrl = window.location.search.includes("source=pwa");
      setIsStandalone(isStandaloneMQ || isIosStandalone || isPwaUrl);
    }
  }, []);

  // Sync profile when initialProfile prop changes
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  // Check URL parameters (e.g., need_phone=true from Google signup) & event listeners
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("need_phone") === "true") {
        setShowPhoneModal(true);
      }
    }

    const handleOpenModal = () => setShowPhoneModal(true);
    const handleOpenSubModal = () => setShowSubscriptionModal(true);
    const handlePhoneUpdated = (e: any) => {
      const newPhone = e.detail?.phone;
      if (newPhone) {
        setProfile((prev) => (prev ? { ...prev, phone: newPhone } : prev));
      }
    };

    window.addEventListener("leaselink:open_phone_modal", handleOpenModal);
    window.addEventListener("leaselink:open_subscription_modal", handleOpenSubModal);
    window.addEventListener("leaselink:phone_updated", handlePhoneUpdated);

    return () => {
      window.removeEventListener("leaselink:open_phone_modal", handleOpenModal);
      window.removeEventListener("leaselink:open_subscription_modal", handleOpenSubModal);
      window.removeEventListener("leaselink:phone_updated", handlePhoneUpdated);
    };
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(e.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };

    if (profileDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [profileDropdownOpen]);

  // If user wasn't passed as prop, load from Supabase client
  useEffect(() => {
    if (!initialUser) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: sData }) => {
        const currentUser = sData?.session?.user;
        if (currentUser) {
          setUser(currentUser);
          supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle()
            .then(({ data: pData }) => {
              if (pData) setProfile(pData as LandlordProfile);
            });
          return;
        }

        // Fallback to remote getUser only if session wasn't cached locally
        supabase.auth.getUser().then(({ data, error }) => {
          if (error) {
            if (error.status === 403 || error.status === 401 || error.message?.includes("Forbidden")) {
              supabase.auth.signOut({ scope: "local" }).catch(() => {});
              if (typeof window !== "undefined") {
                Object.keys(localStorage).forEach((key) => {
                  if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
                    localStorage.removeItem(key);
                  }
                });
              }
            }
            return;
          }
          if (data?.user) {
            setUser(data.user);
            supabase
              .from("profiles")
              .select("*")
              .eq("id", data.user.id)
              .maybeSingle()
              .then(({ data: pData }) => {
                if (pData) setProfile(pData as LandlordProfile);
              });
          }
        });
      });
    }
  }, [initialUser]);

  // Lock body scroll and handle escape key for logout modal
  useEffect(() => {
    if (showLogoutModal) {
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !loggingOut) setShowLogoutModal(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showLogoutModal, loggingOut]);

  // Handle Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login?loggedOut=true");
      router.refresh();
    } catch (err) {
      console.error("Error signing out:", err);
      router.push("/login?loggedOut=true");
    } finally {
      setLoggingOut(false);
    }
  };

  const isAdmin = profile?.role === "admin";
  const isManager = profile?.role === "manager";

  // Desktop navigation items depending on role
  const navItems = isAdmin
    ? [
        {
          href: "/dashboard/admin",
          label: isFrench ? "Administration" : "Admin Hub",
          icon: ShieldAlert,
          active: pathname.startsWith("/dashboard/admin"),
          badge: "Super",
        },
        {
          href: "/dashboard",
          label: isFrench ? "Vue d'ensemble" : "Overview",
          icon: LayoutDashboard,
          active: pathname === "/dashboard",
          badge: null,
        },
        {
          href: "/dashboard/buildings",
          label: isFrench ? "Immeubles & Logements" : "Buildings & Units",
          icon: Building2,
          active: pathname.startsWith("/dashboard/buildings"),
          badge: buildingsCount > 0 ? `${buildingsCount}` : null,
        },
        {
          href: "/dashboard/credentials",
          label: isFrench ? "Identifiants Locataires" : "Tenant Credentials",
          icon: KeyRound,
          active: pathname.startsWith("/dashboard/credentials"),
          badge: null,
        },
        {
          href: "/dashboard/payments",
          label: isFrench ? "Loyers & Quittances" : "Payments & Ledgers",
          icon: Receipt,
          active: pathname.startsWith("/dashboard/payments"),
          badge: null,
        },
        {
          href: "/dashboard/managers",
          label: isFrench ? "Gestionnaires" : "Managers",
          icon: Users,
          active: pathname.startsWith("/dashboard/managers"),
          badge: null,
        },
        {
          href: "/dashboard/maintenance",
          label: isFrench ? "Réparations" : "Repairs",
          icon: Wrench,
          active: pathname.startsWith("/dashboard/maintenance"),
          badge: pendingRepairsCount > 0 ? `${pendingRepairsCount}` : null,
          badgePulse: pendingRepairsCount > 0,
        },
      ]
    : isManager
    ? [
        {
          href: "/dashboard",
          label: isFrench ? "Vue d'ensemble" : "Overview",
          icon: LayoutDashboard,
          active: pathname === "/dashboard",
          badge: null,
        },
        {
          href: "/dashboard/buildings",
          label: isFrench ? "Immeubles & Logements" : "Buildings & Units",
          icon: Building2,
          active: pathname.startsWith("/dashboard/buildings"),
          badge: buildingsCount > 0 ? `${buildingsCount}` : null,
        },
        {
          href: "/dashboard/credentials",
          label: isFrench ? "Identifiants Locataires" : "Tenant Credentials",
          icon: KeyRound,
          active: pathname.startsWith("/dashboard/credentials"),
          badge: null,
        },
        {
          href: "/dashboard/unpaid-rents",
          label: isFrench ? "Loyers Impayés" : "Unpaid Rents",
          icon: AlertTriangle,
          active: pathname.startsWith("/dashboard/unpaid-rents"),
          badge: null,
        },
        {
          href: "/dashboard/maintenance",
          label: isFrench ? "Réparations" : "Repairs",
          icon: Wrench,
          active: pathname.startsWith("/dashboard/maintenance"),
          badge: pendingRepairsCount > 0 ? `${pendingRepairsCount}` : null,
          badgePulse: pendingRepairsCount > 0,
        },
      ]
    : [
        {
          href: "/dashboard",
          label: isFrench ? "Vue d'ensemble" : "Overview",
          icon: LayoutDashboard,
          active: pathname === "/dashboard",
          badge: null,
        },
        {
          href: "/dashboard/buildings",
          label: isFrench ? "Immeubles & Logements" : "Buildings & Units",
          icon: Building2,
          active: pathname.startsWith("/dashboard/buildings"),
          badge: buildingsCount > 0 ? `${buildingsCount}` : null,
        },
        {
          href: "/dashboard/credentials",
          label: isFrench ? "Identifiants Locataires" : "Tenant Credentials",
          icon: KeyRound,
          active: pathname.startsWith("/dashboard/credentials"),
          badge: null,
        },
        {
          href: "/dashboard/payments",
          label: isFrench ? "Loyers & Quittances" : "Payments & Ledgers",
          icon: Receipt,
          active: pathname.startsWith("/dashboard/payments"),
          badge: null,
        },
        {
          href: "/dashboard/managers",
          label: isFrench ? "Gestionnaires" : "Managers",
          icon: Users,
          active: pathname.startsWith("/dashboard/managers"),
          badge: null,
        },
        {
          href: "/dashboard/maintenance",
          label: isFrench ? "Réparations" : "Repairs",
          icon: Wrench,
          active: pathname.startsWith("/dashboard/maintenance"),
          badge: pendingRepairsCount > 0 ? `${pendingRepairsCount}` : null,
          badgePulse: pendingRepairsCount > 0,
        },
      ];

  // Mobile Bottom Navigation
  const mobileBottomItems = isAdmin
    ? [
        navItems[0], // Admin Hub
        navItems[1], // Overview
        navItems[2], // Buildings
        navItems[4], // Payments
        navItems[6], // Repairs
      ]
    : isManager
    ? navItems
    : [
        navItems[0], // Overview
        navItems[1], // Buildings
        navItems[2], // Credentials
        navItems[3], // Payments
        navItems[5], // Repairs
      ];

  const userDisplayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split("@")[0] ||
    (isAdmin ? "Super Administrateur" : isManager ? (isFrench ? "Gestionnaire" : "Manager") : (isFrench ? "Bailleur" : "Landlord"));

  const planConfig = resolvePlanConfig(profile?.plan);
  const planLabel = isAdmin
    ? isFrench ? "Super Administrateur" : "Platform Admin"
    : isManager
    ? isFrench ? "Gestionnaire Délégué" : "Property Manager"
    : isFrench && planConfig.nameFr ? planConfig.nameFr : profile?.plan_name || planConfig.name;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP DESKTOP & TABLET HEADER BAR (Sticky Glassmorphic)                  */}
      {/* ========================================================================= */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-[var(--pwa-banner-height,0px)] z-40 transition-[top,background-color] duration-150 shadow-sm w-full max-w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Left: Brand Identity & Plan Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <Image
                src="/brand/leaselink-symbol.png"
                alt="LeaseLink"
                width={36}
                height={36}
                className="w-9 h-9 object-contain group-hover:scale-105 transition-transform"
                priority
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight leading-none">
                  Lease<span className="text-emerald-500 dark:text-emerald-400">Link</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase mt-0.5">
                  {isFrench ? "Gestion Immobilière" : "Property Cloud"}
                </span>
              </div>
            </Link>

            {isAdmin ? (
              <span className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 shadow-xs">
                <ShieldAlert className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>{planLabel}</span>
              </span>
            ) : isManager ? (
              <span className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                <ShieldCheck className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{planLabel}</span>
              </span>
            ) : (
              <span className="hidden 2xl:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                <span>{planLabel}</span>
              </span>
            )}
          </div>

          {/* Center: Desktop Segmented Navigation Tabs */}
          <nav
            className="hidden xl:flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-inner"
            role="navigation"
            aria-label="Dashboard primary navigation"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    item.active
                      ? "bg-blue-600 text-white shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/70"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      item.active ? "text-white" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                    }`}
                  />
                  <span>{item.label}</span>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        item.badgePulse
                          ? "bg-amber-400 text-amber-950 animate-pulse font-black"
                          : item.active
                          ? "bg-blue-500/40 text-white border border-blue-400/30"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: User Profile Menu (With Language & Theme Switchers) & Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Install App Button (When not running in installed standalone window) */}
            {!isStandalone && (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("leaselink:trigger_install"));
                  }
                }}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
                title={isFrench ? "Installer l'application LeaseLink" : "Install LeaseLink App"}
              >
                <Download className="w-3.5 h-3.5 animate-bounce" />
                <span className="hidden xl:inline">{isFrench ? "Installer l'App" : "Install App"}</span>
              </button>
            )}

            {/* User Profile Pill with Interactive Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-xs"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                aria-label="User account menu"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shadow-sm shrink-0">
                  {userDisplayName.substring(0, 2).toUpperCase()}
                </div>
                <span className="font-semibold max-w-[120px] truncate hidden sm:inline">
                  {userDisplayName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                    profileDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-4">
                  {/* User Info Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0">
                      {userDisplayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {userDisplayName}
                        </h4>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
                          {isAdmin ? "Admin" : isManager ? (isFrench ? "Gestionnaire" : "Manager") : (isFrench ? "Bailleur" : "Landlord")}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                        {user?.email || "user@leaselink.com"}
                      </p>

                      {profile?.role === "landlord" && isMissingPhone(profile?.phone) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            setShowPhoneModal(true);
                          }}
                          className="mt-2 w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{isFrench ? "Numéro WhatsApp" : "WhatsApp Number"}</span>
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-white">
                            {isFrench ? "Requis" : "Required"}
                          </span>
                        </button>
                      ) : profile?.phone ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-1 font-mono">
                          <Smartphone className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span>{profile.phone}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Language Switcher Section */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>{isFrench ? "Langue" : "Language"}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setLanguage("fr")}
                        className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          language === "fr"
                            ? "bg-blue-600 text-white shadow-sm font-black"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>🇫🇷</span>
                        <span>Français</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLanguage("en")}
                        className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          language === "en"
                            ? "bg-blue-600 text-white shadow-sm font-black"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span>🇬🇧</span>
                        <span>English</span>
                      </button>
                    </div>
                  </div>

                  {/* Theme Switcher Section */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      {isDark ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                      <span>{isFrench ? "Thème d'affichage" : "Appearance Theme"}</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          theme === "light"
                            ? "bg-white text-amber-700 shadow-sm border border-slate-200/80 font-black"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isFrench ? "Clair" : "Light"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={`flex items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          theme === "dark"
                            ? "bg-slate-800 text-blue-400 shadow-sm border border-slate-700 font-black"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5 text-blue-400" />
                        <span>{isFrench ? "Sombre" : "Dark"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Install App Option in Dropdown */}
                  {!isStandalone && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(new CustomEvent("leaselink:trigger_install"));
                          }
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Download className="w-3.5 h-3.5 animate-bounce" />
                          <span>{isFrench ? "Installer l'Application" : "Install App"}</span>
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          PWA
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Divider & Actions */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setShowLogoutModal(true);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{isFrench ? "Se Déconnecter" : "Sign Out"}</span>
                      </span>
                      <ChevronRight className="w-3 h-3 text-rose-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Logout Button (Desktop) */}
            <button
              onClick={() => setShowLogoutModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-semibold transition cursor-pointer"
              title={isFrench ? "Se déconnecter" : "Sign out"}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden 2xl:inline">
                {isFrench ? "Déconnexion" : "Sign Out"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Subscription Expiration Alert Banner (7 Days, 4 Days, 3 Days countdown) */}
      <SubscriptionExpirationBanner
        profile={profile}
        onRenewClick={() => setShowSubscriptionModal(true)}
      />

      {/* Missing Phone Number Alert Banner for Landlords */}
      {profile?.role === "landlord" && isMissingPhone(profile?.phone) && (
        <aside
          role="alert"
          aria-label="Configuration du numéro de téléphone requise"
          className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 dark:from-amber-500/20 dark:via-orange-500/20 dark:to-amber-500/20 border-b border-amber-300 dark:border-amber-500/30 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 transition-all sticky top-[calc(var(--pwa-banner-height,0px)+4rem)] z-30 backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                <Smartphone className="w-4 h-4 animate-bounce" />
              </span>
              <span>
                <strong className="font-bold">
                  {isFrench ? "Numéro de téléphone requis :" : "Telephone number required:"}
                </strong>{" "}
                {isFrench
                  ? "Vous devez associer votre numéro de téléphone / WhatsApp pour émettre les quittances certifiées et recevoir les alertes locataires."
                  : "You must attach your telephone / WhatsApp number to emit certified receipts and receive tenant alerts."}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPhoneModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs shrink-0 shadow-sm transition cursor-pointer"
            >
              <span>{isFrench ? "Associer mon numéro" : "Attach my phone"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* ========================================================================= */}
      {/* 2. MOBILE FIXED BOTTOM NAVIGATION BAR (iOS / Native PWA style)           */}
      {/* ========================================================================= */}
      <nav
        className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/90 shadow-2xl safe-area-bottom"
        role="navigation"
        aria-label="Mobile bottom navigation"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1 items-center">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                  item.active
                    ? "text-blue-600 dark:text-blue-500 font-bold"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${item.active ? "text-blue-600 dark:text-blue-500" : "text-slate-500 dark:text-slate-400"}`} />
                  {item.badge && (
                    <span
                      className={`absolute -top-1 -right-2 text-[9px] font-black px-1 rounded-full ${
                        item.badgePulse
                          ? "bg-amber-400 text-amber-950 animate-pulse"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] mt-1 truncate max-w-[64px] tracking-tight font-medium">
                  {item.label}
                </span>
                {item.active && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-500" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. LOGOUT CONFIRMATION MODAL                                              */}
      {/* ========================================================================= */}
      {showLogoutModal && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-sm select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loggingOut) {
              setShowLogoutModal(false);
            }
          }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
            {/* Modal Card */}
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain select-text">
            {/* Modal Icon & Header */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isFrench ? "Confirmer la déconnexion" : "Confirm Sign Out"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isFrench
                    ? "Êtes-vous sûr de vouloir vous déconnecter de votre compte LeaseLink ?"
                    : "Are you sure you want to sign out of your LeaseLink account?"}
                </p>
              </div>
            </div>

            {/* User Session Info Pill */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  {userDisplayName.substring(0, 2).toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {userDisplayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shrink-0">
                {isAdmin ? "Admin" : isManager ? (isFrench ? "Gestionnaire" : "Manager") : (isFrench ? "Bailleur" : "Landlord")}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {isFrench ? "Annuler" : "Cancel"}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isFrench ? "Déconnexion..." : "Signing Out..."}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-4 h-4" />
                    <span>{isFrench ? "Oui, se déconnecter" : "Yes, Sign Out"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 4. FLOATING NOTIFICATION BUTTON (Fixed at Bottom-Right of Screen) */}
      <NotificationBell
        variant="floating"
        role={profile?.role || "landlord"}
        userId={user?.id}
        landlordId={profile?.role === "manager" ? profile?.landlord_id : user?.id}
        assignedBuildingIds={profile?.assigned_building_ids}
      />

      {/* 5. ATTACH PHONE NUMBER MODAL */}
      <AttachPhoneModal
        isOpen={showPhoneModal}
        profile={profile}
        user={user}
        canDismiss={true}
        onPhoneSaved={(newPhone) => {
          setProfile((prev) => (prev ? { ...prev, phone: newPhone } : prev));
          setShowPhoneModal(false);
        }}
        onClose={() => setShowPhoneModal(false)}
      />

      {/* 6. SUBSCRIPTION LOCK BARRIER (Account Expired Hard Blocking) */}
      <SubscriptionLockBarrier
        profile={profile}
        onRenewClick={() => setShowSubscriptionModal(true)}
      />

      {/* 7. SUBSCRIPTION PAYMENT & UPGRADE MODAL */}
      {showSubscriptionModal && (
        <SubscriptionPaymentModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          profile={profile}
          onSubscriptionUpdated={(rec) => {
            setProfile((prev) =>
              prev
                ? {
                    ...prev,
                    plan: rec.plan_id,
                    plan_name: rec.plan_name,
                    plan_unit_limit: rec.plan_unit_limit || rec.unit_limit || 30,
                    unit_limit: rec.plan_unit_limit || rec.unit_limit || 30,
                    plan_expires_at: rec.expires_at,
                    plan_status: "active",
                    subscription_status: "active",
                  }
                : prev
            );
            setShowSubscriptionModal(false);
          }}
        />
      )}
    </>
  );
}
