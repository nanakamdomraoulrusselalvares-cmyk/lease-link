"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import NotificationBell from "@/components/NotificationBell";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { LandlordProfile, AVAILABLE_PLANS } from "@/types/database";
import {
  Building2,
  LayoutDashboard,
  KeyRound,
  Receipt,
  Wrench,
  LogOut,
  Sparkles,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  User,
  Plus,
  ExternalLink,
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
  const { isFrench } = useLanguage();

  const [user, setUser] = useState<SupabaseUser | null>(initialUser || null);
  const [profile, setProfile] = useState<LandlordProfile | null>(initialProfile || null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // If user wasn't passed as prop, load from Supabase client
  useEffect(() => {
    if (!initialUser) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
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
    }
  }, [initialUser]);

  // Handle Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Error signing out:", err);
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
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
      href: "/dashboard/maintenance",
      label: isFrench ? "Réparations" : "Repairs",
      icon: Wrench,
      active: pathname.startsWith("/dashboard/maintenance"),
      badge: pendingRepairsCount > 0 ? `${pendingRepairsCount}` : null,
      badgePulse: pendingRepairsCount > 0,
    },
  ];

  const userDisplayName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    user?.email?.split("@")[0] ||
    (isFrench ? "Bailleur" : "Landlord");

  const planConfig = AVAILABLE_PLANS.find((p) => p.id === profile?.plan) || AVAILABLE_PLANS[0];
  const planLabel = isFrench && planConfig.nameFr ? planConfig.nameFr : profile?.plan_name || planConfig.name;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. TOP DESKTOP & TABLET HEADER BAR (Sticky Glassmorphic)                  */}
      {/* ========================================================================= */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Identity & Plan Badge */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-600/20 text-white group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-white tracking-tight leading-none">
                  Lease<span className="text-blue-500">Link</span>
                </span>
                <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
                  {isFrench ? "Gestion Immobilière" : "Property Cloud"}
                </span>
              </div>
            </Link>

            <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>{planLabel}</span>
            </span>
          </div>

          {/* Center: Desktop Segmented Navigation Tabs */}
          <nav
            className="hidden lg:flex items-center gap-1 bg-slate-950/60 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 shadow-inner"
            role="navigation"
            aria-label="Dashboard primary navigation"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    item.active
                      ? "bg-blue-600 text-white shadow-sm font-bold"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      item.active ? "text-white" : "text-slate-400 group-hover:text-white"
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
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right: Controls, Switchers, User Pill, Logout */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <LanguageSwitcher variant="pill" />
            <ThemeSwitcher variant="pill" />
            <NotificationBell role="landlord" landlordId={user?.id} />

            {/* User Profile Pill (Desktop) */}
            <div className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-[11px] shadow-sm">
                {userDisplayName.substring(0, 2).toUpperCase()}
              </div>
              <span className="text-slate-200 font-semibold max-w-[130px] truncate">
                {userDisplayName}
              </span>
            </div>

            {/* Logout Button (Desktop) */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              title={isFrench ? "Se déconnecter" : "Sign out"}
            >
              <LogOut className={`w-3.5 h-3.5 ${loggingOut ? "animate-spin" : ""}`} />
              <span className="hidden xl:inline">
                {loggingOut
                  ? isFrench
                    ? "Déconnexion..."
                    : "Signing Out..."
                  : isFrench
                  ? "Déconnexion"
                  : "Sign Out"}
              </span>
            </button>

            {/* Mobile Menu Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MOBILE FIXED BOTTOM NAVIGATION BAR (iOS / Native PWA style)           */}
      {/* ========================================================================= */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 shadow-2xl safe-area-bottom"
        role="navigation"
        aria-label="Mobile bottom navigation"
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center h-full relative transition-colors ${
                  item.active
                    ? "text-blue-500 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${item.active ? "text-blue-500" : "text-slate-400"}`} />
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
                <span className="text-[10px] mt-1 truncate max-w-[64px] tracking-tight">
                  {item.label}
                </span>
                {item.active && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. MOBILE SLIDE-OVER DRAWER (For full profile, actions & utilities)        */}
      {/* ========================================================================= */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content panel */}
          <div className="relative ml-auto w-full max-w-xs bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-base text-white">LeaseLink</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile Card in Drawer */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{userDisplayName}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {planLabel}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
              </div>

              {/* Navigation List */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 block mb-2">
                  {isFrench ? "Navigation Principale" : "Main Navigation"}
                </span>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                        item.active
                          ? "bg-blue-600 text-white font-bold"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.badgePulse
                              ? "bg-amber-400 text-amber-950 font-black"
                              : "bg-slate-800 text-slate-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Public Site Link */}
              <div className="pt-2">
                <Link
                  href="/"
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isFrench ? "Voir Site Public" : "View Public Site"}</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Drawer Bottom Controls */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <LanguageSwitcher variant="pill" />
                <ThemeSwitcher variant="pill" />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{loggingOut ? (isFrench ? "Déconnexion..." : "Signing Out...") : (isFrench ? "Se Déconnecter" : "Sign Out")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
