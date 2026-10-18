"use client";

import { useEffect, useState } from "react";
import { Bell, Volume2, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { playPlatformNotificationChime } from "@/components/NotificationModals";

const DISMISS_KEY = "leaselink_notif_prompt_dismissed_until";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export default function NotificationPermissionPrompt() {
  const { isFrench } = useLanguage();
  const [showPrompt, setShowPrompt] = useState(false);
  const [justGranted, setJustGranted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Only execute on browser client
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    // If permission is already granted or denied, don't show prompt
    if (Notification.permission !== "default") {
      return;
    }

    // Check if dismissed recently
    try {
      const dismissedUntil = localStorage.getItem(DISMISS_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch (_) {}

    // Delay showing the prompt slightly after initial app render for non-jarring UX
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  const handleRequestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    setIsRequesting(true);
    try {
      const permission = await Notification.requestPermission();

      if (permission === "granted") {
        setJustGranted(true);
        playPlatformNotificationChime();

        // Send a test native system notification so the user sees it in action immediately
        const testTitle = isFrench
          ? "LeaseLink • Alertes & Son Activés"
          : "LeaseLink • Sound & Alerts Enabled";
        const testBody = isFrench
          ? "Parfait ! Vous serez notifié en direct des paiements et quittances même lorsque vous quittez l'application."
          : "Great! You will now receive alerts for payments and receipts even when outside the app.";

        try {
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "SHOW_NOTIFICATION",
              title: testTitle,
              body: testBody,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              tag: "leaselink-welcome-permission",
              url: "/",
            });
          } else if ("serviceWorker" in navigator) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(testTitle, {
                body: testBody,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                tag: "leaselink-welcome-permission",
                data: { url: "/" },
              }).catch(() => {
                new Notification(testTitle, {
                  body: testBody,
                  icon: "/icons/icon-192x192.png",
                  tag: "leaselink-welcome-permission",
                });
              });
            }).catch(() => {
              new Notification(testTitle, {
                body: testBody,
                icon: "/icons/icon-192x192.png",
                tag: "leaselink-welcome-permission",
              });
            });
          } else {
            new Notification(testTitle, {
              body: testBody,
              icon: "/icons/icon-192x192.png",
              tag: "leaselink-welcome-permission",
            });
          }
        } catch (_) {}

        // Hide success banner after 4 seconds
        setTimeout(() => {
          setShowPrompt(false);
        }, 4000);
      } else {
        // Denied or dismissed
        setShowPrompt(false);
        try {
          localStorage.setItem(DISMISS_KEY, (Date.now() + DISMISS_DURATION_MS).toString());
        } catch (_) {}
      }
    } catch (err) {
      console.warn("Notification permission error:", err);
      setShowPrompt(false);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      localStorage.setItem(DISMISS_KEY, (Date.now() + DISMISS_DURATION_MS).toString());
    } catch (_) {}
  };

  if (!showPrompt) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[99999] w-[94%] sm:w-[420px] max-w-md animate-in fade-in slide-in-from-bottom-6 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-500/40 dark:border-blue-500/30 shadow-2xl shadow-blue-950/40 p-4 sm:p-5 ring-1 ring-blue-500/20 text-slate-900 dark:text-white">
        {/* Top vibrant accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-400" />

        {justGranted ? (
          <div className="flex items-center gap-3 py-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {isFrench ? "Notifications activées !" : "Notifications enabled!"}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isFrench
                  ? "Vous recevrez vos alertes sonores même lorsque vous quittez l'application."
                  : "You'll receive sound alerts even when outside the app."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 shrink-0">
                  <Bell className="w-5 h-5 animate-pulse" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white dark:border-slate-900" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>
                      {isFrench
                        ? "Activer les Alertes & le Son"
                        : "Enable Push & Sound Alerts"}
                    </span>
                    <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </h4>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    {isFrench ? "Notification en temps réel" : "Real-time updates"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title={isFrench ? "Fermer" : "Close"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {isFrench
                ? "Autorisez LeaseLink à vous avertir par vibration et son lors d'un paiement, quittance ou signalement, même lorsque l'application est fermée ou en arrière-plan."
                : "Allow LeaseLink to alert you with sound & vibration for rent payments, receipts, and maintenance, even when the app is in the background or closed."}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {isFrench ? "Plus tard" : "Later"}
              </button>

              <button
                type="button"
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  {isRequesting
                    ? isFrench
                      ? "Autorisation..."
                      : "Authorizing..."
                    : isFrench
                    ? "Autoriser les Notifications"
                    : "Authorize Notifications"}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
