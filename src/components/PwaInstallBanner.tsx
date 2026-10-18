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
  Monitor,
  Sparkles,
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
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

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

  // Helper to trigger direct download of a Windows/Mac desktop shortcut file (.url)
  const triggerDesktopShortcutDownload = () => {
    if (typeof window === "undefined") return;
    try {
      const origin = window.location.origin;
      const shortcutContent = `[InternetShortcut]\r\nURL=${origin}/\r\nIconIndex=0\r\nIconFile=${origin}/favicon.ico\r\nHotKey=0\r\n[{000214A0-0000-0000-C000-000000000046}]\r\nProp3=19,11\r\n`;
      const blob = new Blob([shortcutContent], { type: "application/internet-shortcut;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "LeaseLink-App.url";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
      setDownloadSuccess(true);
    } catch (e) {
      console.warn("[PWA] Shortcut download error:", e);
    }
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

    // 2. Detect if already installed via Chrome/Edge getInstalledRelatedApps API
    if (typeof navigator !== "undefined" && "getInstalledRelatedApps" in navigator) {
      try {
        (navigator as unknown as { getInstalledRelatedApps: () => Promise<Array<unknown>> })
          .getInstalledRelatedApps()
          .then((apps) => {
            if (apps && apps.length > 0) {
              setIsInstalled(true);
            }
          })
          .catch(() => {});
      } catch {
        // ignore
      }
    }

    // 3. Check if dismissed during current browser session only
    try {
      const sessionDismissed = sessionStorage.getItem("leaselink_pwa_banner_dismissed");
      if (sessionDismissed === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Storage unavailable fallback
    }

    // 4. Detect operating system / platform
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

    // 5. Capture early beforeinstallprompt if already caught in head
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

    // 6. Direct listener for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvt = e as BeforeInstallPromptEvent;
      if (typeof window !== "undefined") {
        (window as unknown as { __pwaInstallPrompt: BeforeInstallPromptEvent }).__pwaInstallPrompt = promptEvt;
      }
      setDeferredPrompt(promptEvt);
    };

    // 7. Listen for appinstalled event
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
    // 1. Check if deferredPrompt is ready in state or window
    let activePrompt =
      deferredPrompt ||
      (typeof window !== "undefined"
        ? (window as unknown as { __pwaInstallPrompt?: BeforeInstallPromptEvent }).__pwaInstallPrompt
        : null);

    // 2. If prompt is not yet ready, give it 300ms to arrive during initial render
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

    // 3. If activePrompt is available: Trigger browser's native install modal directly!
    if (activePrompt) {
      try {
        setIsInstalling(true);
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        if (choice.outcome === "accepted") {
          setIsInstalled(true);
        }
      } catch (err) {
        console.error("[PWA] Install error:", err);
      } finally {
        setIsInstalling(false);
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          (window as unknown as { __pwaInstallPrompt?: unknown }).__pwaInstallPrompt = null;
        }
      }
      return;
    }

    // 4. Fallback: If on Desktop, immediately trigger the real file download of the desktop launcher!
    if (platform === "desktop") {
      triggerDesktopShortcutDownload();
    }

    // 5. Open the rich Install Hub modal (not dry text points, but interactive visual hub)
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

      {/* Rich Interactive Download & Installation Hub Modal */}
      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
        >
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-900 dark:text-slate-100 animate-scaleIn">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
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
                    {isFrench ? "Installation de LeaseLink" : "Install LeaseLink App"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {platform === "desktop"
                      ? isFrench
                        ? "Application Windows / macOS haute performance"
                        : "High-performance Windows & Mac desktop experience"
                      : platform === "ios"
                      ? isFrench
                        ? "Pour votre écran d'accueil iPhone ou iPad"
                        : "For your iPhone or iPad home screen"
                      : isFrench
                      ? "Pour votre téléphone Android"
                      : "For your Android device"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Desktop Visual Experience */}
            {platform === "desktop" && (
              <div className="space-y-4 my-4">
                {/* Download Success Notice */}
                {downloadSuccess ? (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {isFrench ? "✓ Raccourci téléchargé dans votre dossier Téléchargements !" : "✓ Shortcut downloaded to your Downloads folder!"}
                      </p>
                      <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {isFrench
                          ? "Le fichier 'LeaseLink-App.url' a été enregistré. Glissez-le sur votre bureau Windows ou double-cliquez pour ouvrir LeaseLink."
                          : "The 'LeaseLink-App.url' launcher was saved. Drag it to your desktop or double-click to open LeaseLink."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Primary Action Button: Direct Download of Shortcut */}
                <button
                  type="button"
                  onClick={triggerDesktopShortcutDownload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 active:scale-98 transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {downloadSuccess
                      ? isFrench
                        ? "Télécharger à nouveau le raccourci (.url)"
                        : "Download Shortcut Again (.url)"
                      : isFrench
                      ? "Télécharger le Raccourci Bureau (.url)"
                      : "Download Desktop Shortcut (.url)"}
                  </span>
                </button>

                {/* Native Browser Install Visual Card */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-blue-500" />
                      <span>{isFrench ? "Installation Native (Edge / Chrome)" : "Native Install (Edge / Chrome)"}</span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {isFrench ? "Sans Navigateur" : "Standalone App"}
                    </span>
                  </div>

                  {/* Browser URL Bar Mockup */}
                  <div className="p-2.5 rounded-lg bg-slate-200/90 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 truncate text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span className="text-emerald-500">🔒</span>
                      <span className="truncate">
                        {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 text-white font-sans font-bold text-[11px] shadow-sm animate-pulse shrink-0">
                      <span>⊕</span>
                      <span>{isFrench ? "Installer l'app" : "Install app"}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {isFrench
                      ? "Pour une expérience complète sans barre de navigation : cliquez sur l'icône d'installation ⊕ située tout à droite dans la barre d'adresse de votre navigateur."
                      : "For a standalone window without browser tabs : click the ⊕ or monitor icon on the far right of your address bar."}
                  </p>
                </div>
              </div>
            )}

            {/* iOS Step-by-Step Experience */}
            {platform === "ios" && (
              <div className="space-y-3 my-5 text-xs sm:text-sm">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{isFrench ? "Appuyez sur le bouton Partager" : "Tap the Share button"}</span>
                      <Share2 className="w-3.5 h-3.5 text-blue-500" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFrench ? "Situé en bas de l'écran dans la barre Safari." : "Located at the bottom of Safari."}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{isFrench ? "Sélectionnez 'Sur l'écran d'accueil'" : "Select 'Add to Home Screen'"}</span>
                      <PlusSquare className="w-3.5 h-3.5 text-emerald-500" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {isFrench
                        ? "Faites défiler le menu vers le bas puis confirmez en appuyant sur Ajouter."
                        : "Scroll down the menu and tap 'Add' in the top right."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Android Experience */}
            {platform === "android" && (
              <div className="space-y-3.5 my-5 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-emerald-500 shrink-0" />
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {isFrench
                      ? "LeaseLink s'installe directement comme une application native avec son icône officielle."
                      : "LeaseLink installs directly with its official icon onto your Android app drawer."}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {isFrench
                    ? "Si le dialogue d'installation ne s'ouvre pas automatiquement, appuyez sur le menu (⋮) en haut à droite de Chrome et choisissez 'Installer l'application'."
                    : "If the prompt doesn't open automatically, tap the menu (⋮) in Chrome and select 'Install app'."}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 active:scale-95 transition cursor-pointer"
              >
                {isFrench ? "Fermer" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
