'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Camera, Laptop, LogOut, User, Layers, History, QrCode, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

interface Fabric {
  id: string;
  name: string | null;
  qr_code_id: string | null;
  status: 'pending' | 'completed' | 'discarded';
  created_at: string;
}

export default function DashboardPage() {
  const { user, loading, signOut, isConfigured } = useAuth();
  const [recentActivity, setRecentActivity] = useState<Fabric[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Fetch recent fabrics for dashboard preview
  const fetchRecentActivity = async () => {
    if (!isConfigured) {
      // Offline fallback: load from localStorage
      const queue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
      const processed = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]');
      const all = [...queue, ...processed]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      setRecentActivity(all);
      return;
    }

    if (!user) return;

    setActivityLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabrics')
        .select('id, name, qr_code_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentActivity(data || []);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchRecentActivity();
    }
  }, [loading, user]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-4 border-indigo-200 border-t-indigo-650 rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-500">Checking credentials...</span>
        </div>
      </div>
    );
  }

  // If configured but not logged in, we let useAuth redirect to /login. In the meantime, show loading.
  if (isConfigured && !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Redirecting to login...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-30 pointer-events-none -mr-40 -mt-40" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-30 pointer-events-none -ml-40 -mb-40" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Navigation / Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-5 w-5 text-indigo-650" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                Fabric Inventory Center
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Inventory Digitization
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              An instant collaboration portal for photographers and labeling operators to catalog fabric physical samples.
            </p>
          </div>

          {/* User Profile / Status */}
          <div className="mt-6 md:mt-0 flex items-center gap-4 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 truncate max-w-[160px]">
                  {user ? user.email : 'Sandbox Mode'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {isConfigured ? 'Authenticated' : 'Offline Mode'}
                </p>
              </div>
            </div>
            {isConfigured && (
              <button
                onClick={signOut}
                className="h-9 w-9 rounded-xl border border-slate-200 hover:border-rose-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Photographer Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col justify-between">
            <div className="p-8 flex-1">
              <div className="flex items-center justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 group-hover:scale-105 transition-transform">
                  <Camera className="h-7 w-7" />
                </div>
                <span className="text-xs font-semibold text-indigo-650 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
                  Mobile Scan
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Fabric Photo Uploads
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Optimized for mobile use. Point your smartphone camera at physical fabrics to capture samples and automatically queue them for labeling.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Use your phone's built-in camera</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Real-time photo previews and uploads</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Instant alerts for requested retakes</span>
                </li>
              </ul>
            </div>
            <div className="p-8 pt-0">
              <Link
                href="/capture"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-150 cursor-pointer group-hover:gap-3 border-b-2 border-indigo-805"
              >
                Open Camera Workspace
                <Camera className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Tagger Card */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col justify-between">
            <div className="p-8 flex-1">
              <div className="flex items-center justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-650 group-hover:scale-105 transition-transform">
                  <Laptop className="h-7 w-7" />
                </div>
                <span className="text-xs font-semibold text-violet-650 bg-violet-50 px-3 py-1 rounded-full border border-violet-100 uppercase tracking-wider">
                  Desktop Desk
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                Labeling & Barcodes
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Optimized for desktop operations. Review newly captured fabric photos, assign names/labels, and instantly print barcode stickers for physical tracking.
              </p>
              <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Automatic refresh as new photos arrive</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Fast keyboard focus for indexing names</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Generate printable sticker labels</span>
                </li>
              </ul>
            </div>
            <div className="p-8 pt-0">
              <Link
                href="/tagging"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-violet-600 hover:bg-violet-550 text-white rounded-2xl font-bold transition-all shadow-lg shadow-violet-150 cursor-pointer group-hover:gap-3 border-b-2 border-violet-800"
              >
                Launch Labeling Desk
                <Laptop className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 border border-slate-200/40">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Recent Catalog Activity
                </h3>
                <p className="text-xs text-slate-400">Latest updates from the fabric digitization log</p>
              </div>
            </div>
            <button
              onClick={fetchRecentActivity}
              disabled={activityLoading}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-650 hover:text-indigo-805 font-semibold transition-all cursor-pointer py-1.5 px-3 bg-indigo-50 border border-indigo-100 rounded-lg"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${activityLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Log</span>
            </button>
          </div>

          {recentActivity.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No recent fabric transactions found. Get started by taking a photo!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="pb-3 pl-4">Label Reference</th>
                    <th className="pb-3">Name</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Logged At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {recentActivity.map((fabric) => (
                    <tr key={fabric.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 pl-4 font-mono text-xs text-slate-500">
                        {fabric.qr_code_id || (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-sans font-bold border border-amber-100 text-[10px]">
                            <QrCode className="h-3 w-3" /> Unlabeled
                          </span>
                        )}
                      </td>
                      <td className="py-4 font-medium text-slate-800">
                        {fabric.name || (
                          <span className="text-slate-400 italic">Waiting for tagging</span>
                        )}
                      </td>
                      <td className="py-4">
                        {fabric.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 text-[10px] uppercase">
                            Ready
                          </span>
                        )}
                        {fabric.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50/70 text-indigo-700 font-bold border border-indigo-100 text-[10px] uppercase animate-pulse">
                            Processing
                          </span>
                        )}
                        {fabric.status === 'discarded' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-100 text-[10px] uppercase">
                            Retake Requested
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-xs text-slate-400 font-mono">
                        {new Date(fabric.created_at).toLocaleDateString()} {new Date(fabric.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
