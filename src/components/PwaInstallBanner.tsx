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
  Sparkles,
  MonitorDown,
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
  const [platform, setPlatform] = useState<"ios" | "android" | "windows" | "mac" | "desktop" | "other">("desktop");
  const [browserType, setBrowserType] = useState<"edge" | "chrome" | "safari" | "samsung" | "firefox" | "other">("other");
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

    // 4. PWA start_url param
    const isPwaUrl = window.location.search.includes("source=pwa");

    return isStandaloneMQ || isIosStandalone || isAndroidTWA || isPwaUrl;
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

    // Check if browser API reports installed apps
    if (typeof navigator !== "undefined" && "getInstalledRelatedApps" in navigator) {
      try {
        (navigator as unknown as { getInstalledRelatedApps: () => Promise<unknown[]> })
          .getInstalledRelatedApps()
          .then((apps) => {
            if (apps && apps.length > 0) {
              setIsInstalled(true);
            }
          })
          .catch(() => {});
      } catch {
        // Ignore
      }
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

    // 3. Detect operating system & browser
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    const isMac = /macintosh|mac os x/.test(ua) && !isIos;
    const isWin = /windows/.test(ua);

    if (isIos) {
      setPlatform("ios");
    } else if (isAndroid) {
      setPlatform("android");
    } else if (isWin) {
      setPlatform("windows");
    } else if (isMac) {
      setPlatform("mac");
    } else {
      setPlatform("desktop");
    }

    const isEdge = /edg\//.test(ua);
    const isSamsung = /samsungbrowser/.test(ua);
    const isChrome = /chrome|chromium|crios/.test(ua) && !isEdge && !isSamsung;
    const isSafari = /safari/.test(ua) && !isChrome && !isEdge && !isSamsung;
    const isFirefox = /firefox|fxios/.test(ua);

    if (isEdge) setBrowserType("edge");
    else if (isSamsung) setBrowserType("samsung");
    else if (isChrome) setBrowserType("chrome");
    else if (isSafari) setBrowserType("safari");
    else if (isFirefox) setBrowserType("firefox");
    else setBrowserType("other");

    // 4. Capture early beforeinstallprompt if already caught in head
    if (
      typeof window !== "undefined" &&
      (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt
    ) {
      setDeferredPrompt(
        (window as unknown as { __pwaInstallPrompt: BeforeInstallPromptEvent }).__pwaInstallPrompt
      );
    }

    const handlePromptReady = (e: Event) => {
      const custom = e as CustomEvent<BeforeInstallPromptEvent>;
      if (custom.detail) {
        setDeferredPrompt(custom.detail);
      } else if (
        typeof window !== "undefined" &&
        (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt
      ) {
        setDeferredPrompt(
          (window as unknown as { __pwaInstallPrompt: BeforeInstallPromptEvent }).__pwaInstallPrompt
        );
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

  // Lock body scroll and handle ESC key for guide modals
  useEffect(() => {
    if (showInstallGuideModal || showIosGuideModal) {
      document.documentElement.classList.add("modal-open");
      document.body.classList.add("modal-open");
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowInstallGuideModal(false);
          setShowIosGuideModal(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.documentElement.classList.remove("modal-open");
        document.body.classList.remove("modal-open");
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [showInstallGuideModal, showIosGuideModal]);

  const handleInstallClick = async () => {
    // 1. Check if deferredPrompt is ready in React state or captured in window.__pwaInstallPrompt
    let activePrompt =
      deferredPrompt ||
      (typeof window !== "undefined"
        ? (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt
        : null);

    // 2. If prompt is not yet ready, briefly wait up to 800ms in case the event is being evaluated
    if (!activePrompt && typeof window !== "undefined") {
      setIsInstalling(true);
      activePrompt = await new Promise<BeforeInstallPromptEvent | null>((resolve) => {
        const timer = setTimeout(() => {
          resolve(
            (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt || null
          );
        }, 800);

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
    if (activePrompt) {
      try {
        setIsInstalling(true);
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
          setDeferredPrompt(null);
          if (typeof window !== "undefined") {
            (window as unknown as { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt = null;
          }
        }
      } catch (err) {
        console.error("[PWA] Native install prompt error:", err);
        if (platform === "ios") {
          setShowIosGuideModal(true);
        } else {
          setShowInstallGuideModal(true);
        }
      } finally {
        setIsInstalling(false);
      }
      return;
    }

    // 4. CASE B: iOS Safari (Apple does not support beforeinstallprompt)
    if (platform === "ios") {
      setShowIosGuideModal(true);
      return;
    }

    // 5. CASE C: Desktop Edge / Chrome / Android where activePrompt is not yet dispatched
    setShowInstallGuideModal(true);
  };

  // Global listener for "leaselink:trigger_install"
  useEffect(() => {
    const handleGlobalTrigger = () => {
      setIsDismissed(false);
      try {
        sessionStorage.removeItem("leaselink_pwa_banner_dismissed");
      } catch {
        // Ignore
      }
      handleInstallClick();
    };

    window.addEventListener("leaselink:trigger_install", handleGlobalTrigger);
    return () => {
      window.removeEventListener("leaselink:trigger_install", handleGlobalTrigger);
    };
  }, [deferredPrompt, platform]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("leaselink_pwa_banner_dismissed", "true");
    } catch {
      // Ignore
    }
  };

  return (
    <>
      {/* Floating Top Banner - Stays visible on top while scrolling (when not installed and not dismissed) */}
      {mounted && !isInstalled && !isDismissed && (
        <aside
          ref={bannerRef}
          role="region"
          aria-label={isFrench ? "Téléchargement de l'application LeaseLink" : "Download LeaseLink App"}
          className="sticky top-0 left-0 right-0 z-[60] w-full bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white border-b border-blue-500/20 shadow-md transition-all duration-200"
        >
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Left: App Logo Artwork & Information */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
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
      )}

      {/* ========================================================================= */}
      {/* 1. NATIVE BROWSER INSTALL GUIDE MODAL (Responsive & Full Touch Scroll)     */}
      {/* ========================================================================= */}
      {showInstallGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm select-none animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInstallGuideModal(false);
          }}
        >
          <div className="min-h-full flex items-start sm:items-center justify-center py-2 sm:py-6">
            <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain select-text space-y-4">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    <Image
                      src="/brand/leaselink-symbol.png"
                      alt="LeaseLink"
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                      {isFrench ? "Installer l'App LeaseLink" : "Install LeaseLink App"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {platform === "android"
                        ? "Google Chrome • Samsung Internet"
                        : browserType === "edge"
                        ? "Microsoft Edge sur Windows / Mac"
                        : browserType === "chrome"
                        ? "Google Chrome sur Windows / Mac"
                        : browserType === "safari"
                        ? "Safari sur Mac"
                        : "Application Web Progressive (PWA)"}
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

              {/* Direct Native Install Button (if prompt has become available) */}
              {(deferredPrompt || (typeof window !== "undefined" && (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt)) && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-emerald-500/10 border border-blue-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {isFrench ? "Installation automatique disponible !" : "One-Click Install Available!"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInstallGuideModal(false);
                      handleInstallClick();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 animate-bounce" />
                    <span>{isFrench ? "Lancer l'Installation Immédiate" : "Install Now Directly"}</span>
                  </button>
                </div>
              )}

              {/* Dynamic Step-by-Step Guidance */}
              <div className="space-y-3 text-xs sm:text-sm">
                {platform === "android" ? (
                  // Android Chrome / Samsung Instructions
                  <>
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        1
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {isFrench ? "Appuyez sur le menu (⋮) en haut à droite" : "Tap the (⋮) menu at top right"}
                        </p>
                        <p>
                          {isFrench
                            ? "Dans Google Chrome ou Samsung Internet, touchez les trois points verticaux en haut à droite de l'écran."
                            : "In Chrome or Samsung Internet, tap the three vertical dots in the top right corner."}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        2
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {isFrench ? "Sélectionnez 'Installer l'application'" : "Select 'Install app'"}
                        </p>
                        <p>
                          {isFrench
                            ? "Ou choisissez 'Ajouter à l'écran d'accueil' selon votre version d'Android, puis confirmez avec 'Installer'."
                            : "Or choose 'Add to Home Screen', then confirm by tapping 'Install'."}
                        </p>
                      </div>
                    </div>
                  </>
                ) : browserType === "edge" ? (
                  // Microsoft Edge Instructions
                  <>
                    <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        ⊕
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {isFrench ? "Depuis la barre d'adresse de Microsoft Edge :" : "From the Edge address bar:"}
                        </p>
                        <p>
                          {isFrench
                            ? "Regardez tout à droite de la barre d'adresse (à côté de l'étoile des favoris). Cliquez sur l'icône ⊕ (Installer LeaseLink)."
                            : "Look at the far right of the address bar. Click the ⊕ (Install LeaseLink) icon."}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        ...
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {isFrench ? "Ou via le menu (...) d'Edge :" : "Or via the (...) menu:"}
                        </p>
                        <p>
                          {isFrench
                            ? "Cliquez sur (...) > Applications > 'Installer LeaseLink'. Vous pourrez l'épingler à la barre des tâches !"
                            : "Click (...) > Apps > 'Install LeaseLink'. You can pin it to your taskbar and Start menu!"}
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  // Google Chrome Desktop / Other Instructions
                  <>
                    <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        <MonitorDown className="w-4 h-4" />
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {isFrench ? "Icône d'installation dans la barre d'adresse :" : "Install icon in the address bar:"}
                        </p>
                        <p>
                          {isFrench
                            ? "Cliquez sur l'icône d'ordinateur avec une flèche (Installer) située à droite dans la barre d'adresse de Chrome."
                            : "Click the computer icon with a down arrow located at the right of your Chrome address bar."}
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-700 text-white font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                        ⋮
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        <p className="font-bold text-slate-900 dark:text-white mb-0.5">
                          {isFrench ? "Ou via le menu (⋮) de Chrome :" : "Or via the Chrome menu (⋮):"}
                        </p>
                        <p>
                          {isFrench
                            ? "Cliquez sur les 3 points (⋮) en haut à droite > 'Installer LeaseLink...' puis validez."
                            : "Click the 3 dots (⋮) top right > 'Install LeaseLink...' and confirm."}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Key Benefits */}
                <div className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{isFrench ? "Mode hors-ligne" : "Offline mode"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{isFrench ? "Notifications push" : "Push notifications"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{isFrench ? "Aucun téléchargement lourd" : "No store download"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{isFrench ? "Accès 1-clic direct" : "One-tap launch"}</span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
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
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-95 transition cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {isFrench ? "Compris / Fermer" : "Got it / Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. APPLE iOS SAFARI ACTION SHEET GUIDE (Full Touch Scroll)                */}
      {/* ========================================================================= */}
      {showIosGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] overflow-y-auto overflow-x-hidden p-2.5 sm:p-4 flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm select-none animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIosGuideModal(false);
          }}
        >
          <div
            className="relative w-full max-w-lg mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS Sheet Handle Bar */}
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />

            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white p-1 shadow-md border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                  <Image
                    src="/brand/leaselink-symbol.png"
                    alt="LeaseLink"
                    width={48}
                    height={48}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg">
                    {isFrench ? "Installer LeaseLink sur iPhone / iPad" : "Install LeaseLink on iPhone / iPad"}
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
                    {isFrench ? "Situé tout en bas dans la barre d'outils de Safari" : "Located at the bottom of your Safari toolbar"}
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
                {isFrench ? "Compris / Fermer" : "Got it / Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
