'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Heart, Loader2, ScanLine, Share2, ShoppingBag } from 'lucide-react';
import {
  addFabricToSelection,
  formatSelectionMessage,
  readFabricSelection,
  type PublicFabric,
} from '@/lib/fabric-selection';
import PublicQrScanner from './public-qr-scanner';

interface PublicFabricViewerProps {
  qrCodeId: string;
}

export default function PublicFabricViewer({ qrCodeId }: PublicFabricViewerProps) {
  const [fabric, setFabric] = useState<PublicFabric | null>(null);
  const [selectionCount, setSelectionCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [copied, setCopied] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  useEffect(() => {
    const loadFabric = async () => {
      setLoading(true);
      setErrorText('');

      try {
        const response = await fetch(`/api/public/fabrics/${encodeURIComponent(qrCodeId)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Fabric not found.');
        }

        setFabric(payload.data);
      } catch (err: any) {
        setErrorText(err.message || 'Could not load this fabric.');
      } finally {
        setLoading(false);
      }
    };

    loadFabric();
  }, [qrCodeId]);

  useEffect(() => {
    const syncSelection = () => {
      const items = readFabricSelection();
      setSelectionCount(items.length);
      setIsSaved(items.some((item) => item.qr_code_id === qrCodeId.toUpperCase()));
    };

    syncSelection();
    window.addEventListener('fabric-selection-updated', syncSelection);
    window.addEventListener('storage', syncSelection);

    return () => {
      window.removeEventListener('fabric-selection-updated', syncSelection);
      window.removeEventListener('storage', syncSelection);
    };
  }, [qrCodeId]);

  const message = useMemo(() => {
    if (!fabric) return '';
    const current = readFabricSelection();
    const withCurrent = current.some((item) => item.qr_code_id === fabric.qr_code_id)
      ? current
      : [fabric, ...current];
    return formatSelectionMessage(withCurrent);
  }, [fabric]);

  const handleSave = () => {
    if (!fabric) return;
    const next = addFabricToSelection(fabric);
    setSelectionCount(next.length);
    setIsSaved(true);
  };

  const handleShare = async () => {
    if (!fabric) return;
    const shareData = {
      title: fabric.name || fabric.qr_code_id,
      text: message,
      url: fabric.links.public_viewer_url,
    };

    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F4EF] text-slate-950 flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
          <p className="text-sm font-bold">Loading fabric...</p>
        </div>
      </main>
    );
  }

  if (errorText || !fabric) {
    return (
      <main className="min-h-screen bg-[#F7F4EF] text-slate-950 flex items-center justify-center px-6">
        <div className="max-w-sm rounded-[2rem] bg-white border border-black/5 shadow-xl p-7 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-500">Not found</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight">Fabric unavailable</h1>
          <p className="mt-2 text-sm text-slate-500 font-medium">{errorText || 'This fabric could not be loaded.'}</p>
          <Link href="/public/selection" className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
            Open selection
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-slate-950 selection:bg-slate-950 selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between bg-[#F7F4EF]/90 px-5 py-4 backdrop-blur-xl">
          <Link href="/public/selection" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm border border-black/5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Showroom Scan</p>
            <p className="text-xs font-black text-slate-700">{selectionCount} saved</p>
          </div>
          <Link href="/public/selection" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm">
            <ShoppingBag className="h-4 w-4" />
            {selectionCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-emerald-400 px-1 text-[10px] font-black text-slate-950">
                {selectionCount}
              </span>
            )}
          </Link>
        </header>

        <section className="px-4 pb-28">
          <div className="overflow-hidden rounded-[2.25rem] bg-white shadow-2xl shadow-slate-950/10 border border-black/5">
            <div className="relative aspect-[4/4.5] bg-slate-100">
              <img src={fabric.assets.image_url} alt={fabric.name || 'Fabric sample'} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-5">
                <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-800 backdrop-blur">
                  {fabric.qr_code_id}
                </span>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                  {fabric.team.name || 'Fabric collection'}
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
                  {fabric.name || 'Unnamed fabric'}
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl bg-[#F7F4EF] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Lobby</p>
                  <p className="mt-1 truncate text-sm font-black">{fabric.session.code || 'Showroom'}</p>
                </div>
                <div className="rounded-3xl bg-[#F7F4EF] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-black capitalize text-emerald-700">{fabric.status}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Reference</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <code className="truncate text-sm font-black text-slate-800">{fabric.qr_code_id}</code>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(fabric.qr_code_id);
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4">
          <div className="rounded-[1.75rem] border border-black/5 bg-white/95 p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleSave}
                className={`inline-flex flex-col items-center justify-center rounded-2xl px-3 py-3 text-[11px] font-black transition-all ${
                  isSaved ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-950 text-white'
                }`}
              >
                {isSaved ? <Check className="mb-1 h-4 w-4" /> : <Heart className="mb-1 h-4 w-4" />}
                {isSaved ? 'Saved' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex flex-col items-center justify-center rounded-2xl bg-[#F7F4EF] px-3 py-3 text-[11px] font-black text-slate-800"
              >
                <ScanLine className="mb-1 h-4 w-4" />
                Scan more
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="inline-flex flex-col items-center justify-center rounded-2xl bg-[#F7F4EF] px-3 py-3 text-[11px] font-black text-slate-800"
              >
                <Share2 className="mb-1 h-4 w-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
      <PublicQrScanner isOpen={scannerOpen} onClose={() => setScannerOpen(false)} />
    </main>
  );
}
