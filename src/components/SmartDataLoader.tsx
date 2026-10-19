"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  WifiOff,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface SmartDataLoaderProps {
  label?: string;
  onRetry?: () => void;
  onUseCache?: () => void;
  hasCachedData?: boolean;
  minHeight?: string;
}

export default function SmartDataLoader({
  label,
  onRetry,
  onUseCache,
  hasCachedData = false,
  minHeight = "min-h-[350px]",
}: SmartDataLoaderProps) {
  const { isFrench } = useLanguage();
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => {
        const nextVal = prev + 1;
        // At 4 seconds, report slow request to global monitor
        if (nextVal === 4 && typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("leaselink:report_slow_request", {
              detail: { durationMs: 4000 },
            })
          );
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const isSlow = secondsElapsed >= 3;
  const isVerySlow = secondsElapsed >= 7;

  return (
    <div
      className={`w-full ${minHeight} flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300`}
    >
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
        {/* Animated Background Shimmer Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 animate-pulse w-full" />
        </div>

        {/* Icon based on speed */}
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 shadow-sm">
          {!isSlow ? (
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
            </div>
          ) : isVerySlow ? (
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center animate-bounce">
              <WifiOff className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
          {!isSlow
            ? label ||
              (isFrench
                ? "Synchronisation des données en cours..."
                : "Synchronizing your property data...")
            : isVerySlow
            ? isFrench
              ? "Connexion réseau très faible ou coupée"
              : "Very slow or interrupted network connection"
            : isFrench
            ? "Connexion ralentie détectée"
            : "Slow data connection detected"}
        </h3>

        {/* Explanatory Message */}
        <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {!isSlow
            ? isFrench
              ? "Récupération sécurisée de votre portefeuille immobilier..."
              : "Securely fetching your real estate portfolio from database..."
            : isVerySlow
            ? isFrench
              ? "La requête prend plus de 7 secondes. Votre forfait de données mobiles est peut-être épuisé ou le signal est trop faible."
              : "Request has taken over 7 seconds. Your mobile data may be depleted or signal is weak."
            : isFrench
            ? "Vos données mettent plus de temps que prévu à charger. LeaseLink maintient la requête active."
            : "Data is taking longer than usual to arrive. LeaseLink is still working to retrieve it."}
        </p>

        {/* Timer Badge */}
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>
            {isFrench ? "En attente depuis" : "Waiting for"}{" "}
            <strong className="text-slate-900 dark:text-white font-bold">
              {secondsElapsed}s
            </strong>
          </span>
        </div>

        {/* Action Buttons when Slow */}
        {isSlow && (
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-2.5 animate-in fade-in duration-200">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {isFrench ? "Forcer l'Actualisation" : "Force Refresh"}
                </span>
              </button>
            )}

            {hasCachedData && onUseCache && (
              <button
                type="button"
                onClick={onUseCache}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {isFrench ? "Afficher les Données en Cache" : "View Cached Records"}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
