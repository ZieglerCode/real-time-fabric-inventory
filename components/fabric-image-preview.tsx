'use client';

import React from 'react';

interface Fabric {
  id: string;
  image_url: string;
  name: string | null;
  qr_code_id: string | null;
  status: 'pending' | 'completed' | 'discarded';
  rejection_reason?: string | null;
  discarded_at?: string | null;
  created_at: string;
  created_by_email?: string | null;
  tagged_by_email?: string | null;
  session_id?: string | null;
}

interface FabricImagePreviewProps {
  activeFabric: Fabric;
  totalPending: number;
}

export default function FabricImagePreview({
  activeFabric,
  totalPending
}: FabricImagePreviewProps) {
  return (
    <div className="md:col-span-6 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm block space-y-4">
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5 text-indigo-700 font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" /> Fabric Snapshot
        </span>
        <span className="font-mono">Reference: {activeFabric.id.substring(0, 8)}...</span>
      </div>
      
      {/* Large Photo Preview */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square relative">
        <img 
          src={activeFabric.image_url} 
          alt="Incoming Fabric preview" 
          className="object-contain h-full w-full"
        />
        <div className="absolute top-2.5 right-2.5 bg-slate-900/70 text-[10px] px-2.5 py-1 rounded-lg text-white font-semibold">
          1 of {totalPending} pending
        </div>
      </div>

      {/* Audit Attribution */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/50 text-[11px] text-slate-500 space-y-1.5">
        <p className="flex justify-between">
          <span>Captured At:</span> 
          <span className="text-slate-800 font-medium">
            {new Date(activeFabric.created_at).toLocaleString()}
          </span>
        </p>
        <p className="flex justify-between">
          <span>Uploaded By:</span> 
          <span className="text-slate-800 font-semibold truncate max-w-[150px]">
            {activeFabric.created_by_email || 'Photographer'}
          </span>
        </p>
      </div>
    </div>
  );
}
