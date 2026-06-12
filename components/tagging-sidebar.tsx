'use client';

import React from 'react';
import { Clock } from 'lucide-react';

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

interface TaggingSidebarProps {
  fabrics: Fabric[];
  activeFabric: Fabric | null;
  setActiveFabric: (fabric: Fabric | null) => void;
  connectionStatus: string;
  testTriggerMockCapture: () => void;
  cleanDemoDatabase: () => void;
}

export default function TaggingSidebar({
  fabrics,
  activeFabric,
  setActiveFabric,
  connectionStatus,
  testTriggerMockCapture,
  cleanDemoDatabase
}: TaggingSidebarProps) {
  return (
    <div className="w-full lg:w-[350px] border-r border-slate-200 flex flex-col bg-white shrink-0">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase">
            {fabrics.length} Waiting
          </div>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Fabric Photos</h2>
        </div>
        {connectionStatus === 'local' && (
          <button 
            type="button"
            onClick={testTriggerMockCapture}
            className="text-[10px] inline-flex items-center gap-1 text-indigo-650 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded-lg font-bold shadow-xs transition-all cursor-pointer"
          >
            + Mock Upload
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {fabrics.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto border border-slate-100">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-700 font-bold">Queue is empty</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Waiting for photographer to upload fabric photos...
              </p>
            </div>
          </div>
        ) : (
          fabrics.map((item, index) => (
            <div 
              key={item.id}
              onClick={() => setActiveFabric(item)}
              className={`flex gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                activeFabric?.id === item.id 
                  ? 'bg-indigo-50/60 border-indigo-200 shadow-xs' 
                  : 'bg-white border-slate-100 hover:bg-slate-50/30 hover:border-slate-200'
              }`}
            >
              {/* Thumbnail */}
              <div className="h-14 w-14 rounded-lg overflow-hidden bg-slate-50 border border-slate-200 flex-shrink-0 relative">
                <img 
                  src={item.image_url} 
                  alt="Fabric preview thumbnail" 
                  className="object-cover h-full w-full"
                />
                <div className="absolute bottom-0 right-0 bg-slate-900/60 text-[9px] px-1 rounded-tl text-white font-medium">
                  #{index + 1}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <span className="text-[10px] text-slate-400 font-semibold truncate block">
                  ID: {item.id.slice(0, 8)}...
                </span>
                <span className="text-[11px] text-slate-600 font-semibold block truncate">
                  Photo review pending
                </span>
                <span className="text-[9px] text-indigo-650 block font-bold">
                  {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-slate-50/50 border-t border-slate-200 flex justify-between items-center shrink-0">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fabric Catalog Tool</span>
        {connectionStatus === 'local' && (
          <button 
            type="button"
            onClick={cleanDemoDatabase}
            className="text-[10px] text-rose-650 hover:text-rose-700 font-bold cursor-pointer"
          >
            Reset sandbox queue
          </button>
        )}
      </div>
    </div>
  );
}
