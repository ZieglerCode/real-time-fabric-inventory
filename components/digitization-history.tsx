'use client';

import React from 'react';
import { ClipboardCheck, Search } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

interface DigitizationHistoryProps {
  completedFabrics: Fabric[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function DigitizationHistory({
  completedFabrics,
  searchQuery,
  setSearchQuery
}: DigitizationHistoryProps) {
  const filteredCompletedFabrics = completedFabrics.filter(fabric => {
    const nameMatch = fabric.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const codeMatch = fabric.qr_code_id?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return nameMatch || codeMatch;
  });

  return (
    <div className="border-t border-slate-200 bg-white p-6 shrink-0 mt-auto shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-indigo-650" />
          <h4 className="text-xs uppercase tracking-widest font-bold text-slate-550">Digitization Log</h4>
        </div>
        
        {/* Search Box */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
            <Search className="h-3.5 w-3.5" />
          </div>
          <input
            type="text"
            placeholder="Search labeled fabrics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs text-slate-900 font-medium"
          />
        </div>
      </div>

      {filteredCompletedFabrics.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs text-slate-400 font-semibold">
            {searchQuery ? 'No match found for search query.' : 'No items archived in this session.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCompletedFabrics.slice(0, 6).map((item) => (
            <div key={item.id} className="bg-slate-50/60 border border-slate-200/80 p-3 rounded-xl flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100 shrink-0 border border-slate-200">
                <img src={item.image_url} alt="Historic log preview" className="object-cover h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                <p className="text-[9px] font-mono text-slate-400 tracking-wider truncate mt-0.5">{item.qr_code_id}</p>
                {item.tagged_by_email && (
                  <p className="text-[8px] text-slate-450 truncate font-bold mt-0.5">By: {item.tagged_by_email}</p>
                )}
              </div>
              <div className="bg-white p-0.5 rounded-md shrink-0 border border-slate-200">
                <QRCodeSVG value={item.qr_code_id || ''} size={28} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
