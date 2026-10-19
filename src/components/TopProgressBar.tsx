"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * TopProgressBar provides instantaneous visual confirmation when the user interacts
 * or navigates, ensuring the application never appears frozen or static.
 */
export default function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // When pathname or searchParams change, route navigation has completed
  useEffect(() => {
    setProgress(100);
    const timer = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Global listeners for instant clicks on links and custom loading events
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const handleStart = () => {
      setLoading(true);
      setProgress(15);
      clearInterval(interval);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            clearInterval(interval);
            return prev;
          }
          const jump = Math.max(2, Math.floor((85 - prev) * 0.15));
          return prev + jump;
        });
      }, 120);
    };

    const handleStop = () => {
      clearInterval(interval);
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 250);
    };

    // Capture internal link clicks immediately
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        !href.startsWith("//") &&
        target.target !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        // Only trigger if destination is different from current URL
        const currentUrl = window.location.pathname + window.location.search;
        if (href !== currentUrl) {
          handleStart();
        }
      }
    };

    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("leaselink:start_loading", handleStart);
    window.addEventListener("leaselink:stop_loading", handleStop);

    return () => {
      clearInterval(interval);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("leaselink:start_loading", handleStart);
      window.removeEventListener("leaselink:stop_loading", handleStop);
    };
  }, []);

  if (!loading && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-label="Chargement de page"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-1 bg-transparent overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-400 transition-all duration-200 ease-out shadow-[0_0_12px_rgba(59,130,246,0.8)]"
        style={{
          width: `${progress}%`,
          opacity: loading ? 1 : 0,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}
