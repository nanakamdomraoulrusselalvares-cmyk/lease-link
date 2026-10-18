"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface BrandLogoProps {
  href?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  showSubtitle?: boolean;
  className?: string;
  variant?: "symbol" | "full";
}

export default function BrandLogo({
  href,
  size = "md",
  showText = true,
  showSubtitle = false,
  className = "",
  variant = "symbol",
}: BrandLogoProps) {
  const { isFrench } = useLanguage();

  const sizeMap = {
    xs: { px: 24, text: "text-base", sub: "text-[9px]" },
    sm: { px: 32, text: "text-lg", sub: "text-[10px]" },
    md: { px: 40, text: "text-xl", sub: "text-[11px]" },
    lg: { px: 48, text: "text-2xl", sub: "text-xs" },
    xl: { px: 64, text: "text-3xl", sub: "text-sm" },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`inline-flex items-center gap-2.5 group ${className}`}>
      {variant === "full" ? (
        <div className="relative shrink-0 overflow-hidden">
          <Image
            src="/brand/leaselink-logo.png"
            alt="LeaseLink Logo"
            width={currentSize.px * 2.8}
            height={currentSize.px}
            className="h-auto w-auto max-h-12 object-contain group-hover:scale-105 transition-transform"
            priority
          />
        </div>
      ) : (
        <>
          <div className="relative shrink-0 flex items-center justify-center">
            <Image
              src="/brand/leaselink-symbol.png"
              alt="LeaseLink Icon"
              width={currentSize.px}
              height={currentSize.px}
              className="object-contain group-hover:scale-105 transition-transform"
              style={{ width: currentSize.px, height: currentSize.px }}
              priority
            />
          </div>

          {showText && (
            <div className="flex flex-col leading-none">
              <span
                className={`font-black tracking-tight text-slate-900 dark:text-white ${currentSize.text}`}
              >
                Lease
                <span className="text-emerald-500 dark:text-emerald-400">
                  Link
                </span>
              </span>
              {showSubtitle && (
                <span
                  className={`font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mt-1 ${currentSize.sub}`}
                >
                  {isFrench ? "Gestion Locative" : "Smart Rentals"}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex cursor-pointer focus:outline-none">
        {content}
      </Link>
    );
  }

  return content;
}
