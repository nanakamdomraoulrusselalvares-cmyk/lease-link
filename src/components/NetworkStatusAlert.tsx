"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  X,
  Gauge,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export type NetworkQuality = "good" | "slow" | "offline";

export default function NetworkStatusAlert() {
  const { isFrench } = useLanguage();
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>("good");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissedSlow, setDismissedSlow] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const previousQualityRef = useRef<NetworkQuality>("good");

  // Ping the server to measure real round-trip latency
  const measureLatency = useCallback(async (): Promise<{
    quality: NetworkQuality;
    latency: number | null;
  }> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { quality: "offline", latency: null };
    }

    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { quality: "slow", latency: null };
      }

      const duration = Math.round(performance.now() - start);

      // If duration exceeds 2200ms, network is deemed slow/unstable
      if (duration > 2200) {
        return { quality: "slow", latency: duration };
      }

      return { quality: "good", latency: duration };
    } catch {
      // Aborted or failed
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return { quality: "offline", latency: null };
      }
      return { quality: "slow", latency: null };
    }
  }, []);

  const runQualityCheck = useCallback(async () => {
    setChecking(true);
    const result = await measureLatency();
    setChecking(false);

    setLatencyMs(result.latency);

    // If transitioned from offline/slow to good, show green restored banner
    if (
      result.quality === "good" &&
      previousQualityRef.current === "offline"
    ) {
      setShowRestoredNotice(true);
      setTimeout(() => setShowRestoredNotice(false), 3500);
    }

    previousQualityRef.current = result.quality;
    setNetworkQuality(result.quality);
  }, [measureLatency]);

  // Initial and periodic checks
  useEffect(() => {
    // Initial check
    runQualityCheck();

    // Listen to browser network changes
    const handleOnline = () => {
      runQualityCheck();
    };

    const handleOffline = () => {
      previousQualityRef.current = "offline";
      setNetworkQuality("offline");
      setDismissedSlow(false);
    };

    // Listen to Network Information API if available
    const navConn =
      typeof navigator !== "undefined" &&
      // @ts-expect-error Network Information API
      (navigator.connection || navigator.mozConnection || navigator.webkitConnection);

    const handleConnChange = () => {
      if (navConn) {
        if (navConn.effectiveType === "slow-2g" || navConn.effectiveType === "2g") {
          setNetworkQuality("slow");
          setDismissedSlow(false);
          return;
        }
      }
      runQualityCheck();
    };

    if (navConn) {
      navConn.addEventListener("change", handleConnChange);
    }

    // Listen to custom slow request report event
    const handleSlowRequestReport = (e: Event) => {
      const customEvent = e as CustomEvent<{ durationMs?: number }>;
      const reportedDuration = customEvent.detail?.durationMs;
      if (reportedDuration) {
        setLatencyMs(reportedDuration);
      }
      setNetworkQuality("slow");
      setDismissedSlow(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(
      "leaselink:report_slow_request",
      handleSlowRequestReport as EventListener
    );

    // Periodic check every 35 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        runQualityCheck();
      }
    }, 35000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "leaselink:report_slow_request",
        handleSlowRequestReport as EventListener
      );
      if (navConn) {
        navConn.removeEventListener("change", handleConnChange);
      }
    };
  }, [runQualityCheck]);

  // 1. Restored Connection Toast (auto-fades)
  if (showRestoredNotice && networkQuality === "good") {
    return (
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9990] animate-in fade-in slide-in-from-top-3 duration-300 w-[92%] sm:w-auto max-w-md">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 border border-emerald-500 text-xs font-semibold backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-100" />
          <div className="flex-1">
            <span>
              {isFrench
                ? "Connexion internet rétablie !"
                : "Internet connection restored!"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Offline Banner (High Priority)
  if (networkQuality === "offline") {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9990] animate-in fade-in slide-in-from-top-2 duration-300 w-[94%] sm:w-auto max-w-lg">
        <div className="p-3 sm:px-4 sm:py-3 rounded-2xl bg-rose-600 dark:bg-rose-700 text-white shadow-2xl shadow-rose-950/40 border border-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm leading-tight">
                {isFrench ? "Mode Hors Ligne Détecté" : "Offline Mode Detected"}
              </p>
              <p className="text-[11px] text-rose-100 mt-0.5 leading-snug">
                {isFrench
                  ? "Aucune connexion internet. Les données locales en cache restent consultables."
                  : "No internet connection. Cached local records remain accessible."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={runQualityCheck}
            disabled={checking}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`}
            />
            <span>{isFrench ? "Réessayer" : "Retry"}</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Slow Network / High Latency Alert
  if (networkQuality === "slow" && !dismissedSlow) {
    return (
      <div className="fixed bottom-4 right-4 z-[9990] animate-in fade-in slide-in-from-bottom-3 duration-300 w-[92%] sm:w-96 max-w-md">
        <div className="p-3.5 rounded-2xl bg-amber-500 dark:bg-amber-600 text-white shadow-2xl shadow-amber-950/30 border border-amber-300 dark:border-amber-400 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-black/15 flex items-center justify-center shrink-0 mt-0.5">
                <Gauge className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-xs leading-tight">
                    {isFrench
                      ? "Connexion Réseau Lente Détectée"
                      : "Slow Network Detected"}
                  </p>
                  {latencyMs && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-black/20">
                      {latencyMs}ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-100 mt-1 leading-snug">
                  {isFrench
                    ? "Vos données mobiles ou votre réseau sont instables. LeaseLink continue de charger vos données en arrière-plan."
                    : "Your mobile data or connection is slow. LeaseLink is still working in the background."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDismissedSlow(true)}
              className="p-1 rounded-lg text-amber-100 hover:text-white hover:bg-black/10 transition shrink-0"
              title={isFrench ? "Fermer l'alerte" : "Dismiss alert"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/20 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-amber-100 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-200" />
              <span>{isFrench ? "Données sécurisées" : "Data safe"}</span>
            </span>

            <button
              type="button"
              onClick={runQualityCheck}
              disabled={checking}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold transition cursor-pointer"
            >
              <RefreshCw
                className={`w-3 h-3 ${checking ? "animate-spin" : ""}`}
              />
              <span>{isFrench ? "Re-tester" : "Re-test"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
