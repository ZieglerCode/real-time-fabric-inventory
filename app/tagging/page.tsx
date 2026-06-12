'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { 
  Laptop, CheckCircle2, AlertCircle, Copy, Loader2, Compass, 
  Tag, Download, Printer, Layers, Clock, ArrowRight, ArrowLeft, ClipboardCheck,
  Search, ExternalLink, RefreshCw, Undo2, Ban, User, LogOut, ShieldAlert
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
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
  created_by_email?: string | null;
  tagged_by_email?: string | null;
  session_id?: string | null;
}

function TaggingPageContent() {
  const { user, loading: authLoading, signOut, isConfigured } = useAuth();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('session') || '';
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionResolving, setSessionResolving] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [taggerSeatOccupied, setTaggerSeatOccupied] = useState(false);
  const [checkingSeat, setCheckingSeat] = useState(true);

  // Heartbeat tracking & slot occupancy check for active tagger connection
  useEffect(() => {
    if (!sessionId) return;

    setCheckingSeat(true);
    setTaggerSeatOccupied(false);

    const checkAndSendHeartbeat = async () => {
      const timeThreshold = new Date(Date.now() - 30 * 1000).toISOString();
      const currentUserId = user?.id || 'sandbox-tagger';

      if (isConfigured) {
        if (!user) {
          setCheckingSeat(false);
          return;
        }
        try {
          // Check if there is already an active tagger that is NOT us
          const { data, error: checkErr } = await supabase
            .from('session_connections')
            .select('user_id')
            .eq('session_id', sessionId)
            .eq('role', 'tagger')
            .neq('user_id', currentUserId)
            .gt('last_seen_at', timeThreshold);

          if (checkErr) throw checkErr;

          if (data && data.length > 0) {
            setTaggerSeatOccupied(true);
            setCheckingSeat(false);
            return;
          }

          // Slot is free, register/upsert our heartbeat
          const { error: upsertErr } = await supabase
            .from('session_connections')
            .upsert({
              session_id: sessionId,
              user_id: currentUserId,
              user_email: user.email || 'unknown',
              role: 'tagger',
              last_seen_at: new Date().toISOString()
            }, {
              onConflict: 'session_id,user_id'
            });

          if (upsertErr) throw upsertErr;
          setTaggerSeatOccupied(false);
        } catch (err) {
          console.error('Failed checking/sending tagger database heartbeat:', err);
        } finally {
          setCheckingSeat(false);
        }
      } else {
        // Sandbox mode
        try {
          const localConnections = JSON.parse(localStorage.getItem('fabric_local_connections') || '[]');
          const nowMs = Date.now();
          
          // Check if another active tagger exists
          const otherTaggerExists = localConnections.some(
            (c: any) => 
              c.session_id === sessionId && 
              c.role === 'tagger' && 
              c.user_id !== currentUserId && 
              new Date(c.last_seen_at).getTime() > nowMs - 30 * 1000
          );

          if (otherTaggerExists) {
            setTaggerSeatOccupied(true);
            setCheckingSeat(false);
            return;
          }

          // Register/upsert heartbeat
          const nowStr = new Date().toISOString();
          const existingIdx = localConnections.findIndex(
            (c: any) => c.session_id === sessionId && c.user_id === currentUserId
          );

          if (existingIdx > -1) {
            localConnections[existingIdx].last_seen_at = nowStr;
            localConnections[existingIdx].role = 'tagger';
          } else {
            localConnections.push({
              session_id: sessionId,
              user_id: currentUserId,
              user_email: 'tagger@company.com',
              role: 'tagger',
              last_seen_at: nowStr
            });
          }

          localStorage.setItem('fabric_local_connections', JSON.stringify(localConnections));
          window.dispatchEvent(new Event('storage'));
          setTaggerSeatOccupied(false);
        } catch (err) {
          console.error('Failed checking/sending tagger local heartbeat:', err);
        } finally {
          setCheckingSeat(false);
        }
      }
    };

    const cleanupConnection = async () => {
      const currentUserId = user?.id || 'sandbox-tagger';
      if (isConfigured) {
        if (!user) return;
        try {
          await supabase
            .from('session_connections')
            .delete()
            .eq('session_id', sessionId)
            .eq('user_id', currentUserId);
        } catch (err) {
          console.error('Failed to delete tagger database connection:', err);
        }
      } else {
        try {
          const localConnections = JSON.parse(localStorage.getItem('fabric_local_connections') || '[]');
          const filtered = localConnections.filter(
            (c: any) => !(c.session_id === sessionId && c.user_id === currentUserId)
          );
          localStorage.setItem('fabric_local_connections', JSON.stringify(filtered));
          window.dispatchEvent(new Event('storage'));
        } catch (err) {
          console.error('Failed to delete tagger local connection:', err);
        }
      }
    };

    // Run check immediately
    checkAndSendHeartbeat();

    // Run check and send heartbeat every 15 seconds
    const intervalId = setInterval(checkAndSendHeartbeat, 15000);

    // Unload cleanup
    const handleUnload = () => {
      cleanupConnection();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      cleanupConnection();
    };
  }, [sessionId, user, isConfigured]);

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [completedFabrics, setCompletedFabrics] = useState<Fabric[]>([]);
  const [activeFabric, setActiveFabric] = useState<Fabric | null>(null);
  const [fabricName, setFabricName] = useState<string>('');
  const [isDiscarding, setIsDiscarding] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  // Search state for archive
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedQrData, setSavedQrData] = useState<{ id: string; name: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error' | 'local'>(() => 
    isConfigured ? 'connecting' : 'local'
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Keep track of active fabric in a ref to reference inside callbacks without re-subscribing websockets
  const activeFabricRef = useRef<Fabric | null>(null);
  useEffect(() => {
    activeFabricRef.current = activeFabric;
  }, [activeFabric]);

  // Resolve session code to UUID
  useEffect(() => {
    const resolveSession = async () => {
      if (!sessionCode) {
        setSessionResolving(false);
        return;
      }
      setSessionResolving(true);
      setErrorText('');

      try {
        if (isConfigured) {
          const { data, error } = await supabase
            .from('sessions')
            .select('id')
            .eq('code', sessionCode.toUpperCase())
            .eq('status', 'active')
            .maybeSingle();

          if (error) throw error;
          if (data) {
            setSessionId(data.id);
          } else {
            setErrorText(`Active session "${sessionCode}" not found.`);
          }
        } else {
          // Sandbox mock resolution
          const mockSessions = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
          const matched = mockSessions.find((s: any) => s.code === sessionCode.toUpperCase() && s.status === 'active');
          if (matched) {
            setSessionId(matched.id);
          } else {
            setErrorText(`Active session "${sessionCode}" not found in sandbox.`);
          }
        }
      } catch (err: any) {
        console.error('Error resolving session:', err);
        setErrorText('Failed to resolve active session.');
      } finally {
        setSessionResolving(false);
      }
    };

    if (!authLoading) {
      resolveSession();
    }
  }, [sessionCode, authLoading, isConfigured]);

  // Sync / Load data from localStorage (For offline-sync demo mode)
  const loadLocalData = useCallback(() => {
    if (!sessionId) return;
    const queue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]')
      .filter((f: Fabric) => f.session_id === sessionId);
    const processed = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]')
      .filter((f: Fabric) => f.session_id === sessionId);
    
    setFabrics(queue);
    setCompletedFabrics(processed);

    if (queue.length > 0) {
      setActiveFabric(queue[0]);
    } else {
      setActiveFabric(null);
    }
  }, [sessionId]);

  // Fetch pending and completed fabrics from Live Supabase
  const fetchFabrics = useCallback(async () => {
    if (!user || !sessionId) return;
    setLoading(true);
    try {
      // 1. Fetch pending rows sorted oldest-first, filtered by session ID
      const { data: pendingData, error: pendingErr } = await supabase
        .from('fabrics')
        .select('*')
        .eq('status', 'pending')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (pendingErr) throw pendingErr;

      // 2. Fetch completed rows sorted newest-first, filtered by session ID
      const { data: completedData, error: completedErr } = await supabase
        .from('fabrics')
        .select('*')
        .eq('status', 'completed')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (completedErr) throw completedErr;

      const pendingList = pendingData || [];
      setFabrics(pendingList);
      setCompletedFabrics(completedData || []);

      const currentActive = activeFabricRef.current;
      if (pendingList.length > 0) {
        const stillPending = currentActive ? pendingList.find(f => f.id === currentActive.id) : null;
        if (stillPending) {
          setActiveFabric(stillPending);
        } else {
          setActiveFabric(pendingList[0]);
        }
      } else {
        setActiveFabric(null);
      }
    } catch (err) {
      console.error('Error fetching tables data:', err);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, [user, sessionId]);

  // Initialize and check credentials
  useEffect(() => {
    if (!sessionId) return;

    if (isConfigured && user) {
      const timer = setTimeout(() => {
        fetchFabrics();
      }, 0);

      // Realtime subscription mapping: Subscribe to inserts & updates
      const channel = supabase
        .channel(`schema-changes-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fabrics'
          },
          (payload) => {
            // Only refresh if payload matches this active session ID
            const newRow = payload.new as any;
            const oldRow = payload.old as any;
            if (
              (newRow && newRow.session_id === sessionId) ||
              (oldRow && oldRow.session_id === sessionId)
            ) {
              console.log('Real-time database event in session:', payload);
              fetchFabrics();
            }
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
    } else if (!isConfigured) {
      const timer = setTimeout(() => {
        loadLocalData();
      }, 0);

      const handleStorageUpdate = (e: StorageEvent) => {
        loadLocalData();
      };
      window.addEventListener('storage', handleStorageUpdate);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('storage', handleStorageUpdate);
      };
    }
  }, [isConfigured, user, sessionId, fetchFabrics, loadLocalData]);

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
    if (!activeFabric || !fabricName.trim() || !sessionId) return;

    setSaving(true);
    const fabricId = activeFabric.id;
    const generatedQrId = `FABRIC-${fabricId.substring(0, 8).toUpperCase()}`;

    try {
      if (isConfigured) {
        const { error } = await supabase
          .from('fabrics')
          .update({
            name: fabricName.trim(),
            qr_code_id: generatedQrId,
            status: 'completed',
            tagged_by: user?.id,
            tagged_by_email: user?.email
          })
          .eq('id', fabricId);

        if (error) throw error;
        
        await fetchFabrics();
      } else {
        // Offline sandbox mode update
        const queue: Fabric[] = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        const processed: Fabric[] = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]');

        const updatedQueue = queue.filter(item => item.id !== fabricId);
        
        const completedItem: Fabric = {
          ...activeFabric,
          name: fabricName.trim(),
          qr_code_id: generatedQrId,
          status: 'completed',
          tagged_by_email: 'sandbox@company.com'
        };

        processed.unshift(completedItem);

        localStorage.setItem('fabric_local_queue', JSON.stringify(updatedQueue));
        localStorage.setItem('fabric_local_completed', JSON.stringify(processed));

        // State update
        setFabrics(updatedQueue.filter(f => f.session_id === sessionId));
        setCompletedFabrics(processed.filter(f => f.session_id === sessionId));

        const activeQueue = updatedQueue.filter(f => f.session_id === sessionId);
        if (activeQueue.length > 0) {
          setActiveFabric(activeQueue[0]);
        } else {
          setActiveFabric(null);
        }

        window.dispatchEvent(new Event('storage'));
      }

      setSavedQrData({ id: generatedQrId, name: fabricName.trim() });
    } catch (err) {
      console.error(err);
      alert('Error updating row data: Please verify connection and database permissions.');
    } finally {
      setSaving(false);
    }
  };

  // Discard / Request retake
  const handleDiscard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFabric || !sessionId) return;

    setSaving(true);
    const fabricId = activeFabric.id;
    const finalReason = rejectionReason.trim() || 'Poor photo lighting or blurry crop quality';

    try {
      if (isConfigured) {
        const { error } = await supabase
          .from('fabrics')
          .update({
            status: 'discarded',
            rejection_reason: finalReason,
            discarded_at: new Date().toISOString(),
            tagged_by: user?.id,
            tagged_by_email: user?.email
          })
          .eq('id', fabricId);

        if (error) throw error;
        
        await fetchFabrics();
      } else {
        // Offline sandbox mode rejection
        const queue: Fabric[] = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        const updatedQueue = queue.filter(item => item.id !== fabricId);

        localStorage.setItem('fabric_local_queue', JSON.stringify(updatedQueue));
        localStorage.setItem('last_rejection', JSON.stringify({
          id: fabricId,
          reason: finalReason,
          timestamp: new Date().toISOString(),
          session_id: sessionId
        }));

        setFabrics(updatedQueue.filter(f => f.session_id === sessionId));

        const activeQueue = updatedQueue.filter(f => f.session_id === sessionId);
        if (activeQueue.length > 0) {
          setActiveFabric(activeQueue[0]);
        } else {
          setActiveFabric(null);
        }

        window.dispatchEvent(new Event('storage'));
      }

      setIsDiscarding(false);
      setRejectionReason('');
    } catch (err) {
      console.error(err);
      alert('Error requesting retake. Please verify RLS permissions.');
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
    if (!sessionId) return;
    const randomSeed = Math.floor(Math.random() * 1000);
    const mockRecord: Fabric = {
      id: `demo-uuid-${Date.now()}`,
      image_url: `https://picsum.photos/seed/${randomSeed}/800/600`,
      name: null,
      qr_code_id: null,
      status: 'pending',
      created_at: new Date().toISOString(),
      created_by_email: 'photographer@company.com',
      session_id: sessionId
    };
    
    const queue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
    queue.push(mockRecord);
    localStorage.setItem('fabric_local_queue', JSON.stringify(queue));
    
    window.dispatchEvent(new Event('storage'));
    loadLocalData();
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter history log by search query
  const filteredCompletedFabrics = completedFabrics.filter(fabric => {
    const nameMatch = fabric.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const codeMatch = fabric.qr_code_id?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    return nameMatch || codeMatch;
  });

  // 1. Loading States
  if (authLoading || sessionResolving || checkingSeat) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Resolving active session...</span>
        </div>
      </div>
    );
  }

  // 2. Seat Occupancy Check
  if (taggerSeatOccupied) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-150 rounded-full blur-3xl opacity-20 pointer-events-none" />
        
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm text-center space-y-6 relative z-10">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-amber-50 border border-amber-100 items-center justify-center text-amber-600 mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Desktop Tagger Seat Occupied</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            Only one active Desktop Tagger is allowed per cataloging lobby. Another user has already joined as tagger.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-bold shadow-md shadow-indigo-150 transition-all cursor-pointer border-b-2 border-indigo-805"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Control Center</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. Error State: No session or expired session
  if (!sessionCode || !sessionId) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-center items-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-150 rounded-full blur-3xl opacity-20 pointer-events-none" />
        
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm text-center space-y-6 relative z-10">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-rose-50 border border-rose-100 items-center justify-center text-rose-550 mx-auto">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Active Session</h2>
          <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
            {errorText || 'Please create or join a collaborative digitization lobby to activate your tagging dashboard.'}
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-bold shadow-md shadow-indigo-150 transition-all cursor-pointer border-b-2 border-indigo-805"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Control Center</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-indigo-500 relative overflow-hidden">
      
      {/* Top Header Panel */}
      <header className="px-6 py-4 bg-white border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between shrink-0 gap-4 relative z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="h-9 w-9 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              Labeling & Printing Desk
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border border-indigo-100">
                Lobby: {sessionCode.toUpperCase()}
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">Review incoming uploads, assign tags, and print physical fabric stickers.</p>
          </div>
        </div>

        {/* Sync Info / Profile Details */}
        <div className="flex items-center gap-3 self-end sm:self-auto text-xs">
          {connectionStatus === 'connected' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-700 uppercase font-bold text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Connected</span>
            </div>
          )}
          {connectionStatus === 'connecting' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-500 uppercase font-bold text-[10px]">
              <Loader2 className="h-3 w-3 animate-spin text-indigo-650" />
              <span>Syncing...</span>
            </div>
          )}
          {connectionStatus === 'error' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-rose-700 uppercase font-bold text-[10px]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Offline</span>
            </div>
          )}
          {connectionStatus === 'local' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-amber-700 uppercase font-bold text-[10px]">
              <Compass className="h-3.5 w-3.5 text-amber-500" />
              <span>Sandbox Mode</span>
            </div>
          )}

          {isConfigured && (
            <button 
              onClick={fetchFabrics}
              className="p-1 px-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 bg-white shadow-xs rounded-lg transition-all cursor-pointer"
              title="Manual Sync"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {isConfigured && user && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="text-slate-500 truncate max-w-[120px] font-medium">{user.email}</span>
              <button
                onClick={signOut}
                className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-lg border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Primary Split Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10">
        
        {/* LEFT COLUMN: Queue of pending uploads */}
        <div className="w-full lg:w-[350px] border-r border-slate-200 flex flex-col bg-white shrink-0">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 text-[10px] font-bold text-indigo-700 uppercase">{fabrics.length} Waiting</div>
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Fabric Photos</h2>
            </div>
            {connectionStatus === 'local' && (
              <button 
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
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Waiting for photographer to upload fabric photos...</p>
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
                    <span className="text-[10px] text-slate-400 font-semibold truncate block">ID: {item.id.slice(0, 8)}...</span>
                    <span className="text-[11px] text-slate-600 font-semibold block truncate">Photo review pending</span>
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
                onClick={cleanDemoDatabase}
                className="text-[10px] text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
              >
                Reset sandbox queue
              </button>
            )}
          </div>
        </div>

        {/* CENTER / RIGHT AREA: Fabric details & labeling */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-y-auto">
          {activeFabric ? (
            <div className="flex-1 p-6 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start animate-panel">
              
              {/* Image Preview Block */}
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
                    1 of {fabrics.length} pending
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

              {/* Form & Actions */}
              <div className="md:col-span-6 space-y-6">
                <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5 flex flex-col justify-between">
                  <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                    <Tag className="h-5 w-5 text-indigo-650" />
                    <h3 className="font-bold text-slate-800 text-base">Label Fabric</h3>
                  </div>

                  {!isDiscarding ? (
                    <form onSubmit={handleSaveAndGenerateQR} className="space-y-4">
                      <div className="space-y-2">
                         <label htmlFor="fabric-name-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
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

                      <button
                        type="submit"
                        disabled={saving || !fabricName.trim()}
                        className={`w-full py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer border-b-2 border-indigo-805 ${
                          saving || !fabricName.trim()
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none hover:bg-slate-100'
                            : ''
                        }`}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                            <span>Saving label...</span>
                          </>
                        ) : (
                          <>
                            <span>Generate QR & Save Label</span>
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </button>

                      <div className="border-t border-slate-100 pt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setIsDiscarding(true)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-rose-100 hover:bg-rose-50 px-3 py-2 rounded-xl"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Unsuitable photo? Request retake
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleDiscard} className="space-y-4 animate-in fade-in duration-200">
                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-2.5 text-left">
                        <Ban className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">Request Retake</h4>
                          <p className="text-[11px] text-rose-700 mt-0.5 font-sans leading-relaxed">
                            This will notify the photographer on mobile that a new photo is needed.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 mt-2">
                        <label htmlFor="rejection-reason" className="text-xs font-bold text-slate-550 uppercase tracking-wider block">
                          Reason for Retake
                        </label>
                        <input
                          type="text"
                          id="rejection-reason"
                          required
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="e.g. Photo is blurry, shadow glare, wrong side up"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none transition-all placeholder:text-slate-400 text-slate-900 focus:bg-white text-sm font-semibold"
                          disabled={saving}
                        />
                      </div>

                      {/* Suggestions */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-bold text-slate-400">Suggestions:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Blurry image quality", "Shadows/Glare on sample", "Incomplete crop frame", "Wrong side/texture visible"].map((txt) => (
                            <button
                              key={txt}
                              type="button"
                              onClick={() => setRejectionReason(txt)}
                              className="text-[10.5px] font-sans px-2.5 py-1 border border-slate-200 bg-slate-50 rounded-lg hover:bg-indigo-55 hover:border-indigo-200 text-slate-650 hover:text-indigo-800 transition-all cursor-pointer font-bold"
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
                          className="py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer text-slate-650 text-center"
                          disabled={saving}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving || !rejectionReason.trim()}
                          className="py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-100 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-100 border-b-2 border-rose-800"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                              <span>Requesting...</span>
                            </>
                          ) : (
                            <>
                              <span>Confirm Request</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Print sticker preview */}
                {savedQrData && (
                  <div className="bg-white rounded-3xl border border-emerald-200 p-6 shadow-sm animate-in fade-in zoom-in duration-300 print-tag-box bg-emerald-50/10">
                    <div className="flex items-center gap-2 mb-4 text-emerald-800 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-xs">Sticker Label Generated!</span>
                    </div>

                    {/* Sticker layout */}
                    <div className="bg-white text-slate-900 p-4.5 rounded-2xl border border-slate-200 flex items-center gap-4 printable-area shadow-xs">
                      <div className="bg-white p-1 rounded-lg border border-slate-150 shrink-0">
                        <QRCodeSVG 
                          value={savedQrData.id} 
                          size={70} 
                          level="H" 
                          includeMargin={false} 
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-slate-950 truncate">{savedQrData.name}</p>
                        <p className="text-[9px] font-mono text-slate-500 font-bold tracking-wide uppercase mt-1">ID: {savedQrData.id}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 tracking-wider">Physical Fabric Sticker</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200/60 text-[10px] font-mono">
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
                          alert('Label ID code copied to clipboard!');
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-all font-semibold cursor-pointer"
                      >
                        Copy Reference ID
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center py-24 px-4 text-center max-w-lg mx-auto animate-panel">
              <div className="h-16 w-16 rounded-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-4 shadow-xs">
                <Laptop className="h-8 w-8 text-indigo-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">No active samples to label</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6 font-medium">
                The labeling queue is currently empty. Once the mobile photographer uploads a new fabric photo, it will appear here immediately.
              </p>
              
              {connectionStatus === 'local' && (
                <div className="p-5 bg-white rounded-2xl border border-slate-200 text-xs text-left w-full space-y-3 shadow-xs">
                  <p className="text-amber-700 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-amber-500" /> Sandbox Actions
                  </p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">Mimic the mobile photographer uploading a fabric sample to test the live workspace sync:</p>
                  <button 
                    onClick={testTriggerMockCapture}
                    className="w-full mt-2 inline-flex items-center justify-center gap-1.5 py-3 px-4 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-100 cursor-pointer border-b-2 border-indigo-805"
                  >
                    + Mock Photographer Photo (Upload)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* COMPLETED FEED HISTORY TRACK: Bottom audit shelf */}
          <div className="border-t border-slate-200 bg-white p-6 shrink-0 mt-auto shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-650" />
                <h4 className="text-xs uppercase tracking-widest font-bold text-slate-500">Digitization Log</h4>
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

        </div>
      </div>
    </main>
  );
}

export default function TaggingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Initializing labeling desk...</span>
        </div>
      </div>
    }>
      <TaggingPageContent />
    </Suspense>
  );
}
