"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Download,
  X,
  Share2,
  PlusSquare,
  Smartphone,
  Laptop,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
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
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const [showIosGuideModal, setShowIosGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Check whether the app is currently running inside the installed standalone PWA window
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

    // 4. Capture early beforeinstallprompt if already caught in head
    if (typeof window !== "undefined" && (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt) {
      setDeferredPrompt((window as unknown as { __pwaInstallPrompt: BeforeInstallPromptEvent }).__pwaInstallPrompt);
    }

    const handlePromptReady = (e: Event) => {
      const custom = e as CustomEvent<BeforeInstallPromptEvent>;
      if (custom.detail) {
        setDeferredPrompt(custom.detail);
      } else if (typeof window !== "undefined" && (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt) {
        setDeferredPrompt((window as unknown as { __pwaInstallPrompt: BeforeInstallPromptEvent }).__pwaInstallPrompt);
      }
    };
    window.addEventListener("leaselink:pwa_prompt_ready", handlePromptReady);

    // 5. Direct listener for beforeinstallprompt event (Edge, Chrome, Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvt = e as BeforeInstallPromptEvent;
      if (typeof window !== "undefined") {
        (window as unknown as { __pwaInstallPrompt: BeforeInstallPromptEvent }).__pwaInstallPrompt = promptEvt;
      }
      setDeferredPrompt(promptEvt);
    };

    // 6. Listen for appinstalled event (fired when user finishes native install)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== "undefined") {
        (window as unknown as { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt = null;
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("leaselink:pwa_prompt_ready", handlePromptReady);
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
    // 1. Check if deferredPrompt is ready in React state or captured in window.__pwaInstallPrompt
    let activePrompt =
      deferredPrompt ||
      (typeof window !== "undefined"
        ? (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt
        : null);

    // 2. If prompt is not yet ready, briefly wait up to 300ms in case the event is dispatched on first load
    if (!activePrompt && typeof window !== "undefined") {
      setIsInstalling(true);
      activePrompt = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        const timer = setTimeout(() => {
          resolve((window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt || null);
        }, 300);

        const promptHandler = (e: Event) => {
          clearTimeout(timer);
          window.removeEventListener("beforeinstallprompt", promptHandler);
          resolve(e as BeforeInstallPromptEvent);
        };
        window.addEventListener("beforeinstallprompt", promptHandler, { once: true });
      });
      setIsInstalling(false);
    }

    // 3. CASE A: Browser has native prompt available -> TRIGGER NATIVE BROWSER INSTALL DIALOG DIRECTLY!
    // This pops up the browser's native "Install app" dialog, followed by Microsoft Edge's
    // "Pin to taskbar", "Pin to Start", "Create Desktop shortcut" options.
    if (activePrompt) {
      try {
        setIsInstalling(true);
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
      } catch (err) {
        console.error("[PWA] Native install prompt error:", err);
      } finally {
        setIsInstalling(false);
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          (window as unknown as { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt = null;
        }
      }
      return;
    }

    // 4. CASE B: iOS Safari (Apple does not support beforeinstallprompt)
    if (platform === "ios") {
      setShowIosGuideModal(true);
      return;
    }

    // 5. CASE C: Desktop Edge / Chrome where activePrompt is not yet dispatched
    setShowInstallGuideModal(true);
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

            {/* Main Native Install Button */}
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
                  ? "Installer l'App"
                  : "Install App"}
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

      {/* Native Browser Install Helper Modal */}
      {showInstallGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-scaleIn">
            
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
                    {isFrench ? "Installer LeaseLink sur PC" : "Install LeaseLink on PC"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isFrench ? "Microsoft Edge / Google Chrome" : "Microsoft Edge / Google Chrome"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 my-4 text-xs sm:text-sm">
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                  ⊕
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                    {isFrench
                      ? "Installation directe depuis la barre d'adresse :"
                      : "Direct install from the address bar:"}
                  </p>
                  <p>
                    {isFrench
                      ? "Dans Microsoft Edge, regardez tout à droite de votre barre d'adresse (à côté de l'étoile). Cliquez sur l'icône ⊕ (Installer LeaseLink)."
                      : "In Microsoft Edge, look at the far right of your address bar. Click the ⊕ (Install LeaseLink) icon."}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 leading-relaxed space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {isFrench
                    ? "Ou via le menu (...) d'Edge :"
                    : "Or via Edge menu (...):"}
                </p>
                <p>
                  {isFrench
                    ? "Cliquez sur les 3 points (...) en haut à droite > Applications > Installer LeaseLink."
                    : "Click the 3 dots (...) top right > Apps > Install LeaseLink."}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isFrench
                    ? "Cela ouvre immédiatement la fenêtre native pour choisir d'épingler à la barre des tâches et au menu Démarrer."
                    : "This will open the native prompt allowing you to pin to taskbar and Start menu."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {isFrench ? "Actualiser la page" : "Refresh Page"}
              </button>
              <button
                type="button"
                onClick={() => setShowInstallGuideModal(false)}
                className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition cursor-pointer"
              >
                {isFrench ? "Fermer" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apple iOS Native-Style Bottom Action Sheet */}
      {showIosGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowIosGuideModal(false)}
        >
          <div
            className="relative w-full max-w-lg mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Handle Bar */}
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

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
                    {isFrench ? "Installer LeaseLink sur iPhone" : "Install LeaseLink on iPhone"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isFrench ? "Ajouter à l'écran d'accueil Safari" : "Add to Safari Home Screen"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIosGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 my-4 text-xs sm:text-sm">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0 font-bold">
                  <Share2 className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {isFrench ? "1. Appuyez sur le bouton Partager" : "1. Tap the Share button"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFrench ? "Situé tout en bas dans la barre de Safari" : "Located at the bottom of your Safari screen"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 font-bold">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {isFrench ? "2. Choisissez 'Sur l'écran d'accueil'" : "2. Tap 'Add to Home Screen'"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {isFrench ? "Puis confirmez avec 'Ajouter' en haut à droite" : "Then tap 'Add' in the top right corner"}
                  </p>
                </div>
              </div>
            </div>

            {/* Pointer to Safari bottom bar */}
            <div className="flex flex-col items-center justify-center gap-1 py-2 text-blue-500 dark:text-blue-400 text-xs font-semibold animate-bounce">
              <span>{isFrench ? "Le bouton Partager se trouve juste en dessous" : "The Share button is located right below"}</span>
              <span className="text-lg">↓</span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowIosGuideModal(false)}
                className="w-full py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-98 transition shadow-lg shadow-blue-500/25 cursor-pointer"
              >
                {isFrench ? "Compris" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
