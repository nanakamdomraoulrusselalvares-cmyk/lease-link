"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  WifiOff,
  RefreshCw,
  Building2,
  Home,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Layers,
  MapPin,
  Laptop,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Building } from "@/types/database";

export default function OfflinePage() {
  const { isFrench, language, setLanguage } = useLanguage();
  const [isChecking, setIsChecking] = useState(false);
  const [isOnlineNow, setIsOnlineNow] = useState(false);
  const [cachedBuildings, setCachedBuildings] = useState<Building[]>([]);
  const [totalUnits, setTotalUnits] = useState(0);

  // Load cached ledger snapshot from localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // 1. Try leaselink_cached_dashboard
        const cachedDash = localStorage.getItem("leaselink_cached_dashboard");
        if (cachedDash) {
          const parsed = JSON.parse(cachedDash);
          if (Array.isArray(parsed.buildings) && parsed.buildings.length > 0) {
            setCachedBuildings(parsed.buildings);
            const count = parsed.buildings.reduce(
              (acc: number, b: Building) => acc + (b.units?.length || b.total_units || 0),
              0
            );
            setTotalUnits(count);
            return;
          }
        }

        // 2. Try leaselink_local_buildings
        const rawLocal = localStorage.getItem("leaselink_local_buildings");
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
            setCachedBuildings(parsedLocal);
            const count = parsedLocal.reduce(
              (acc: number, b: Building) => acc + (b.units?.length || b.total_units || 0),
              0
            );
            setTotalUnits(count);
          }
        }
      }
    } catch {
      // Storage unavailable fallback
    }
  }, []);

  // Listen for online event
  useEffect(() => {
    const handleOnline = () => {
      setIsOnlineNow(true);
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard";
        }
      }, 1500);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setIsChecking(false);
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        setIsOnlineNow(true);
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/dashboard";
          }
        }, 1000);
      }
    } catch {
      // Still offline
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl bg-white p-1 shadow-md border border-white/20 shrink-0">
            <Image
              src="/brand/leaselink-symbol.png"
              alt="LeaseLink"
              width={40}
              height={40}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-blue-400 transition">
            LeaseLink
          </span>
        </Link>

        {/* Language selector */}
        <button
          type="button"
          onClick={() => setLanguage(isFrench ? "en" : "fr")}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
        >
          {isFrench ? "Switch to English" : "Passer en Français"}
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto w-full py-10 space-y-8">
        {/* Offline Badge & Banner */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto shadow-xl shadow-rose-950/20">
            <WifiOff className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {isOnlineNow
                ? isFrench
                  ? "Connexion Rétablie !"
                  : "Connection Restored!"
                : isFrench
                ? "Mode Hors Ligne Activé"
                : "Offline Mode Active"}
            </h1>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              {isOnlineNow
                ? isFrench
                  ? "Redirection vers votre tableau de bord..."
                  : "Redirecting to your dashboard..."
                : isFrench
                ? "Vous êtes actuellement déconnecté d'Internet. LeaseLink préserve vos données et fiches en cache local afin que vous puissiez continuer à consulter votre patrimoine."
                : "You are currently disconnected. LeaseLink preserves your records in local device storage so you can continue viewing properties and tenants offline."}
            </p>
          </div>

          {/* Action Button: Retry */}
          {!isOnlineNow && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isChecking}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-blue-600/25 transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
                <span>
                  {isChecking
                    ? isFrench
                      ? "Vérification..."
                      : "Checking..."
                    : isFrench
                    ? "Tester la Connexion"
                    : "Check Connection"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Access to Cached Sections */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Link
            href="/dashboard"
            className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-blue-500/40 transition group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Home className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white group-hover:text-blue-400 transition">
                  {isFrench ? "Tableau de Bord" : "Dashboard"}
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {isFrench ? "Consulter les données en cache" : "View cached properties"}
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/buildings"
            className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-blue-500/40 transition group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-400 transition">
                  {isFrench ? "Mes Bâtiments & Lots" : "Buildings & Units"}
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {isFrench ? "Fiches unités & locataires" : "Unit & tenant cards"}
              </p>
            </div>
          </Link>

          <Link
            href="/tenant/portal"
            className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-500/40 transition group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition">
                  {isFrench ? "Portail Locataire" : "Tenant Portal"}
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {isFrench ? "Détails du bail & loyer" : "Lease & rent details"}
              </p>
            </div>
          </Link>

          <Link
            href="/tenant/receipts"
            className="p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-emerald-500/40 transition group flex items-start gap-3.5"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white group-hover:text-amber-400 transition">
                  {isFrench ? "Archive des Quittances" : "Receipts Archive"}
                </h3>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {isFrench ? "Téléchargement hors-ligne" : "Offline download & view"}
              </p>
            </div>
          </Link>
        </div>

        {/* Cached Ledger Snapshot */}
        {cachedBuildings.length > 0 && (
          <div className="p-5 rounded-3xl bg-slate-800/50 border border-slate-700/70 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h2 className="font-bold text-sm text-white">
                  {isFrench ? "Patrimoine Disponible Hors-Ligne" : "Locally Cached Property Records"}
                </h2>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {cachedBuildings.length} {isFrench ? "bâtiment(s)" : "building(s)"} • {totalUnits} {isFrench ? "lots" : "units"}
              </span>
            </div>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {cachedBuildings.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-bold text-white truncate">{b.name}</p>
                    <p className="text-slate-400 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span>{b.address || b.city || "Emplacement enregistré"}</span>
                    </p>
                  </div>
                  <span className="text-slate-300 font-semibold shrink-0 ml-3">
                    {b.units?.length || b.total_units || 0} {isFrench ? "lots" : "units"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full py-4 text-center text-xs text-slate-500 border-t border-slate-800">
        <p>LeaseLink PWA • {isFrench ? "Mode Hors Ligne Certifié" : "Certified Offline PWA"}</p>
      </footer>
    </div>
  );
}

