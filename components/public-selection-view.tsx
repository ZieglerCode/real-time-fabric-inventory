'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Mail, ScanLine, Send, Share2, Trash2 } from 'lucide-react';
import {
  clearFabricSelection,
  formatSelectionMessage,
  readFabricSelection,
  removeFabricFromSelection,
  type PublicFabric,
} from '@/lib/fabric-selection';

export default function PublicSelectionView() {
  const [items, setItems] = useState<PublicFabric[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const syncSelection = () => setItems(readFabricSelection());

    syncSelection();
    window.addEventListener('fabric-selection-updated', syncSelection);
    window.addEventListener('storage', syncSelection);

    return () => {
      window.removeEventListener('fabric-selection-updated', syncSelection);
      window.removeEventListener('storage', syncSelection);
    };
  }, []);

  const message = useMemo(() => formatSelectionMessage(items), [items]);
  const encodedMessage = encodeURIComponent(message);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'Meine Stoffauswahl',
        text: message,
      });
      return;
    }

    await handleCopy();
  };

  const handleClear = () => {
    if (!confirm('Auswahl wirklich leeren?')) return;
    clearFabricSelection();
    setItems([]);
  };

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-slate-950 selection:bg-slate-950 selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-28">
        <header className="sticky top-0 z-20 -mx-4 bg-[#F7F4EF]/90 px-5 py-5 backdrop-blur-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Showroom Selection</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Meine Auswahl</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">
                {items.length === 0
                  ? 'Noch keine Stoffe gespeichert.'
                  : `${items.length} ${items.length === 1 ? 'Stoff' : 'Stoffe'} gespeichert`}
              </p>
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm border border-black/5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {items.length === 0 ? (
          <section className="flex flex-1 items-center justify-center">
            <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-slate-950/10 border border-black/5">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-950 text-white">
                <ScanLine className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight">Scan your first fabric</h2>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                Open your phone camera and scan a fabric QR code in the showroom.
              </p>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            {items.map((item) => (
              <article key={item.qr_code_id} className="overflow-hidden rounded-[1.75rem] bg-white shadow-sm border border-black/5">
                <Link href={`/public/fabrics/${encodeURIComponent(item.qr_code_id)}`} className="flex gap-3 p-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-slate-100">
                    <img src={item.assets.image_url} alt={item.name || 'Fabric sample'} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{item.qr_code_id}</p>
                    <h2 className="mt-1 truncate text-lg font-black">{item.name || 'Unnamed fabric'}</h2>
                    <p className="mt-1 truncate text-xs font-bold text-slate-500">{item.team.name || 'Fabric collection'}</p>
                    <p className="mt-3 text-xs font-black text-emerald-700">Saved for request</p>
                  </div>
                </Link>
                <div className="border-t border-slate-100 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = removeFabricFromSelection(item.qr_code_id);
                      setItems(next);
                    }}
                    className="text-xs font-black text-slate-400"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md p-4">
          <div className="rounded-[1.75rem] border border-black/5 bg-white/95 p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-xl">
            {items.length === 0 ? (
              <button
                type="button"
                onClick={() => alert('Open your phone camera and scan a fabric QR code.')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-black text-white"
              >
                <ScanLine className="h-4 w-4" />
                Scan fabric QR
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => alert('Open your phone camera and scan the next fabric QR code.')}
                  className="inline-flex flex-col items-center justify-center rounded-2xl bg-[#F7F4EF] px-2 py-3 text-[10px] font-black text-slate-800"
                >
                  <ScanLine className="mb-1 h-4 w-4" />
                  Scan
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex flex-col items-center justify-center rounded-2xl bg-[#F7F4EF] px-2 py-3 text-[10px] font-black text-slate-800"
                >
                  {copied ? <Check className="mb-1 h-4 w-4" /> : <Copy className="mb-1 h-4 w-4" />}
                  Copy
                </button>
                <a
                  href={`mailto:?subject=${encodeURIComponent('Meine Stoffauswahl')}&body=${encodedMessage}`}
                  className="inline-flex flex-col items-center justify-center rounded-2xl bg-[#F7F4EF] px-2 py-3 text-[10px] font-black text-slate-800"
                >
                  <Mail className="mb-1 h-4 w-4" />
                  E-Mail
                </a>
                <a
                  href={`https://wa.me/?text=${encodedMessage}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-col items-center justify-center rounded-2xl bg-slate-950 px-2 py-3 text-[10px] font-black text-white"
                >
                  <Send className="mb-1 h-4 w-4" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={handleShare}
                  className="col-span-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950"
                >
                  <Share2 className="h-4 w-4" />
                  Auswahl teilen
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
