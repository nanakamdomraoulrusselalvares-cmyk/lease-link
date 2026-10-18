"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Download, X, Share2, PlusSquare, Smartphone, Laptop, CheckCircle2, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaInstallBanner() {
  const { isFrench } = useLanguage();
  const bannerRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | "other">("desktop");
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check whether the app is currently running as an installed PWA / Standalone mode
  const checkIsStandalone = (): boolean => {
    if (typeof window === "undefined") return false;
    
    // 1. Standard W3C display-mode standalone media query
    const isStandaloneMQ = window.matchMedia("(display-mode: standalone)").matches;

    // 2. iOS Safari standalone boolean
    const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    // 3. Android Trusted Web Activity (TWA) referrer check
    const isAndroidTWA = document.referrer.includes("android-app://");

    return isStandaloneMQ || isIosStandalone || isAndroidTWA;
  };

  useEffect(() => {
    setMounted(true);

    // Clean up any legacy persistent lockouts so banner reappears in browser
    try {
      localStorage.removeItem("leaselink_pwa_banner_dismissed");
      localStorage.removeItem("leaselink_pwa_installed");
    } catch {
      // Storage unavailable fallback
    }

    // 1. Detect if the current window is genuinely running inside the installed standalone PWA
    if (checkIsStandalone()) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if dismissed during current browser session only
    try {
      const sessionDismissed = sessionStorage.getItem("leaselink_pwa_banner_dismissed");
      if (sessionDismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Storage unavailable fallback
    }

    // 3. Detect operating system / platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);

    if (isIos) {
      setPlatform("ios");
    } else if (isAndroid) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // 4. Register PWA Service Worker
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .catch((err) => {
            console.warn("[PWA] ServiceWorker registration failed:", err);
          });
      });
    }

    // 5. Listen for beforeinstallprompt event (Chromium, Android, Edge, Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 6. Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      try {
        localStorage.setItem("leaselink_pwa_installed", "true");
      } catch {
        // Ignore
      }
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Synchronize CSS variable --pwa-banner-height for sticky headers underneath
  useEffect(() => {
    const updateBannerHeight = () => {
      if (!mounted || isInstalled || isDismissed || !bannerRef.current) {
        document.documentElement.style.setProperty("--pwa-banner-height", "0px");
      } else {
        const height = bannerRef.current.offsetHeight;
        document.documentElement.style.setProperty("--pwa-banner-height", `${height}px`);
      }
    };

    updateBannerHeight();
    window.addEventListener("resize", updateBannerHeight);

    return () => {
      window.removeEventListener("resize", updateBannerHeight);
      document.documentElement.style.setProperty("--pwa-banner-height", "0px");
    };
  }, [mounted, isInstalled, isDismissed]);

  const handleInstallClick = async () => {
    // Case 1: Chromium browser with native deferredPrompt available
    if (deferredPrompt) {
      try {
        setIsInstalling(true);
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
      } catch (err) {
        console.error("[PWA] Install error:", err);
      } finally {
        setIsInstalling(false);
        setDeferredPrompt(null);
      }
      return;
    }

    // Case 2: iOS Safari (which doesn't support beforeinstallprompt) or Desktop without immediate prompt
    setShowGuideModal(true);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("leaselink_pwa_banner_dismissed", "true");
    } catch {
      // Ignore
    }
  };

  // If not yet mounted, or if user is already running the installed app, or has dismissed:
  if (!mounted || isInstalled || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Floating Top Banner - Stays permanently on top while scrolling */}
      <aside
        ref={bannerRef}
        role="region"
        aria-label={isFrench ? "Téléchargement de l'application LeaseLink" : "Download LeaseLink App"}
        className="sticky top-0 left-0 right-0 z-[60] w-full bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white border-b border-blue-500/20 shadow-md transition-all duration-200"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left: App Logo Artwork & Information */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {/* Logo container with real app icon */}
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white p-1 shadow-md shadow-blue-500/10 border border-white/20 shrink-0 overflow-hidden flex items-center justify-center">
              <Image
                src="/brand/leaselink-symbol.png"
                alt="LeaseLink App Icon"
                width={44}
                height={44}
                priority
                className="w-full h-full object-contain"
              />
            </div>

            {/* App Title & Value Proposition */}
            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight truncate">
                  LeaseLink App
                </span>
                <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded bg-gradient-to-r from-blue-500/20 to-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider shrink-0">
                  ★ 4.9 • {isFrench ? "Gratuit" : "Free"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 dark:text-slate-400 truncate mt-0.5">
                {isFrench
                  ? "Accès ultra-rapide, alertes instantanées & mode hors-ligne"
                  : "Instant notifications, offline access & one-tap payments"}
              </p>
            </div>
          </div>

          {/* Right: Device Badges & Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Device-aware helper badge (Desktop/Tablet) */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-300 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
              {platform === "ios" ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>iPhone / iPad</span>
                </>
              ) : platform === "android" ? (
                <>
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Android</span>
                </>
              ) : (
                <>
                  <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Windows / Mac</span>
                </>
              )}
            </div>

            {/* Main Download / Install Button */}
            <button
              type="button"
              id="pwa-install-banner-btn"
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 active:scale-95 shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce" />
              <span>
                {isInstalling
                  ? isFrench
                    ? "Installation..."
                    : "Installing..."
                  : isFrench
                  ? "Télécharger l'App"
                  : "Download App"}
              </span>
            </button>

            {/* Close / Dismiss Banner Button */}
            <button
              type="button"
              id="pwa-install-banner-close"
              onClick={handleDismiss}
              aria-label={isFrench ? "Fermer la bannière" : "Close banner"}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Platform-Specific Step-by-Step Installation Modal */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-scaleIn">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  <Image
                    src="/icons/apple-touch-icon.png"
                    alt="LeaseLink"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">
                    {isFrench ? "Installer LeaseLink" : "Install LeaseLink"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {platform === "ios"
                      ? isFrench
                        ? "Sur votre écran d'accueil iPhone ou iPad"
                        : "On your iPhone or iPad home screen"
                      : isFrench
                      ? "Sur l'écran d'accueil de votre téléphone"
                      : "On your phone home screen"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Instructions */}
            {platform === "ios" ? (
              <div className="space-y-3.5 my-5 text-xs sm:text-sm">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {isFrench ? "Appuyez sur le bouton Partager" : "Tap the Share button"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{isFrench ? "Situé dans la barre Safari" : "Located in Safari toolbar"}</span>
                      <Share2 className="w-3.5 h-3.5 text-blue-500" />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {isFrench ? "Sélectionnez 'Sur l'écran d'accueil'" : "Select 'Add to Home Screen'"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{isFrench ? "Faites défiler le menu" : "Scroll down the menu"}</span>
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-500" />
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 font-bold">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {isFrench ? "Appuyez sur 'Ajouter'" : "Tap 'Add' in the top right"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFrench
                        ? "L'icône LeaseLink apparaîtra sur votre écran d'accueil avec toutes vos apps !"
                        : "LeaseLink will appear with its official logo among all your apps!"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5 my-5 text-xs sm:text-sm">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {isFrench ? "Barre d'adresse ou menu du navigateur" : "Browser address bar or menu"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFrench
                        ? "Cliquez sur l'icône d'installation ⊕ à droite de la barre d'adresse de Chrome ou Edge."
                        : "Look for the install icon ⊕ on the right side of your Chrome/Edge address bar."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {isFrench ? "Confirmez l'installation" : "Confirm Installation"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFrench
                        ? "LeaseLink sera accessible depuis votre bureau, barre des tâches ou menu Démarrer."
                        : "LeaseLink will be added to your desktop, taskbar, or start menu with full offline capability."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition"
              >
                {isFrench ? "Compris !" : "Got it!"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
