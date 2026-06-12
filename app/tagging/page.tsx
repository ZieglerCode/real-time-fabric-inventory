'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { 
  Laptop, CheckCircle2, AlertCircle, Copy, Loader2, Compass, 
  Tag, Download, Printer, Layers, Clock, ArrowRight, ArrowLeft, ClipboardCheck,
  Search, ExternalLink, RefreshCw, Undo2, Ban, User, LogOut, ShieldAlert, Bluetooth, Usb
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { usePrinter, PrinterLanguage } from '@/hooks/use-printer';
import ScannableCode, { CodeType } from '@/components/scannable-code';
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

  const {
    mode: printerMode,
    setMode: setPrinterMode,
    status: printerStatus,
    connectedDeviceName,
    language: printerLanguage,
    setLanguage: setPrinterLanguage,
    errorMsg: printerErrorMsg,
    connectUSB,
    connectBluetooth,
    disconnectPrinter,
    printDirect,
    hasUsbSupport,
    hasBluetoothSupport
  } = usePrinter();

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

  const handlePrint = async () => {
    if (printerMode === 'browser') {
      window.print();
    } else {
      if (!savedQrData) return;
      const labelData = {
        name: savedQrData.name || 'Unnamed Fabric',
        qrCodeId: savedQrData.id || '',
        sessionCode: sessionCode || 'SANDBOX'
      };
      await printDirect(labelData, connectionStatus === 'local');
    }
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
              onClick={() => fetchFabrics(false)}
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
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label htmlFor="fabric-name-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            Fabric Name / Pattern Variant
                          </label>
                          
                          {/* Smart tag trigger */}
                          <button
                            type="button"
                            onClick={handleFetchSuggestions}
                            disabled={detectLoading || saving}
                            className="text-[10px] font-bold text-indigo-650 hover:text-indigo-850 flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 px-2 py-1 rounded-lg disabled:opacity-50"
                          >
                            {detectLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin text-indigo-600" />
                                <span>Scanning image...</span>
                              </>
                            ) : (
                              <>
                                <Tag className="h-3 w-3 text-indigo-500" />
                                <span>Auto-detect features</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Suggestions result card */}
                        {suggestions && (
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <span>Detected Properties</span>
                              <button
                                type="button"
                                onClick={() => setFabricName(suggestions.name)}
                                className="text-[10px] text-indigo-650 hover:text-indigo-805 font-bold uppercase tracking-widest cursor-pointer"
                              >
                                Apply suggested name
                              </button>
                            </div>
                            
                            {/* Properties pills grid */}
                            <div className="grid grid-cols-3 gap-2 text-[10.5px]">
                              <div className="bg-white p-2 rounded-xl border border-slate-150 text-center">
                                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Color</span>
                                <span className="font-bold text-slate-700 truncate block" title={suggestions.color}>{suggestions.color}</span>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-slate-150 text-center">
                                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Pattern</span>
                                <span className="font-bold text-slate-700 truncate block" title={suggestions.pattern}>{suggestions.pattern}</span>
                              </div>
                              <div className="bg-white p-2 rounded-xl border border-slate-150 text-center">
                                <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Texture</span>
                                <span className="font-bold text-slate-700 truncate block" title={suggestions.material}>{suggestions.material}</span>
                              </div>
                            </div>
                            
                            <div className="text-[11px] bg-white border border-slate-150 rounded-xl p-2.5 flex items-center justify-between gap-3">
                              <span className="text-slate-500 font-medium">Suggested: <strong className="font-bold text-slate-800">{suggestions.name}</strong></span>
                              <button
                                type="button"
                                onClick={() => setFabricName(suggestions.name)}
                                className="shrink-0 text-[10px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-1 rounded-lg text-indigo-700 font-bold transition-all cursor-pointer"
                              >
                                Use
                              </button>
                            </div>
                          </div>
                        )}

                        {detectError && (
                          <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-[10.5px] rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
                            <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                            <span className="font-semibold">{detectError}</span>
                          </div>
                        )}

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
                  <div className="bg-white rounded-3xl border border-emerald-250 p-6 shadow-md animate-in fade-in zoom-in duration-300 print-tag-box bg-emerald-50/10 space-y-4">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="text-xs">Sticker Label Generated!</span>
                    </div>

                    {/* PRINT ELEMENT STYLED FOR 50mm x 30mm (2x1.2 inch) THERMAL LABEL PRINTERS */}
                    <div className="p-4 flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-150/80 print:bg-white print:p-0">
                      <div 
                        id="thermal-sticker-label" 
                        className="bg-white border border-slate-300 p-4 rounded-2xl flex flex-col justify-between items-center text-center shadow-xs w-72 h-44 print:border-none print:shadow-none print:rounded-none print:p-0 print:w-[2.2in] print:h-[1.2in] print:m-0"
                      >
                        <div className="w-full min-w-0">
                          <p className="text-[12px] font-extrabold text-slate-950 truncate print:text-[10px] print:leading-tight">
                            {savedQrData.name}
                          </p>
                          <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5 print:text-[7px]">
                            ID: {savedQrData.id}
                          </p>
                        </div>

                        {/* Codes side-by-side layout */}
                        <div className="flex items-center justify-around w-full gap-4 mt-2">
                          <div className="p-0.5 bg-white border border-slate-150 rounded shrink-0 print:border-none">
                            <ScannableCode 
                              value={savedQrData.id || ''} 
                              type={print2DFormat} 
                              scale={1.5}
                            />
                          </div>
                          <div className="scale-90 origin-center shrink-0">
                            <ScannableCode 
                              value={savedQrData.id || ''} 
                              type={print1DFormat} 
                              scale={1.2} 
                              height={9}
                            />
                          </div>
                        </div>

                        <div className="w-full border-t border-slate-100 pt-1.5 mt-2 flex justify-between items-center text-[7px] font-bold text-slate-400 uppercase tracking-widest print:text-[6px] print:mt-1">
                          <span>Ziegler textile catalog</span>
                          <span className="font-mono">{sessionCode.toUpperCase()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Printer Configuration Panel */}
                    <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4 print:hidden">
                      {/* Tab Selector for Printer Connection Mode */}
                      <div>
                        <label className="block text-[9.5px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Printer Mode</label>
                        <div className="grid grid-cols-3 gap-2 bg-slate-200/50 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setPrinterMode('browser')}
                            className={`py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              printerMode === 'browser'
                                ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Printer className="h-3 w-3" />
                            <span>System Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrinterMode('usb')}
                            className={`py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              printerMode === 'usb'
                                ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Usb className="h-3 w-3" />
                            <span>Direct USB</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrinterMode('bluetooth')}
                            className={`py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                              printerMode === 'bluetooth'
                                ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                          >
                            <Bluetooth className="h-3 w-3" />
                            <span>Bluetooth</span>
                          </button>
                        </div>
                      </div>

                      {/* Direct Printing Connection Drawer */}
                      {printerMode !== 'browser' && (
                        <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">Status:</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                printerStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                                printerStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                                printerStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'
                              }`} />
                              <span className="text-[11px] font-bold capitalize text-slate-700">
                                {printerStatus === 'connected' ? 'Connected' :
                                 printerStatus === 'connecting' ? 'Connecting...' :
                                 printerStatus === 'error' ? 'Connection Error' : 'Disconnected'}
                              </span>
                            </div>
                          </div>

                          {printerStatus === 'connected' && (
                            <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                              <div className="min-w-0">
                                <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">Device</p>
                                <p className="text-xs font-semibold text-emerald-950 truncate">{connectedDeviceName}</p>
                              </div>
                              <button
                                type="button"
                                onClick={disconnectPrinter}
                                className="text-[10px] font-bold text-rose-650 hover:text-rose-800 px-2 py-1 bg-white border border-rose-100 hover:border-rose-200 rounded-lg shadow-2xs transition-all cursor-pointer"
                              >
                                Disconnect
                              </button>
                            </div>
                          )}

                          {printerStatus !== 'connected' && (
                            <>
                              {((printerMode === 'usb' && !hasUsbSupport) || (printerMode === 'bluetooth' && !hasBluetoothSupport)) ? (
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2 text-amber-800 text-[10.5px] font-medium leading-relaxed">
                                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                                  <div>
                                    <p className="font-bold">Not Supported</p>
                                    <p>Direct {printerMode === 'usb' ? 'USB' : 'Bluetooth'} is unsupported in this browser. Please use Chrome or Edge on Desktop, or switch to System Print.</p>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={printerStatus === 'connecting'}
                                  onClick={() => {
                                    if (printerMode === 'usb') {
                                      connectUSB(connectionStatus === 'local');
                                    } else {
                                      connectBluetooth(connectionStatus === 'local');
                                    }
                                  }}
                                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white ${
                                    printerStatus === 'connecting'
                                      ? 'bg-slate-350 cursor-not-allowed shadow-none'
                                      : 'bg-indigo-650 hover:bg-indigo-750 shadow-indigo-100 border-b border-indigo-850'
                                  }`}
                                >
                                  {printerStatus === 'connecting' ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Searching Device...</span>
                                    </>
                                  ) : (
                                    <>
                                      {printerMode === 'usb' ? <Usb className="h-3.5 w-3.5" /> : <Bluetooth className="h-3.5 w-3.5" />}
                                      <span>Connect {printerMode === 'usb' ? 'USB Printer' : 'Bluetooth Printer'}</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </>
                          )}

                          {printerErrorMsg && (
                            <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5 animate-pulse">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                              <span className="truncate">{printerErrorMsg}</span>
                            </div>
                          )}

                          <div className="pt-1.5">
                            <label className="block text-[9.5px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Printer Language</label>
                            <select
                              value={printerLanguage}
                              onChange={(e) => setPrinterLanguage(e.target.value as PrinterLanguage)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                            >
                              <option value="TSPL">TSPL (Munbyn, Xprinter, Rollo, TSC)</option>
                              <option value="ZPL">ZPL (Zebra Printers)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Label Code Formats</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-500 mb-1">2D Format</label>
                            <select
                              value={print2DFormat}
                              onChange={(e) => setPrint2DFormat(e.target.value as CodeType)}
                              className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                            >
                              <option value="qrcode">QR Code</option>
                              <option value="datamatrix">Data Matrix</option>
                              <option value="pdf417">PDF417</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-bold text-slate-500 mb-1">1D Format</label>
                            <select
                              value={print1DFormat}
                              onChange={(e) => setPrint1DFormat(e.target.value as CodeType)}
                              className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                            >
                              <option value="code128">Code 128</option>
                              <option value="code39">Code 39</option>
                              <option value="ean13">EAN-13 (Numeric)</option>
                              <option value="upca">UPC-A (Numeric)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons footer */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-200/60 print:hidden">
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(savedQrData.id);
                          alert('Label ID code copied to clipboard!');
                        }}
                        className="text-slate-400 hover:text-slate-650 transition-all font-semibold cursor-pointer text-xs"
                      >
                        Copy Reference ID
                      </button>
                      <button 
                        type="button"
                        disabled={printerMode !== 'browser' && printerStatus !== 'connected'}
                        onClick={handlePrint}
                        className={`inline-flex items-center gap-1.5 px-4.5 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md border-b ${
                          (printerMode !== 'browser' && printerStatus !== 'connected')
                            ? 'bg-slate-300 border-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-indigo-650 hover:bg-indigo-750 shadow-indigo-150 border-b border-indigo-850'
                        }`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print Sticker</span>
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
          <span className="text-xs text-slate-500 font-medium">Initializing labeling desk...</span>
        </div>
      </div>
    }>
      <TaggingPageContent />
    </Suspense>
  );
}
