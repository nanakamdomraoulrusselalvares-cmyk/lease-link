"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  className?: string;
  variant?: "pill" | "minimal" | "floating";
}

export default function LanguageSwitcher({
  className = "",
  variant = "pill",
}: LanguageSwitcherProps) {
  const { language, setLanguage, isFrench } = useLanguage();

  if (variant === "floating") {
    // Floating bottom variant removed per user request: language switcher only appears at top
    return null;
  }

  if (variant === "minimal") {
    return (
      <button
        type="button"
        onClick={() => setLanguage(isFrench ? "en" : "fr")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700/80 transition cursor-pointer shadow-xs ${className}`}
        title="Switch Language / Changer de langue"
      >
        <Globe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span>{isFrench ? "FR" : "EN"}</span>
      </button>
    );
  }

  // Default Pill Variant for Navbars
  return (
    <div
      className={`inline-flex items-center bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 text-xs font-bold shadow-xs ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
          language === "en"
            ? "bg-blue-600 text-white font-bold shadow-sm"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
        }`}
        title="English"
      >
        <span className="text-[11px]">🇬🇧</span>
        <span>EN</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage("fr")}
        className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
          language === "fr"
            ? "bg-blue-600 text-white font-bold shadow-sm"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
        }`}
        title="Français"
      >
        <span className="text-[11px]">🇫🇷</span>
        <span>FR</span>
      </button>
    </div>
  );
}
