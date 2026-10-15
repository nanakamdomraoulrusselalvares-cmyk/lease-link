"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TenantPortalData } from "@/types/database";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTheme } from "@/lib/theme/ThemeContext";
import NotificationBell from "@/components/NotificationBell";
import {
  Building2,
  LayoutDashboard,
  Receipt,
  Wrench,
  Home,
  User,
  LogOut,
  ChevronDown,
  ChevronRight,
  Globe,
  Sun,
  Moon,
  DollarSign,
  CheckCircle2,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface TenantNavProps {
  data: TenantPortalData;
  paymentsCount?: number;
  pendingRepairsCount?: number;
  tokenFromUrl?: string | null;
  onLogout: () => void;
  onPayRentClick?: () => void;
  onRequestRepairClick?: () => void;
}

export default function TenantNav({
  data,
  paymentsCount = 0,
  pendingRepairsCount = 0,
  tokenFromUrl,
  onLogout,
  onPayRentClick,
  onRequestRepairClick,
}: TenantNavProps) {
  const pathname = usePathname();
  const { language, setLanguage, isFrench } = useLanguage();
  const { theme, setTheme, isDark } = useTheme();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
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

  const handleConfirmLogout = () => {
    setLoggingOut(true);
    onLogout();
  };

  const portalBase = tokenFromUrl ? `/tenant/portal?token=${tokenFromUrl}` : `/tenant/portal`;
  const receiptsUrl = tokenFromUrl ? `/tenant/receipts?token=${tokenFromUrl}` : `/tenant/receipts`;

  // Desktop navigation items (matching Landlord Dashboard segmented tabs)
  const navItems = [
    {
      href: `${portalBase}#overview`,
      label: isFrench ? "Vue d'ensemble" : "Overview",
      icon: LayoutDashboard,
      active: pathname === "/tenant/portal" && !pathname.includes("receipts"),
      badge: null,
    },
    {
      href: receiptsUrl,
      label: isFrench ? "Loyers & Quittances" : "Rent & Receipts",
      icon: Receipt,
      active: pathname.includes("receipts"),
      badge: paymentsCount > 0 ? `${paymentsCount}` : null,
    },
    {
      href: `${portalBase}#specs`,
      label: isFrench ? "Logement & Pièces" : "Unit Specs",
      icon: Home,
      active: false,
      badge: null,
    },
    {
      href: `${portalBase}#maintenance`,
      label: isFrench ? "Réparations" : "Repairs",
      icon: Wrench,
      active: false,
      badge: pendingRepairsCount > 0 ? `${pendingRepairsCount}` : null,
      badgePulse: pendingRepairsCount > 0,
    },
    {
      href: `${portalBase}#landlord`,
      label: isFrench ? "Contact Bailleur" : "Landlord",
      icon: User,
      active: false,
      badge: null,
    },
  ];

  // Mobile Bottom Bar Items (5 equal columns)
  const mobileBottomItems = [
    {
      href: `${portalBase}#overview`,
      label: isFrench ? "Accueil" : "Home",
      icon: LayoutDashboard,
      active: pathname === "/tenant/portal" && !pathname.includes("receipts"),
    },
    {
      href: `${portalBase}#rent`,
      label: isFrench ? "Payer" : "Pay Rent",
      icon: DollarSign,
      active: false,
      onClick: onPayRentClick,
    },
    {
      href: receiptsUrl,
      label: isFrench ? "Quittances" : "Receipts",
      icon: Receipt,
      active: pathname.includes("receipts"),
      badge: paymentsCount > 0 ? `${paymentsCount}` : null,
    },
    {
      href: `${portalBase}#maintenance`,
      label: isFrench ? "Pannes" : "Repairs",
      icon: Wrench,
      active: false,
      badge: pendingRepairsCount > 0 ? `${pendingRepairsCount}` : null,
      badgePulse: pendingRepairsCount > 0,
      onClick: onRequestRepairClick,
    },
    {
      href: `${portalBase}#landlord`,
      label: isFrench ? "Bailleur" : "Landlord",
      icon: User,
      active: false,
    },
  ];

  const tenantInitials = (data.tenant_name || "T")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP DESKTOP & TABLET HEADER BAR (Sticky Glassmorphic)                  */}
      {/* ========================================================================= */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors shadow-sm w-full max-w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Left: Brand Identity & Unit Pill Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href={portalBase} className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-600/20 text-white group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight leading-none">
                  Lease<span className="text-blue-600 dark:text-blue-500">Link</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase mt-0.5">
                  {isFrench ? "Espace Locataire" : "Tenant Portal"}
                </span>
              </div>
            </Link>

            <span className="hidden 2xl:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {data.building_name} • {isFrench ? "Logement" : "Unit"} {data.unit_number}
              </span>
            </span>
          </div>

          {/* Center: Desktop Segmented Navigation Tabs (Landlord Dashboard Style) */}
          <nav
            className="hidden xl:flex items-center gap-1 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-inner"
            role="navigation"
            aria-label="Tenant navigation"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    item.active
                      ? "bg-blue-600 text-white shadow-sm font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800/70"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      item.active
                        ? "text-white"
                        : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
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

          {/* Right: Tenant Profile Menu (With Language & Theme Switchers) & Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Profile Pill with Interactive Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-800 dark:text-slate-200 transition cursor-pointer shadow-xs"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                aria-label="Tenant account menu"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-[11px] shadow-sm shrink-0">
                  {tenantInitials}
                </div>
                <span className="font-semibold max-w-[120px] truncate hidden sm:inline">
                  {data.tenant_name}
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
                      {tenantInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {data.tenant_name}
                        </h4>
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200/80 dark:border-blue-500/20">
                          {isFrench ? "Locataire" : "Tenant"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {data.building_name} • {data.unit_number}
                      </p>
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

      {/* ========================================================================= */}
      {/* 2. MOBILE FIXED BOTTOM NAVIGATION BAR (iOS / Native PWA style)           */}
      {/* ========================================================================= */}
      <nav
        className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800/90 shadow-2xl safe-area-bottom"
        role="navigation"
        aria-label="Tenant mobile navigation"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1 items-center">
          {mobileBottomItems.map((item) => {
            const Icon = item.icon;
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex flex-col items-center justify-center h-full relative transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                >
                  <div className="relative">
                    <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
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
                </button>
              );
            }

            return (
              <Link
                key={item.label}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
            onClick={() => !loggingOut && setShowLogoutModal(false)}
          />

          {/* Modal Card */}
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 z-10 animate-in zoom-in-95 duration-150">
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
                    ? "Êtes-vous sûr de vouloir quitter votre espace sécurisé locataire ?"
                    : "Are you sure you want to sign out of your tenant portal?"}
                </p>
              </div>
            </div>

            {/* Tenant Session Info Pill */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  {tenantInitials}
                </div>
                <div className="truncate">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {data.tenant_name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                    {data.building_name} • {data.unit_number}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shrink-0">
                {isFrench ? "Locataire" : "Tenant"}
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
                onClick={handleConfirmLogout}
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
      )}

      {/* ========================================================================= */}
      {/* 4. FLOATING NOTIFICATION BUTTON (Fixed at Bottom-Right of Screen)          */}
      {/* ========================================================================= */}
      <NotificationBell
        variant="floating"
        role="tenant"
        buildingId={data.building_id}
        unitId={data.unit_id}
        tenantName={data.tenant_name}
      />
    </>
  );
}
