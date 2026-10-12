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
    return (
      <div
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-full p-1 shadow-2xl ${className}`}
        title="Switch Language / Changer de langue"
      >
        <button
          type="button"
          onClick={() => setLanguage("en")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            language === "en"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <span>🇬🇧</span>
          <span>EN</span>
        </button>
        <button
          type="button"
          onClick={() => setLanguage("fr")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            language === "fr"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
              : "text-slate-400 hover:text-white hover:bg-slate-800"
          }`}
        >
          <span>🇫🇷</span>
          <span>FR</span>
        </button>
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <button
        type="button"
        onClick={() => setLanguage(isFrench ? "en" : "fr")}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer ${className}`}
        title="Switch Language / Changer de langue"
      >
        <Globe className="w-3.5 h-3.5 text-blue-400" />
        <span>{isFrench ? "FR" : "EN"}</span>
      </button>
    );
  }

  // Default Pill Variant for Navbars
  return (
    <div
      className={`inline-flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-0.5 text-xs font-bold shadow-inner ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
          language === "en"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-slate-800/60"
        }`}
        title="English"
      >
        <span className="text-[11px]">🇬🇧</span>
        <span>EN</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage("fr")}
        className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
          language === "fr"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-slate-400 hover:text-white hover:bg-slate-800/60"
        }`}
        title="Français"
      >
        <span className="text-[11px]">🇫🇷</span>
        <span>FR</span>
      </button>
    </div>
  );
}
