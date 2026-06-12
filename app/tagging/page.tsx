'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { 
  Laptop, AlertCircle, Loader2, Compass, 
  ArrowLeft, RefreshCw, LogOut, ShieldAlert
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { CodeType } from '@/components/scannable-code';

// Import extracted components
import TaggingSidebar from '@/components/tagging-sidebar';
import FabricImagePreview from '@/components/fabric-image-preview';
import LabelingForm from '@/components/labeling-form';
import DirectPrinterPanel from '@/components/direct-printer-panel';
import DigitizationHistory from '@/components/digitization-history';
import GalleryOverlay from '@/components/gallery-overlay';

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
  const [historyGalleryActiveIndex, setHistoryGalleryActiveIndex] = useState<number | null>(null);
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

  // Dynamic code formats for thermal printer stickers
  const [print2DFormat, setPrint2DFormat] = useState<CodeType>('qrcode');
  const [print1DFormat, setPrint1DFormat] = useState<CodeType>('code128');

  const inputRef = useRef<HTMLInputElement>(null);

  // Smart suggestions states
  const [detectLoading, setDetectLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<{ name: string; color: string; pattern: string; material: string } | null>(null);
  const [detectError, setDetectError] = useState('');

  // Fetch suggestions for catalog properties
  const handleFetchSuggestions = async () => {
    if (!activeFabric) return;
    setDetectLoading(true);
    setDetectError('');
    setSuggestions(null);

    try {
      if (isConfigured) {
        const response = await fetch('/api/analyze-fabric', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl: activeFabric.image_url }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to detect fabric characteristics.');
        }

        setSuggestions(data.suggestions);
      } else {
        // --- OFFLINE MOCK MODE ---
        await new Promise((resolve) => setTimeout(resolve, 1200));
        
        const mockNames = [
          { name: 'Classic Charcoal Tweed', color: 'Charcoal Grey', pattern: 'Herringbone', material: 'Woven Tweed Wool' },
          { name: 'Olive Cotton Canvas', color: 'Olive Green', pattern: 'Solid', material: 'Heavy Canvas Cotton' },
          { name: 'Navy Polka Crepe', color: 'Navy Blue', pattern: 'Polka Dot', material: 'Crepe Polyester' },
          { name: 'Golden Damask Silk', color: 'Antique Gold', pattern: 'Damask / Jacquard', material: 'Silk Brocade' },
          { name: 'Scarlet Tartan Flannel', color: 'Scarlet Red', pattern: 'Tartan Plaid', material: 'Brushed Flannel' },
        ];
        
        const seed = activeFabric.id.charCodeAt(activeFabric.id.length - 1) || 0;
        const selectedMock = mockNames[seed % mockNames.length];
        setSuggestions(selectedMock);
      }
    } catch (err: any) {
      console.error('Property detection failed:', err);
      setDetectError(err.message || 'Smart scanning failed. Verify configuration.');
    } finally {
      setDetectLoading(false);
    }
  };

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
            .select('id, team_id')
            .eq('code', sessionCode.toUpperCase())
            .eq('status', 'active')
            .maybeSingle();

          if (error) throw error;
          if (data) {
            // Verify user belongs to the hosting team
            const { data: membership, error: memberErr } = await supabase
              .from('team_members')
              .select('team_id')
              .eq('team_id', data.team_id)
              .eq('user_id', user?.id)
              .maybeSingle();

            if (memberErr) throw memberErr;
            if (membership) {
              setSessionId(data.id);
            } else {
              setErrorText(`You do not belong to the team hosting this session. Please join their team first.`);
            }
          } else {
            setErrorText(`Active session "${sessionCode}" not found.`);
          }
        } else {
          // Sandbox mock resolution
          const mockSessions = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
          const matched = mockSessions.find((s: any) => s.code === sessionCode.toUpperCase() && s.status === 'active');
          if (matched) {
            // Check membership in sandbox
            const localMembers = JSON.parse(localStorage.getItem('fabric_local_team_members') || '[]');
            const isMember = localMembers.some((m: any) => m.team_id === matched.team_id && m.user_id === 'sandbox');
            if (isMember) {
              setSessionId(matched.id);
            } else {
              setErrorText(`You do not belong to the team hosting this session.`);
            }
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
  }, [sessionCode, authLoading, isConfigured, user]);

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

  const fetchFabrics = useCallback(async (silent = false) => {
    if (!user || !sessionId) return;
    if (!silent) setLoading(true);
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
        fetchFabrics(false);
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
              fetchFabrics(true);
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
    setSuggestions(null);
    setDetectError('');
    if (activeFabric) {
      // Pre-fill with photographer-provided name if already set
      setFabricName(activeFabric.name || '');

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
        
        await fetchFabrics(true);
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
        
        await fetchFabrics(true);
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-rose-705 uppercase font-bold text-[10px]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Offline</span>
            </div>
          )}
          {connectionStatus === 'local' && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full text-amber-705 uppercase font-bold text-[10px]">
              <Compass className="h-3.5 w-3.5 text-amber-500" />
              <span>Sandbox Mode</span>
            </div>
          )}

          {isConfigured && (
            <button 
              type="button"
              onClick={() => fetchFabrics(false)}
              className="p-1 px-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-350 bg-white shadow-xs rounded-lg transition-all cursor-pointer"
              title="Manual Sync"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}

          {isConfigured && user && (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <span className="text-slate-555 truncate max-w-[120px] font-medium">{user.email}</span>
              <button
                type="button"
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
        <TaggingSidebar
          fabrics={fabrics}
          activeFabric={activeFabric}
          setActiveFabric={setActiveFabric}
          connectionStatus={connectionStatus}
          testTriggerMockCapture={testTriggerMockCapture}
          cleanDemoDatabase={cleanDemoDatabase}
        />

        {/* CENTER / RIGHT AREA: Fabric details & labeling */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-y-auto">
          {activeFabric ? (
            <div className="flex-1 p-6 max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start animate-panel">
              
              {/* Image Preview Block */}
              <FabricImagePreview
                activeFabric={activeFabric}
                totalPending={fabrics.length}
              />

              {/* Form & Actions */}
              <div className="md:col-span-6 space-y-6">
                <LabelingForm
                  activeFabric={activeFabric}
                  fabricName={fabricName}
                  setFabricName={setFabricName}
                  isDiscarding={isDiscarding}
                  setIsDiscarding={setIsDiscarding}
                  rejectionReason={rejectionReason}
                  setRejectionReason={setRejectionReason}
                  saving={saving}
                  onSubmitLabel={handleSaveAndGenerateQR}
                  onSubmitDiscard={handleDiscard}
                  detectLoading={detectLoading}
                  handleFetchSuggestions={handleFetchSuggestions}
                  suggestions={suggestions}
                  detectError={detectError}
                  inputRef={inputRef}
                />

                {/* Print sticker preview */}
                <DirectPrinterPanel
                  savedQrData={savedQrData}
                  sessionCode={sessionCode}
                  connectionStatus={connectionStatus}
                  print2DFormat={print2DFormat}
                  setPrint2DFormat={setPrint2DFormat}
                  print1DFormat={print1DFormat}
                  setPrint1DFormat={setPrint1DFormat}
                />
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
                  <p className="text-slate-555 text-[11px] leading-relaxed">Mimic the mobile photographer uploading a fabric sample to test the live workspace sync:</p>
                  <button 
                    type="button"
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
          <DigitizationHistory
            completedFabrics={completedFabrics}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onFabricClick={(fabric) => {
              const index = completedFabrics.findIndex((item) => item.id === fabric.id);
              if (index >= 0) {
                setHistoryGalleryActiveIndex(index);
              }
            }}
          />

        </div>
      </div>

      {historyGalleryActiveIndex !== null && (
        <GalleryOverlay
          galleryActiveIndex={historyGalleryActiveIndex}
          setGalleryActiveIndex={setHistoryGalleryActiveIndex}
          filteredFabrics={completedFabrics}
        />
      )}

      {/* PRINT STYLING INJECTIONS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-sticker-label, #thermal-sticker-label * {
            visibility: visible;
          }
          #thermal-sticker-label {
            position: absolute;
            left: 0;
            top: 0;
            width: 2.2in;
            height: 1.2in;
            margin: 0;
            padding: 0.1in;
            border: none !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          @page {
            size: 2.2in 1.2in;
            margin: 0;
          }
        }
      `}</style>

    </main>
  );
}

export default function TaggingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-slate-550 font-medium">Initializing labeling desk...</span>
        </div>
      </div>
    }>
      <TaggingPageContent />
    </Suspense>
  );
}
