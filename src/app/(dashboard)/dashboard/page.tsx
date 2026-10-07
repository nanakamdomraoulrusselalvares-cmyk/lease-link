"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LandlordProfile, AVAILABLE_PLANS, SubscriptionPlanId } from "@/types/database";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  LogOut,
  Phone,
  Mail,
  User,
  Radio,
  RefreshCw,
  AlertTriangle,
  Users,
  Home,
  Receipt,
  Wrench,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

export default function DashboardTestPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<LandlordProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<string>("CONNECTING");
  const [renewing, setRenewing] = useState(false);
  const [renewalPlan, setRenewalPlan] = useState<SubscriptionPlanId>("tier_1_30");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadUserAndProfile() {
      // Check if credentials are placeholders
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      if (!url || url.includes("your-project-ref")) {
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData as LandlordProfile);
      }

      setLoading(false);

      // Subscribe to Supabase Realtime updates on this landlord's profile
      channel = supabase
        .channel(`landlord-profile-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setProfile(payload.new as LandlordProfile);
              setActionMessage({
                type: "success",
                text: "Realtime update received from Supabase database!",
              });
            }
          }
        )
        .subscribe((status) => {
          setRealtimeStatus(status);
        });
    }

    loadUserAndProfile();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [router]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleRenewPlan = async () => {
    if (!profile) return;
    setRenewing(true);
    setActionMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("renew_subscription", {
        p_plan: renewalPlan,
      });

      if (error) {
        setActionMessage({ type: "error", text: error.message });
      } else if (data && !data.success) {
        setActionMessage({ type: "error", text: data.error });
      } else {
        setActionMessage({
          type: "success",
          text: data?.message || "Plan renewed successfully for 30 days!",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to renew plan";
      setActionMessage({ type: "error", text: message });
    } finally {
      setRenewing(false);
    }
  };

  // Calculate days remaining
  const calculateDaysRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-sm text-slate-400">Loading landlord profile and realtime session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg text-white">
                Lease<span className="text-blue-500">Link</span>
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                Landlord Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
              <Radio
                className={`w-3.5 h-3.5 ${
                  realtimeStatus === "SUBSCRIBED"
                    ? "text-emerald-400 animate-pulse"
                    : "text-amber-400"
                }`}
              />
              <span className="text-slate-300 hidden sm:inline">Realtime:</span>
              <span
                className={`font-semibold ${
                  realtimeStatus === "SUBSCRIBED"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }`}
              >
                {realtimeStatus === "SUBSCRIBED" ? "Connected" : realtimeStatus}
              </span>
            </div>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {!isConfigured && (
          <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-base text-amber-300">
              <AlertTriangle className="w-5 h-5" />
              <span>Action Required: Set Up Your Supabase Credentials</span>
            </div>
            <p className="text-sm text-slate-300">
              Your <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300">.env.local</code> currently has placeholder values.
              Please add your project URL and public anon key from your Supabase Dashboard, then execute the SQL schema in your Supabase SQL editor.
            </p>
          </div>
        )}

        {/* Action feedback */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl text-sm flex items-center gap-3 border ${
              actionMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Landlord Identity & Active Plan Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Landlord Profile
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">
                  {profile?.full_name || "Landlord Name"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Role: Landlord (Property Owner)</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800 text-sm">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="truncate">{profile?.email || "landlord@example.com"}</span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Phone className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{profile?.phone || "Not recorded"}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Account ID</span>
              <span className="font-mono text-slate-400">
                {profile?.id ? `${profile.id.slice(0, 8)}...` : "Demo Mode"}
              </span>
            </div>
          </div>

          {/* Active Subscription Plan */}
          <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-5">
              <Sparkles className="w-48 h-48 text-blue-400" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Active 30-Day Subscription
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {profile?.plan_status || "Active"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-baseline gap-3">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
                  {profile?.plan_name || "Free Trial (30 Days)"}
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md">
                  Capacity: {profile?.plan_unit_limit || 5} Units
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-400">
                {profile?.plan === "free"
                  ? "You are currently running the 30-day Free Trial. Note: Free trials can only be claimed once."
                  : `Your plan covers active management for up to ${profile?.plan_unit_limit || 30} housing units.`}
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Time Left</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">
                    {profile?.plan_expires_at
                      ? `${calculateDaysRemaining(profile.plan_expires_at)} Days`
                      : "30 Days"}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>Expires On</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-200">
                    {profile?.plan_expires_at
                      ? new Date(profile.plan_expires_at).toLocaleDateString()
                      : "30 Days from start"}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Free Trial Used?</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-200">
                    {profile?.has_used_free_trial ? "Yes (1-time used)" : "No"}
                  </div>
                </div>
              </div>
            </div>

            {/* Test Plan Renewal Control */}
            <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-300 font-medium">Renew / Upgrade Plan:</label>
                <select
                  value={renewalPlan}
                  onChange={(e) => setRenewalPlan(e.target.value as SubscriptionPlanId)}
                  className="bg-slate-950 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="tier_1_30">Starter (1-30 units, 30 days)</option>
                  <option value="tier_31_60">Growth (31-60 units, 30 days)</option>
                  <option value="tier_61_100">Pro (61-100 units, 30 days)</option>
                  <option value="free" disabled={profile?.has_used_free_trial}>
                    Free Trial (Blocked if already used)
                  </option>
                </select>
              </div>

              <button
                onClick={handleRenewPlan}
                disabled={renewing}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${renewing ? "animate-spin" : ""}`} />
                <span>{renewing ? "Renewing..." : "Test 30-Day Renewal"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Operational Modules Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white">LeaseLink Core Modules</h3>
              <p className="text-xs text-slate-400">
                These operational modules will be populated in our upcoming steps.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-sm">Buildings</h4>
              <p className="text-xs text-slate-400 mt-1">Multi-building management & address indexing</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                <Home className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-sm">Units</h4>
              <p className="text-xs text-slate-400 mt-1">Apartments, rent values, and vacancy status</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-sm">Tenants</h4>
              <p className="text-xs text-slate-400 mt-1">Tenant profiles, lease terms & emergency contacts</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <Receipt className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-sm">Payments</h4>
              <p className="text-xs text-slate-400 mt-1">Monthly rent ledgers, receipts & payment tracking</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition">
              <div className="w-10 h-10 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                <Wrench className="w-5 h-5" />
              </div>
              <h4 className="font-semibold text-white text-sm">Tickets</h4>
              <p className="text-xs text-slate-400 mt-1">Tenant maintenance requests and resolutions</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
