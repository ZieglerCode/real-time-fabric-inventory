'use client';

import React, { useEffect } from 'react';
import { Compass, X, ArrowLeft, Printer, Download } from 'lucide-react';
import ScannableCode from './scannable-code';
import { getPublicFabricViewerUrl } from '@/lib/fabric-public-url';

interface Fabric {
  id: string;
  image_url: string;
  name: string | null;
  qr_code_id: string | null;
  status: 'pending' | 'completed' | 'discarded';
  created_at: string;
  session_code?: string;
  team_name?: string;
  created_by_email?: string | null;
  tagged_by_email?: string | null;
}

interface GalleryOverlayProps {
  galleryActiveIndex: number;
  setGalleryActiveIndex: (index: number | null) => void;
  filteredFabrics: Fabric[];
  setActivePrintFabric?: (fabric: any) => void;
}

export default function GalleryOverlay({
  galleryActiveIndex,
  setGalleryActiveIndex,
  filteredFabrics,
  setActivePrintFabric,
}: GalleryOverlayProps) {
  const activeFabric = filteredFabrics[galleryActiveIndex];
  const hasPrev = filteredFabrics.length > 1;

  // Keyboard navigation for image gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setGalleryActiveIndex(
          galleryActiveIndex === 0 ? filteredFabrics.length - 1 : galleryActiveIndex - 1
        );
      } else if (e.key === 'ArrowRight') {
        setGalleryActiveIndex(
          galleryActiveIndex === filteredFabrics.length - 1 ? 0 : galleryActiveIndex + 1
        );
      } else if (e.key === 'Escape') {
        setGalleryActiveIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryActiveIndex, filteredFabrics, setGalleryActiveIndex]);

  if (!activeFabric) return null;

  // Download image file helper
  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-955/98 backdrop-blur-md z-50 flex flex-col justify-between p-4 sm:p-6 md:p-8 animate-in fade-in duration-200 print:hidden">
      {/* Gallery Top Navigation bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-indigo-650 rounded-xl flex items-center justify-center text-white">
            <Compass className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm">Catalog Image Gallery</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Fabric {galleryActiveIndex + 1} of {filteredFabrics.length}
            </p>
          </div>
        </div>
        <button
          onClick={() => setGalleryActiveIndex(null)}
          className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Gallery Core Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left pane: Image stage */}
        <div className="lg:col-span-8 bg-slate-900/50 border border-white/5 rounded-3xl flex items-center justify-center relative group select-none min-h-[300px] lg:min-h-0 overflow-hidden shadow-inner">
          {/* Arrow Left */}
          {hasPrev && (
            <button
              onClick={() =>
                setGalleryActiveIndex(
                  galleryActiveIndex === 0 ? filteredFabrics.length - 1 : galleryActiveIndex - 1
                )
              }
              className="absolute left-4 h-11 w-11 rounded-full bg-slate-950/60 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-950 transition-all z-10 cursor-pointer lg:opacity-0 lg:group-hover:opacity-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}

          {/* Main image */}
          <div className="max-h-full max-w-full p-4 flex items-center justify-center">
            <img
              src={activeFabric.image_url}
              alt={activeFabric.name || 'Fabric sample'}
              className="object-contain max-h-[50vh] lg:max-h-[65vh] max-w-full rounded-2xl shadow-xl transition-all duration-305"
            />
          </div>

          {/* Arrow Right */}
          {hasPrev && (
            <button
              onClick={() =>
                setGalleryActiveIndex(
                  galleryActiveIndex === filteredFabrics.length - 1 ? 0 : galleryActiveIndex + 1
                )
              }
              className="absolute right-4 h-11 w-11 rounded-full bg-slate-950/60 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-950 transition-all z-10 cursor-pointer lg:opacity-0 lg:group-hover:opacity-100"
            >
              <span className="transform rotate-180">
                <ArrowLeft className="h-5 w-5" />
              </span>
            </button>
          )}

          {/* Image overlay badge */}
          <div className="absolute bottom-4 left-4 bg-slate-955/80 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-md">
            <span className="text-[10px] font-bold text-slate-300 font-mono">
              ID: {activeFabric.id.slice(0, 8)}...
            </span>
          </div>
        </div>

        {/* Right pane: Metadata Details */}
        <div className="lg:col-span-4 bg-slate-900 border border-white/10 rounded-3xl p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {/* Title & Status */}
            <div>
              <span className="text-[10px] text-slate-450 uppercase tracking-widest font-extrabold">
                Digitized Fabric
              </span>
              <h2 className="text-xl font-extrabold text-white mt-1 break-words leading-tight">
                {activeFabric.name || <span className="text-slate-500 italic">Unlabeled / Pending</span>}
              </h2>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {activeFabric.status === 'completed' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded-md">
                    Completed Label
                  </span>
                )}
                {activeFabric.status === 'pending' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-amber-400 bg-amber-950/40 border border-amber-900/60 px-2 py-0.5 rounded-md">
                    Pending Review
                  </span>
                )}
                {activeFabric.status === 'discarded' && (
                  <span className="inline-flex items-center text-[10px] font-bold text-rose-400 bg-rose-950/40 border border-rose-900/60 px-2 py-0.5 rounded-md">
                    Discarded Sample
                  </span>
                )}
              </div>
            </div>

            {/* Metadata Specs Grid */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4.5 space-y-3.5">
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-400 font-bold">Lobby Code</span>
                <span className="text-white font-mono font-bold uppercase">
                  {activeFabric.session_code || 'SANDBOX'}
                </span>
              </div>
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-400 font-bold">Team Workspace</span>
                <span className="text-white font-semibold">
                  {activeFabric.team_name || 'Sandbox Team'}
                </span>
              </div>
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-400 font-bold">Captured By</span>
                <span className="text-white font-semibold">
                  📷 {activeFabric.created_by_email || 'Photographer'}
                </span>
              </div>
              {activeFabric.tagged_by_email && (
                <div className="flex items-start justify-between text-xs">
                  <span className="text-slate-400 font-bold">Labeled By</span>
                  <span className="text-white font-semibold">💻 {activeFabric.tagged_by_email}</span>
                </div>
              )}
              <div className="flex items-start justify-between text-xs">
                <span className="text-slate-400 font-bold">Logged At</span>
                <span className="text-white font-semibold">
                  {new Date(activeFabric.created_at).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Scannable Sticker Codes */}
            {activeFabric.qr_code_id ? (
              <div className="space-y-2.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold block">
                  Associated Sticker Code
                </span>
                <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center gap-4">
                  <div className="p-1 border border-slate-100 rounded-lg">
                    <ScannableCode value={getPublicFabricViewerUrl(activeFabric.qr_code_id)} type="qrcode" scale={1.4} />
                  </div>
                  <div className="scale-90 origin-center">
                    <ScannableCode
                      value={activeFabric.qr_code_id}
                      type="code128"
                      scale={1.2}
                      height={8}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950/30 border border-white/5 text-center">
                <span className="text-xs text-slate-500 font-medium font-sans">
                  Sticker barcodes not generated. Fabric is still in pending state.
                </span>
              </div>
            )}
          </div>

          {/* Actions shelf */}
          <div className="mt-8 pt-4 border-t border-white/10 flex flex-col gap-3">
            {setActivePrintFabric && activeFabric.status === 'completed' && activeFabric.qr_code_id ? (
              <button
                onClick={() => setActivePrintFabric(activeFabric)}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-905/35 border-b border-indigo-850 cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print sticker label</span>
              </button>
            ) : setActivePrintFabric ? (
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 text-slate-500 border border-slate-700 rounded-xl text-xs font-bold cursor-not-allowed"
              >
                <Printer className="h-4 w-4" />
                <span>Print sticker label</span>
              </button>
            ) : null}

            <button
              onClick={() =>
                downloadImage(
                  activeFabric.image_url,
                  `fabric_${activeFabric.id.slice(0, 8)}_${activeFabric.name || 'sample'}.jpg`
                )
              }
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>Download Image</span>
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail carousel strip at the bottom */}
      <div className="h-20 shrink-0 border-t border-white/10 pt-4 flex gap-3.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {filteredFabrics.map((fabric, idx) => (
          <button
            key={fabric.id}
            onClick={() => setGalleryActiveIndex(idx)}
            className={`h-12 w-12 rounded-xl overflow-hidden bg-slate-900 border shrink-0 relative transition-all ${
              idx === galleryActiveIndex
                ? 'border-indigo-500 scale-105 ring-2 ring-indigo-500/30'
                : 'border-white/10 hover:border-white/30 opacity-60 hover:opacity-100'
            }`}
          >
            <img src={fabric.image_url} alt="" className="object-cover h-full w-full" />
          </button>
        ))}
      </div>
    </div>
  );
}
