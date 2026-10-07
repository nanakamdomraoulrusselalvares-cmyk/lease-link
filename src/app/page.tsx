import Link from "next/link";
import {
  Building2,
  Home,
  Users,
  Receipt,
  Wrench,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  WifiOff,
  Sparkles,
} from "lucide-react";
import { AVAILABLE_PLANS } from "@/types/database";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">
              Lease<span className="text-blue-500">Link</span>
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 hidden sm:inline" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-slate-800/80">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Say Goodbye to Paper Property Ledgers</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Digital Property Management <br />
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              Built for Modern Landlords
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-400 leading-relaxed">
            Transition your buildings, units, and tenants to a real-time Progressive Web App.
            Log monthly rent payments, resolve tenant tickets, and access your portfolio from anywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition"
            >
              <span>Start 30-Day Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              <span>Landlord Sign In</span>
            </Link>
          </div>

          {/* Quick selling points */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>30-Day Free Trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-400" />
              <span>Mobile-First PWA</span>
            </div>
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-4 h-4 text-amber-400" />
              <span>Offline-Ready Design</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Row-Level Data Security</span>
            </div>
          </div>
        </div>
      </section>

      {/* Core Feature Pillars */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Everything a Landlord Needs in One Pocket
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            A cohesive suite to replace paper notebooks, lost receipts, and chaotic text messages.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Buildings & Units</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Track multiple buildings across locations. Define individual units, rent rates, and track occupancy status at a glance.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Receipt className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Rent Collection Ledger</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Log payments in real time. Know who has paid, who is pending, and keep an undeniable digital payment history for tax records.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-lg hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
              <Wrench className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Maintenance Tickets</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Receive and resolve repair tickets directly from tenants without messy phone call logs or missed repairs.
            </p>
          </div>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="py-16 bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              Subscription Tiers
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Flexible 30-Day Unit Capacity Plans
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              All plans are active for 30 days and can be renewed before expiration. Start free today.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {AVAILABLE_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between ${
                  plan.isFreeTrial
                    ? "border-amber-500/30"
                    : "border-slate-800 hover:border-blue-500/50"
                } transition shadow-xl`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-white">{plan.name}</h3>
                    {plan.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-2">
                    {plan.unitRange}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{plan.tagline}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>30-Day duration</span>
                  </div>
                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Renewable anytime</span>
                  </div>

                  <Link
                    href={`/register`}
                    className="mt-2 w-full block text-center py-2.5 rounded-xl bg-slate-800 hover:bg-blue-600 text-white font-semibold text-xs transition"
                  >
                    Select Plan
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 bg-slate-950 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" />
            <span className="font-semibold text-white">LeaseLink</span>
            <span>&copy; 2026 Modern Landlord SaaS.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-white transition">
              Landlord Login
            </Link>
            <Link href="/register" className="hover:text-white transition">
              Register Portfolio
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
