'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Laptop, CheckCircle2, AlertCircle, Copy, Loader2, Database, Zap, 
  Tag, Download, Printer, Layers, Clock, ArrowRight, ClipboardCheck,
  Search, ExternalLink, RefreshCw, Undo2, Ban
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

// Define the fabric schema
interface Fabric {
  id: string;
  image_url: string;
  name: string | null;
  qr_code_id: string | null;
  status: 'pending' | 'completed' | 'discarded';
  rejection_reason?: string | null;
  discarded_at?: string | null;
  created_at: string;
}

export default function TaggingPage() {
  // Use lazy functional initialization to read values once on construct, avoids useEffect setState cascades
  const [isConfigured] = useState<boolean>(() => isSupabaseConfigured());
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [completedFabrics, setCompletedFabrics] = useState<Fabric[]>([]);
  const [activeFabric, setActiveFabric] = useState<Fabric | null>(null);
  const [fabricName, setFabricName] = useState<string>('');
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  // States for operations - loading defaults to true if configured so no synchronous transitions are needed
  const [loading, setLoading] = useState<boolean>(() => isSupabaseConfigured());
  const [saving, setSaving] = useState<boolean>(false);
  const [savedQrData, setSavedQrData] = useState<{ id: string; name: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'local'>(() => 
    isSupabaseConfigured() ? 'connecting' : 'local'
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync / Load data from localStorage (For offline-sync demo mode)
  const loadLocalData = useCallback(() => {
    if (typeof window === 'undefined') return;
    const queue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
    const processed = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]');
    
    setFabrics(queue);
    setCompletedFabrics(processed);

    if (queue.length > 0) {
      setActiveFabric(queue[0]);
    } else {
      setActiveFabric(null);
    }
  }, []);

  // Fetch pending and completed fabrics from Live Supabase
  const fetchFabrics = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch pending rows sorted oldest-first for first-in-first-out tag pipeline 
      const { data: pendingData, error: pendingErr } = await supabase
        .from('fabrics')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (pendingErr) throw pendingErr;

      // 2. Fetch completed rows sorted newest-first for real-time history audits
      const { data: completedData, error: completedErr } = await supabase
        .from('fabrics')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      if (completedErr) throw completedErr;

      const pendingList = pendingData || [];
      setFabrics(pendingList);
      setCompletedFabrics(completedData || []);

      // If we don't have an active fabric yet, or the current active fabric is no longer in pending list
      if (pendingList.length > 0) {
        setActiveFabric(pendingList[0]);
      } else {
        setActiveFabric(null);
      }
    } catch (err) {
      console.error('Error fetching tables data:', err);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize and check credentials
  useEffect(() => {
    if (isConfigured) {
      // Defer state update to next event loop tick to bypass React 19's sync-setState in mounting effect rule
      const timer = setTimeout(() => {
        fetchFabrics();
      }, 0);

      // Realtime subscription mapping: Subscribe to inserts & updates
      const channel = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fabrics'
          },
          (payload) => {
            console.log('Real-time notification on database:', payload);
            fetchFabrics();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setTimeout(() => setConnectionStatus('connected'), 0);
          } else if (status === 'CHANNEL_ERROR') {
            setTimeout(() => setConnectionStatus('error'), 0);
          }
        });

      return () => {
        clearTimeout(timer);
        supabase.removeChannel(channel);
      };
    } else {
      const timer = setTimeout(() => {
        loadLocalData();
      }, 0);

      // Listen for captures in other local window tabs under storage
      const handleStorageUpdate = (e: StorageEvent) => {
        loadLocalData();
      };
      window.addEventListener('storage', handleStorageUpdate);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('storage', handleStorageUpdate);
      };
    }
  }, [isConfigured, fetchFabrics, loadLocalData]);

  // Autofocus input whenever active fabric changes
  useEffect(() => {
    if (activeFabric) {
      const timerDoc = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      
      const timerReset = setTimeout(() => {
        setIsDiscarding(false);
        setRejectionReason('');
      }, 0);

      return () => {
        clearTimeout(timerDoc);
        clearTimeout(timerReset);
      };
    }
    const timerState = setTimeout(() => {
      setFabricName('');
      setIsDiscarding(false);
      setRejectionReason('');
      setSavedQrData(null);
    }, 0);
    return () => clearTimeout(timerState);
  }, [activeFabric]);


  // Tag Fabric and generate code
  const handleSaveAndGenerateQR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFabric || !fabricName.trim()) return;

    setSaving(true);
    const fabricId = activeFabric.id;
    const generatedQrId = `FABRIC-${fabricId.substring(0, 8).toUpperCase()}`;

    try {
      if (isConfigured) {
        // --- REAL LIVE SUPABASE FLOW ---
        const { error } = await supabase
          .from('fabrics')
          .update({
            name: fabricName.trim(),
            qr_code_id: generatedQrId,
            status: 'completed'
          })
          .eq('id', fabricId);

        if (error) throw error;
        
        // Let state update organically from postgres publication listener or fetch:
        await fetchFabrics();
      } else {
        // --- OFFLINE / LOCAL SYNC FLOW ---
        const queue: Fabric[] = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        const processed: Fabric[] = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]');

        // Remove active item from queue
        const updatedQueue = queue.filter(item => item.id !== fabricId);
        
        // Add updated object to processed list
        const completedItem: Fabric = {
          ...activeFabric,
          name: fabricName.trim(),
          qr_code_id: generatedQrId,
          status: 'completed'
        };

        processed.unshift(completedItem);

        // Commit to browser storage
        localStorage.setItem('fabric_local_queue', JSON.stringify(updatedQueue));
        localStorage.setItem('fabric_local_completed', JSON.stringify(processed));

        // Sync local component state
        setFabrics(updatedQueue);
        setCompletedFabrics(processed);

        if (updatedQueue.length > 0) {
          setActiveFabric(updatedQueue[0]);
        } else {
          setActiveFabric(null);
        }

        // Trigger other browser views checking storage events
        window.dispatchEvent(new Event('storage'));
      }

      // Display the completed QR Code Card modal
      setSavedQrData({ id: generatedQrId, name: fabricName.trim() });
    } catch (err) {
      console.error(err);
      alert('Error updating row data: Ensure permissions are enabled in Postgres RLS.');
    } finally {
      setSaving(false);
    }
  };

  // Discard / Reject fabric sample with custom review feedback
  const handleDiscard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFabric) return;

    setSaving(true);
    const fabricId = activeFabric.id;
    const finalReason = rejectionReason.trim() || 'Poor aspect/illumination checked by operations tagger';

    try {
      if (isConfigured) {
        // --- REAL LIVE SUPABASE FLOW ---
        const { error } = await supabase
          .from('fabrics')
          .update({
            status: 'discarded',
            rejection_reason: finalReason,
            discarded_at: new Date().toISOString()
          })
          .eq('id', fabricId);

        if (error) throw error;
        
        await fetchFabrics();
      } else {
        // --- OFFLINE / LOCAL SYNC FLOW ---
        const queue: Fabric[] = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        
        // Remove item from active queue
        const updatedQueue = queue.filter(item => item.id !== fabricId);

        // Record the rejection to trigger storage updates in the mobile workspace tabs
        localStorage.setItem('fabric_local_queue', JSON.stringify(updatedQueue));
        localStorage.setItem('last_rejection', JSON.stringify({
          id: fabricId,
          reason: finalReason,
          timestamp: new Date().toISOString()
        }));

        setFabrics(updatedQueue);

        if (updatedQueue.length > 0) {
          setActiveFabric(updatedQueue[0]);
        } else {
          setActiveFabric(null);
        }

        window.dispatchEvent(new Event('storage'));
      }

      setIsDiscarding(false);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
      alert('Error discarding sample. Check permissions or network console.');
    } finally {
      setSaving(false);
    }
  };

  const cleanDemoDatabase = () => {
    if (confirm('Clear local demo storage and reset queues?')) {
      localStorage.removeItem('fabric_local_queue');
      localStorage.removeItem('fabric_local_completed');
      localStorage.removeItem('captured_today_count');
      loadLocalData();
    }
  };

  const testTriggerMockCapture = () => {
    const randomSeed = Math.floor(Math.random() * 1000);
    const mockRecord: Fabric = {
      id: `demo-uuid-${Date.now()}`,
      image_url: `https://picsum.photos/seed/${randomSeed}/800/600`,
      name: null,
      qr_code_id: null,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    const queue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
    queue.push(mockRecord);
    localStorage.setItem('fabric_local_queue', JSON.stringify(queue));
    
    // Update captured today tracker
    const curCount = parseInt(localStorage.getItem('captured_today_count') || '0', 10);
    localStorage.setItem('captured_today_count', (curCount + 1).toString());

    window.dispatchEvent(new Event('storage'));
    loadLocalData();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-indigo-500">
      {/* Top Professional Admin Bar */}
      <header className="px-6 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-indigo-55/70 border border-indigo-200/60 rounded-lg flex items-center justify-center text-indigo-600">
            <Laptop className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-md font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Tagger Operations Workspace
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-indigo-200/50">DESKTOP</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Inventory Digitization • Match physical fabric captures instantly</p>
          </div>
        </div>

        {/* Realtime PubSub indicator node */}
        <div className="flex items-center gap-3 self-end sm:self-auto text-xs font-mono">
          {connectionStatus === 'connected' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 uppercase font-bold text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime: Active</span>
            </div>
          )}
          {connectionStatus === 'connecting' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-500 uppercase font-bold text-[10px]">
              <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
              <span>Connecting...</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full text-rose-700 uppercase font-bold text-[10px]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Off-line. Retry</span>
            </div>
          )}
          {connectionStatus === 'local' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-700 uppercase font-bold text-[10px]">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Local Sync (No DB Keys)</span>
            </div>
          )}

          {isConfigured && (
            <button 
              onClick={fetchFabrics}
              className="p-1 px-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-350 bg-white shadow-xs rounded-lg transition-all"
              title="Manual refresh schemas"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Primary Split Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT COLUMN: Queue of pending captures */}
        <div className="w-full lg:w-[350px] border-r border-slate-200 flex flex-col bg-white shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-50/80 px-2 py-0.5 rounded-full border border-indigo-100 text-[10px] font-mono text-indigo-700 font-bold uppercase">{fabrics.length} Queue</div>
              <h2 className="text-xs font-mono font-bold tracking-wider text-slate-500 uppercase">Pending Camera Snaps</h2>
            </div>
            {connectionStatus === 'local' && (
              <button 
                onClick={testTriggerMockCapture}
                className="text-[10px] inline-flex items-center gap-1 text-indigo-650 hover:text-indigo-800 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded-lg font-bold shadow-xs transition-all"
              >
                + Inject Photo
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3 space-y-2.5">
            {fabrics.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mx-auto border border-slate-100">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-700 font-semibold font-sans">Queue is empty</p>
                  <p className="text-[11px] text-slate-400 font-sans mt-1 leading-relaxed">Waiting for the Photographer to upload fabric samples on mobile...</p>
                </div>
              </div>
            ) : (
              fabrics.map((item, index) => (
                <div 
                  key={item.id}
                  onClick={() => setActiveFabric(item)}
                  className={`flex gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    activeFabric?.id === item.id 
                      ? 'bg-indigo-50/70 border-indigo-200 shadow-xs' 
                      : 'bg-white border-slate-100 hover:bg-slate-50/50 hover:border-slate-200'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="h-14 w-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0 relative">
                    <img 
                      src={item.image_url} 
                      alt="Captured Fabric Thumbnail" 
                      className="object-cover h-full w-full"
                    />
                    <div className="absolute bottom-0 right-0 bg-slate-900/60 text-[9px] font-mono px-1 rounded-tl text-white font-medium">
                      #{index + 1}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <span className="text-[10px] font-mono text-slate-400 font-bold truncate block">ID: {item.id.slice(0, 8)}...</span>
                    <span className="text-[11px] text-slate-600 font-sans block truncate italic font-medium">Pending Tagger Input</span>
                    <span className="text-[9px] font-mono text-indigo-600 block font-bold">
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Setup helpful guide on status */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
            <span className="text-[11px] font-mono text-slate-400 font-bold">Dual Sync Environment</span>
            {connectionStatus === 'local' && (
              <button 
                onClick={cleanDemoDatabase}
                className="text-[10px] text-rose-600 hover:text-rose-700 font-mono font-bold flex items-center gap-1.5"
              >
                Clear Mock History
              </button>
            )}
          </div>
        </div>

        {/* CENTER / RIGHT AREA: Current fabric processing stage */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-y-auto">
          {activeFabric ? (
            <div className="flex-1 p-6 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* Image Preview Block: md:col-6 */}
              <div className="md:col-span-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm block space-y-4">
                <div className="flex justify-between items-center text-xs font-mono text-slate-500">
                  <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5 text-indigo-650 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" /> Photographed Sample
                  </span>
                  <span>ID: {activeFabric.id.substring(0, 8)}...</span>
                </div>
                
                {/* Large high resolution sample view */}
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square relative shadow-xs">
                  <img 
                    src={activeFabric.image_url} 
                    alt="Current pending fabric" 
                    className="object-contain h-full w-full"
                  />
                  <div className="absolute top-2.5 right-2.5 bg-slate-900/75 text-[10px] px-2.5 py-1 rounded-lg font-mono text-white font-semibold">
                    1 of {fabrics.length} waiting
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-[11px] text-slate-500 font-mono space-y-1.5">
                  <p className="flex justify-between"><span>UTC Timestamp:</span> <span className="text-slate-800 font-medium">{activeFabric.created_at}</span></p>
                  <p className="flex justify-between"><span>Temporary URL:</span> <span className="text-indigo-600 truncate max-w-[160px] font-semibold" title={activeFabric.image_url}>{activeFabric.image_url}</span></p>
                </div>
              </div>

              {/* Tag metadata edit console panel: md:col-6 */}
              <div className="md:col-span-6 space-y-6">
                               <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2 border-b border-slate-150 pb-4">
                    <Tag className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-sans font-bold text-slate-800 text-base">Assign Fabric Parameters</h3>
                  </div>

                  {!isDiscarding ? (
                    <form onSubmit={handleSaveAndGenerateQR} className="space-y-4">
                      <div className="space-y-2">
                         <label htmlFor="fabric-name-input" className="text-xs font-bold text-slate-550 uppercase tracking-wider block">
                           Fabric Name / Pattern Variant
                         </label>
                         <input 
                          type="text"
                          id="fabric-name-input"
                          ref={inputRef}
                          required
                          value={fabricName}
                          onChange={(e) => setFabricName(e.target.value)}
                          placeholder="e.g. Indigo Herringbone Linen, Silk Satin 03"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium text-slate-900 focus:bg-white text-sm"
                          disabled={saving}
                        />
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 space-y-1">
                        <p className="font-bold text-[10px] uppercase text-indigo-700 tracking-wider">Automated QR Bindings</p>
                        <p className="text-slate-550 mt-1 leading-relaxed">QR Identifier format: <code className="font-mono text-slate-700 bg-slate-100 p-0.5 rounded border border-slate-200">FABRIC-{'<uuid>'}</code></p>
                      </div>

                      <button
                        type="submit"
                        disabled={saving || !fabricName.trim()}
                        className={`w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
                          saving || !fabricName.trim()
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none hover:bg-slate-100'
                            : ''
                        }`}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                            <span>Saving parameters...</span>
                          </>
                        ) : (
                          <>
                            <span>Generate QR & Save Completed</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>

                      <div className="border-t border-dashed border-slate-200 pt-3 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setIsDiscarding(true)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-rose-100 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Unsuitable image? Discard and request retake
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleDiscard} className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2.5 text-left">
                        <Ban className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider">Discard Fabric Sample</h4>
                          <p className="text-[11px] text-rose-700 mt-0.5 font-sans leading-relaxed">
                            This will reject the current snapshot record and alert the photographer on mobile.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 mt-2">
                        <label htmlFor="rejection-reason" className="text-xs font-bold text-slate-550 uppercase tracking-wider block">
                          Reason for Rejection
                        </label>
                        <input
                          type="text"
                          id="rejection-reason"
                          required
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. Blurry photo, shadow glare, folded sample"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all placeholder:text-slate-400 text-slate-900 focus:bg-white text-sm font-semibold"
                          disabled={saving}
                        />
                      </div>

                      {/* Speed assist tags */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">Quick suggestions:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Blurry image quality", "Shadows/Glare on sample", "Incomplete crop frame", "Wrong side/texture visible"].map((txt) => (
                            <button
                              key={txt}
                              type="button"
                              onClick={() => setRejectionReason(txt)}
                              className="text-[10.5px] font-sans px-2.5 py-1 border border-slate-200 bg-slate-50 rounded-lg hover:bg-indigo-55 hover:border-indigo-200 text-slate-600 hover:text-indigo-800 transition-all cursor-pointer font-medium"
                            >
                              {txt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDiscarding(false);
                            setRejectionReason('');
                          }}
                          className="py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer text-slate-600 text-center"
                          disabled={saving}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving || !rejectionReason.trim()}
                          className="py-3 bg-rose-600 hover:bg-rose-750 disabled:bg-rose-100 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-100 border-b-4 border-rose-800"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                              <span>Discarding...</span>
                            </>
                          ) : (
                            <>
                              <span>Confirm Discard</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Show the printed outcome immediately when completed */}
                {savedQrData && (
                  <div className="bg-white rounded-2xl border border-emerald-200 p-6 shadow-sm animate-in fade-in zoom-in duration-300 print-tag-box bg-emerald-50/20">
                    <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-xs">Archived and Tag Document Generated!</span>
                    </div>

                    {/* Printable tag sticker layout */}
                    <div className="bg-white text-slate-900 p-4.5 rounded-xl border border-slate-200 flex items-center gap-4 printable-area shadow-xs">
                      <div className="bg-white p-1 rounded-lg border border-slate-150 shrink-0">
                        <QRCodeSVG 
                          value={savedQrData.id} 
                          size={70} 
                          level="H" 
                          includeMargin={false} 
                        />
                      </div>
                      <div className="min-w-0 font-sans">
                        <p className="text-[13px] font-bold tracking-tight text-slate-950 truncate">{savedQrData.name}</p>
                        <p className="text-[9px] font-mono text-slate-500 font-bold tracking-wide uppercase mt-1">ID: {savedQrData.id}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase font-mono mt-0.5 tracking-wider">Physical Fabric Sticker</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200/60 text-[10px] font-mono pr-1">
                      <button 
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 text-indigo-650 hover:text-indigo-800 transition-all cursor-pointer font-bold"
                      >
                        <Printer className="h-3 w-3" />
                        <span>Print Sticker</span>
                      </button>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(savedQrData.id);
                          alert('Identifier code copied to clipboard!');
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-all font-semibold"
                      >
                        Copy fabric string ID
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center py-24 px-4 text-center max-w-lg mx-auto">
              <div className="h-16 w-16 rounded-full bg-white border border-slate-200 text-slate-450 flex items-center justify-center mb-4 shadow-xs">
                <Laptop className="h-8 w-8 text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">No active samples to tag</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 font-medium">
                Excellent work! The tagging workspace is currently synchronized. When the mobile Photographer snap-uploads a new sample on their smartphone, it will pop up right here instantly.
              </p>
              
              {connectionStatus === 'local' && (
                <div className="p-5 bg-white rounded-2xl border border-slate-200 font-mono text-xs text-left w-full space-y-3 shadow-xs">
                  <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10" /> Developer Sandbox Actions
                  </p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">Since Supabase URL is not yet bound, click below to mimic the photographer uploading a fabric sample from another device:</p>
                  <button 
                    onClick={testTriggerMockCapture}
                    className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-sans text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    + Mock Photographer Capture (Simulate Upload)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* COMPLETED FEED HISTORY TRACK: Render bottom audit shelf */}
          <div className="border-t border-slate-200 bg-white p-6 shrink-0 mt-auto shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs uppercase tracking-widest font-mono font-bold text-slate-500">Digitization Archive ({completedFabrics.length} completed)</h4>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-semibold">Recently Labeled Samples</span>
            </div>

            {completedFabrics.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/55">
                <p className="text-xs text-slate-450 font-mono">No archive logs for this session yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {completedFabrics.slice(0, 6).map((item) => (
                  <div key={item.id} className="bg-slate-50/60 border border-slate-200 p-3 rounded-xl flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100 shrink-0 border border-slate-200">
                      <img src={item.image_url} alt="Historic Log preview" className="object-cover h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[9px] font-mono text-slate-400 tracking-wider truncate mt-0.5">{item.qr_code_id}</p>
                    </div>
                    <div className="bg-white p-0.5 rounded-md shrink-0 border border-slate-200">
                      <QRCodeSVG value={item.qr_code_id || ''} size={28} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}
