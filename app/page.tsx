'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Camera, Clipboard, Laptop, Database, CheckCircle2, AlertTriangle, Copy, ArrowRight, Layers } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function Home() {
  const [configured] = useState<boolean>(() => isSupabaseConfigured());
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const sqlCode = `-- 1. CREATE FABRICS TABLE
create table if not exists fabrics (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  name text,
  qr_code_id text,
  status text default 'pending', -- 'pending', 'completed', or 'discarded'
  rejection_reason text,
  discarded_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- 2. ENABLE REALTIME REPLICATION FOR THE FABRICS TABLE
alter publication supabase_realtime add table fabrics;

-- 3. ENABLE ROW LEVEL SECURITY & PERMIT PUBLIC ACCESS FOR SPEEDY SETUP
alter table fabrics enable row level security;

create policy "Allow all public operations for fabrics"
  on fabrics for all
  using (true)
  with check (true);

-- 4. INSERT STORAGE BUCKETS AND CONFIGURE POLICIES
insert into storage.buckets (id, name, public)
values ('fabric-images', 'fabric-images', true)
on conflict (id) do nothing;

create policy "Allow public uploads onto fabric-images"
  on storage.objects for insert
  with check (bucket_id = 'fabric-images');

create policy "Allow public read access of fabric-images"
  on storage.objects for select
  using (bucket_id = 'fabric-images');`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-500 selection:text-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-250/80 pb-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-5 w-5 text-indigo-650" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-205/50">
                ThreadScan Ops Hub
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-sans font-bold tracking-tight text-slate-800">
              Real-time Fabric <span className="text-indigo-650">Digitizer</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl font-sans">
              Designed for capturing 5,000+ fabric samples in physical inventory using instant photographer-to-tagger workspace matching.
            </p>
          </div>

          {/* Connection Status Indicator */}
          <div className="mt-6 md:mt-0">
            {configured ? (
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-100/80 text-emerald-800 text-xs font-semibold uppercase">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>Supabase Connection Active</span>
              </div>
            ) : (
              <div className="inline-flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-sans max-w-sm">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Supabase Keys Not Configured</p>
                  <p className="text-amber-700 mt-1">
                    Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Secrets panel or .env file.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Roles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Card 1: Photographer (Mobile) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-200/40 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <Camera className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded border border-indigo-205/50 font-bold">
                  Role 1
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">
                The Photographer (Mobile Capture)
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Optimized for fast-paced smartphone operation. Snaps high-fidelity pictures of physical fabric samples. Automatically uploads to bucket storage and broadcasts changes instantly.
              </p>
              <div className="flex items-center text-xs text-slate-600 font-mono space-y-1.5 flex-col items-start mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200/60 w-full">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Standard System Camera trigger</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Fast auto-reset bucket pipeline</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> Visual upload progress indicators</span>
              </div>
              <Link
                href="/capture"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 cursor-pointer group-hover:gap-3"
              >
                Open Camera Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Tagger (Desktop Dashboard) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-xl bg-violet-50 border border-violet-200/40 flex items-center justify-center text-violet-600 group-hover:scale-105 transition-transform">
                  <Laptop className="h-6 w-6" />
                </div>
                <span className="text-xs font-mono text-violet-600 uppercase tracking-widest bg-violet-50 px-2.5 py-1 rounded border border-violet-205/50 font-bold">
                  Role 2
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">
                The Tagger (Desktop Workspace)
              </h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                The moment a photo is captured on the phone, the desk display refreshes automatically without requiring manual navigation. Tag fabric styles, produce live QR codes, and archive.
              </p>
              <div className="flex items-center text-xs text-slate-600 font-mono space-y-1.5 flex-col items-start mb-8 bg-slate-50 p-4 rounded-xl border border-slate-200/60 w-full">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Real-time PostgreSQL subscription</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Automatic client fields focus</span>
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> QR Generator (printable/copyable SVG)</span>
              </div>
              <Link
                href="/tagging"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-violet-100 cursor-pointer group-hover:gap-3"
              >
                Launch Tagger Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Database SQL Setup Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-12">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-indigo-600" />
              <h3 className="font-sans font-bold text-slate-850 text-base">
                Required Supabase DB Setup Code
              </h3>
            </div>
            <button
              onClick={() => handleCopy(sqlCode, 'sql')}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-mono px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200/50 transition-all font-semibold"
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedSection === 'sql' ? 'Copied Snippet!' : 'Copy SQL'}
            </button>
          </div>
          <div className="p-6">
            <p className="text-sm text-slate-500 mb-4 max-w-4xl leading-relaxed">
              Open your <strong>Supabase SQL Editor</strong> and run the commands below. This creates the active <code className="font-mono text-xs text-indigo-600 bg-slate-100 px-1.5 py-0.5 rounded">fabrics</code> list database table, enables real-time changes replication, sets default open policies, and initiates the <code className="font-mono text-xs text-indigo-600 bg-slate-100 px-1.5 py-0.5 rounded">fabric-images</code> storage container.
            </p>
            <div className="relative">
              <pre className="text-xs leading-relaxed max-height-[320px] overflow-y-auto font-mono text-indigo-900 bg-[#F1F5F9] p-5 rounded-xl border border-slate-200/80 select-all block whitespace-pre">
                {sqlCode}
              </pre>
            </div>
          </div>
        </div>

        {/* Informative Stats or Guidelines */}
        <div className="border-t border-slate-200 pt-8 text-center text-xs text-slate-400 font-mono">
          <p>Dual Workspace Environment • Next.js Realtime Hydration • Supports Mobile Chrome, iOS Safari & Standard Desktop Browsers</p>
        </div>
      </div>
    </main>
  );
}
