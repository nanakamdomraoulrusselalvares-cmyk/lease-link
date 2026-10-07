"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LandlordProfile, AVAILABLE_PLANS, SubscriptionPlanId } from "@/types/database";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  LogOut,
  Phone,
  Mail,
  User as UserIcon,
  RefreshCw,
  AlertTriangle,
  Users,
  Home,
  Receipt,
  Wrench,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Database,
  KeyRound,
} from "lucide-react";

export default function LandlordHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load authenticated user and profile
  const fetchSessionAndProfile = async () => {
    const supabase = createClient();

    // Check if credentials are placeholder
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!url || url.includes("your-project-ref")) {
      setIsConfigured(false);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      // Fetch landlord profile from database
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (!profileError && profileData) {
        setProfile(profileData as LandlordProfile);
      }
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSessionAndProfile();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Error signing out:", err);
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchSessionAndProfile();
  };

  // Derive display values from profile or fallback to user metadata
  const fullName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string) ||
    "New Landlord";

  const email = user?.email || profile?.email || "No email";
  const phone =
    profile?.phone ||
    (user?.user_metadata?.phone as string) ||
    "Not provided";

  const rawPlan = (profile?.plan ||
    user?.user_metadata?.plan ||
    "free") as SubscriptionPlanId;

  const planConfig =
    AVAILABLE_PLANS.find((p) => p.id === rawPlan) || AVAILABLE_PLANS[0];

  const planName = profile?.plan_name || planConfig.name;
  const unitLimit = profile?.plan_unit_limit || planConfig.maxUnits;
  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Just now";

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-400">Verifying landlord session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white">
                Lease<span className="text-blue-500">Link</span>
              </span>
            </Link>
            <span className="hidden sm:inline-block text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              Registration Test Mode
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* User Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300 font-medium truncate max-w-[180px]">
                {email}
              </span>
            </div>

            {/* Logout Button */}
            <button
              id="logout-nav-btn"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
            >
              <LogOut className={`w-3.5 h-3.5 ${loggingOut ? "animate-spin" : ""}`} />
              <span>{loggingOut ? "Signing Out..." : "Sign Out"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!isConfigured && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-base text-amber-300">
              <AlertTriangle className="w-5 h-5" />
              <span>Supabase Not Connected in .env.local</span>
            </div>
            <p className="text-sm text-slate-300">
              Please provide your real Supabase URL and anon key in <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300">.env.local</code> to store records permanently.
            </p>
          </div>
        )}

        {/* Welcome & Registration Test Success Banner */}
        <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
            <Sparkles className="w-48 h-48 text-blue-400" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Registration Successful & Session Verified</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                Welcome to LeaseLink, {fullName}!
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                Your landlord account was created successfully. You are now logged into the LeaseLink landlord portal. Below are the details captured during registration.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-blue-400" : ""}`} />
                <span>{refreshing ? "Refreshing..." : "Refresh Session"}</span>
              </button>

              <button
                id="logout-banner-btn"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{loggingOut ? "Signing Out..." : "Log Out Now"}</span>
              </button>

              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium border border-slate-800 transition"
              >
                <span>View Public Homepage</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Registered Identity */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-blue-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Landlord Profile
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                <ShieldCheck className="w-3 h-3" />
                Authenticated
              </span>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Full Name</span>
                <span className="font-semibold text-white text-base">{fullName}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Email Address</span>
                <div className="flex items-center gap-2 text-slate-200">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="font-mono text-xs">{email}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Phone Number</span>
                <div className="flex items-center gap-2 text-slate-200">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{phone}</span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block mb-0.5">Registered On</span>
                <div className="flex items-center gap-2 text-slate-300 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{joinedDate}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500">
              <span className="block mb-1">User ID (Supabase Auth UID):</span>
              <span className="font-mono text-slate-400 block truncate bg-slate-950 p-2 rounded-lg border border-slate-800">
                {user?.id || "N/A"}
              </span>
            </div>
          </div>

          {/* Card 2: Subscription & Unit Capacity */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Subscription Tier
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {profile?.plan_status || "Active"}
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-extrabold text-white">{planName}</h3>
              <p className="text-xs text-slate-400 mt-1">{planConfig.tagline}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Home className="w-3.5 h-3.5 text-blue-400" />
                  <span>Unit Capacity</span>
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  {unitLimit} Units
                </div>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Duration</span>
                </div>
                <div className="mt-1 text-lg font-bold text-white">30 Days</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-300 space-y-1">
              <span className="font-semibold text-blue-300 block">Plan Allowance:</span>
              <p className="text-slate-400 leading-relaxed">
                This tier grants full access to create up to {unitLimit} units across unlimited buildings with real-time rent collections and tenant ledgers.
              </p>
            </div>
          </div>

          {/* Card 3: Registration Test Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Registration Diagnostics
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Supabase Auth Record</span>
                  <span className="text-slate-400">User created in auth.users with secure password hash.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">User Metadata Saved</span>
                  <span className="text-slate-400">Name, phone, and plan stored in raw_user_meta_data.</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Database className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">Public Profile Record</span>
                  <span className="text-slate-400">
                    {profile
                      ? "Profile table row loaded successfully."
                      : "Pending SQL trigger execution (metadata fallback active)."}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                id="logout-test-btn"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Test Logout & Return to Login</span>
              </button>
            </div>
          </div>
        </div>

        {/* Operational Modules Preview */}
        <div className="space-y-4 pt-4">
          <div>
            <h2 className="text-lg font-bold text-white">Next Step: Operational Modules</h2>
            <p className="text-xs text-slate-400">
              The registration flow is confirmed working. These modules will manage your buildings and tenant ledgers.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-2.5">
                <Building2 className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-xs">Buildings</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Properties index</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-2.5">
                <Home className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-xs">Units</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Apartment listings</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-xs">Tenants</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Lease & contacts</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="w-9 h-9 rounded-lg bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5">
                <Receipt className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-xs">Payments</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Rent collection logs</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2 sm:col-span-1">
              <div className="w-9 h-9 rounded-lg bg-rose-600/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-2.5">
                <Wrench className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-white text-xs">Tickets</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Maintenance issues</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
