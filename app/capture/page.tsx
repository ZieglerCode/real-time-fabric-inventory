'use client';

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Camera, CheckCircle2, RefreshCw, AlertCircle, ArrowLeft, Loader2, Compass, Ban, User, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { motion, AnimatePresence } from 'framer-motion';

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

// Animation variants for card stack
const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
};

function CapturePageContent() {
  const { user, loading: authLoading, isConfigured } = useAuth();
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('session') || '';
  const router = useRouter();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionResolving, setSessionResolving] = useState(true);
  
  const [uploading, setUploading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lastUploadedName, setLastUploadedName] = useState<string>('');
  const [capturedCount, setCapturedCount] = useState<number>(0);
  const [errorText, setErrorText] = useState<string>('');
  
  // Photo preview states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectionAlert, setRejectionAlert] = useState<{ id: string; reason: string; timestamp: string } | null>(null);

  // Stack list states
  const [sessionFabrics, setSessionFabrics] = useState<Fabric[]>([]);
  const [loadingFabrics, setLoadingFabrics] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all fabrics captured in this session
  const fetchSessionFabrics = useCallback(async (silent = false) => {
    if (!sessionId) return;
    if (!silent) setLoadingFabrics(true);
    try {
      if (isConfigured) {
        const { data, error } = await supabase
          .from('fabrics')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSessionFabrics(data || []);
      } else {
        // Sandbox mode
        const queue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]')
          .filter((f: any) => f.session_id === sessionId);
        const completed = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]')
          .filter((f: any) => f.session_id === sessionId);

        const combined = [...queue, ...completed].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setSessionFabrics(combined);
      }
    } catch (err) {
      console.error('Error fetching fabrics list:', err);
    } finally {
      setLoadingFabrics(false);
    }
  }, [sessionId, isConfigured]);

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

  // Load session specific count
  useEffect(() => {
    if (sessionCode) {
      const saved = localStorage.getItem(`captured_count_${sessionCode}`);
      setCapturedCount(saved ? parseInt(saved, 10) : 0);
    }
  }, [sessionCode]);

  // Sync / Load photographer stack & Heartbeat tracking
  useEffect(() => {
    if (!sessionId) return;

    fetchSessionFabrics(false);

    const performHeartbeat = async () => {
      if (isConfigured) {
        if (!user) return;
        try {
          await supabase
            .from('session_connections')
            .upsert({
              session_id: sessionId,
              user_id: user.id,
              user_email: user.email || 'unknown',
              role: 'photographer',
              last_seen_at: new Date().toISOString()
            }, {
              onConflict: 'session_id,user_id'
            });
        } catch (err) {
          console.error('Failed to send database heartbeat:', err);
        }
      } else {
        try {
          const localConnections = JSON.parse(localStorage.getItem('fabric_local_connections') || '[]');
          const nowStr = new Date().toISOString();
          const existingIdx = localConnections.findIndex(
            (c: any) => c.session_id === sessionId && c.user_id === 'sandbox-photographer'
          );
          if (existingIdx > -1) {
            localConnections[existingIdx].last_seen_at = nowStr;
            localConnections[existingIdx].role = 'photographer';
          } else {
            localConnections.push({
              session_id: sessionId,
              user_id: 'sandbox-photographer',
              user_email: 'photographer@company.com',
              role: 'photographer',
              last_seen_at: nowStr
            });
          }
          localStorage.setItem('fabric_local_connections', JSON.stringify(localConnections));
          window.dispatchEvent(new Event('storage'));
        } catch (err) {
          console.error('Failed to send local heartbeat:', err);
        }
      }
    };

    const cleanupConnection = async () => {
      if (isConfigured) {
        if (!user) return;
        try {
          await supabase
            .from('session_connections')
            .delete()
            .eq('session_id', sessionId)
            .eq('user_id', user.id);
        } catch (err) {
          console.error('Failed to delete database connection:', err);
        }
      } else {
        try {
          const localConnections = JSON.parse(localStorage.getItem('fabric_local_connections') || '[]');
          const filtered = localConnections.filter(
            (c: any) => !(c.session_id === sessionId && c.user_id === 'sandbox-photographer')
          );
          localStorage.setItem('fabric_local_connections', JSON.stringify(filtered));
          window.dispatchEvent(new Event('storage'));
        } catch (err) {
          console.error('Failed to delete local connection:', err);
        }
      }
    };

    // Run heartbeat immediately
    performHeartbeat();

    // Set up interval
    const intervalId = setInterval(performHeartbeat, 15000);

    // Setup real-time listener for database fabrics changes
    let channel: any = null;
    if (isConfigured) {
      channel = supabase
        .channel(`capture-fabrics-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'fabrics'
          },
          (payload) => {
            console.log('Realtime change in fabrics table captured:', payload);
            
            // Rejection notification banner trigger
            if (
              payload.eventType === 'UPDATE' &&
              payload.new && 
              payload.new.status === 'discarded' && 
              payload.new.created_by === user?.id &&
              payload.new.session_id === sessionId
            ) {
              setRejectionAlert({
                id: payload.new.id,
                reason: payload.new.rejection_reason || 'Photo quality check failed',
                timestamp: new Date().toISOString()
              });
            }

            fetchSessionFabrics(true);
          }
        )
        .subscribe();
    } else {
      // Sandbox mode storage listener
      const handleStorageUpdate = () => {
        // Handle mock rejections
        const rejectionStr = localStorage.getItem('last_rejection');
        if (rejectionStr) {
          try {
            const parsed = JSON.parse(rejectionStr);
            const dismissedId = localStorage.getItem('last_rejection_dismissed_id');
            if (parsed.id !== dismissedId && parsed.session_id === sessionId) {
              setRejectionAlert(parsed);
            }
          } catch (e) {
            console.error(e);
          }
        }
        fetchSessionFabrics(true);
      };

      window.addEventListener('storage', handleStorageUpdate);
      handleStorageUpdate(); // run initially
    }

    // Unload handler for browser tab closing
    const handleUnload = () => {
      cleanupConnection();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleUnload);
      cleanupConnection();
      if (channel) {
        supabase.removeChannel(channel);
      } else {
        window.removeEventListener('storage', fetchSessionFabrics as any);
      }
    };
  }, [sessionId, user, isConfigured, fetchSessionFabrics]);

  // Revoke preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const triggerCamera = () => {
    if (uploading || !sessionId) return;
    setErrorText('');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedFile(file);
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!sessionId) return;
    setUploading(true);
    setUploadProgress(20);
    setErrorText('');

    try {
      const fileName = `fabric_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;

      if (isConfigured) {
        setUploadProgress(40);
        
        // 1. Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('fabric-images')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        setUploadProgress(70);

        // 2. Get public URL of the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('fabric-images')
          .getPublicUrl(fileName);

        setUploadProgress(85);

        // 3. Insert metadata with session association
        const { error: dbError } = await supabase
          .from('fabrics')
          .insert({
            image_url: publicUrl,
            status: 'pending',
            created_by: user?.id,
            created_by_email: user?.email,
            session_id: sessionId
          });

        if (dbError) {
          throw new Error(`Catalog update failed: ${dbError.message}`);
        }

        setUploadProgress(100);
      } else {
        // --- OFFLINE / LOCAL SANDBOX MODE ---
        setUploadProgress(50);
        await new Promise((resolve) => setTimeout(resolve, 800));

        const randomSeed = Math.floor(Math.random() * 1000);
        const demoImageUrl = `https://picsum.photos/seed/${randomSeed}/800/600`;

        const pendingQueue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        const newRecord = {
          id: `demo-uuid-${Date.now()}`,
          image_url: demoImageUrl,
          name: null,
          qr_code_id: null,
          status: 'pending',
          created_at: new Date().toISOString(),
          created_by_email: 'photographer@company.com',
          session_id: sessionId
        };
        
        pendingQueue.push(newRecord);
        localStorage.setItem('fabric_local_queue', JSON.stringify(pendingQueue));

        window.dispatchEvent(new Event('storage'));

        setUploadProgress(100);
      }

      setSuccess(true);
      const updatedCount = capturedCount + 1;
      setCapturedCount(updatedCount);
      localStorage.setItem(`captured_count_${sessionCode}`, updatedCount.toString());
      setLastUploadedName(file.name);

      setTimeout(() => {
        setSuccess(false);
        setUploadProgress(0);
      }, 1800);

    } catch (err: any) {
      console.error(err);
      setErrorText(err?.message || 'Failed uploading. Verify connection or permissions.');
    } finally {
      setUploading(false);
    }
  };

  // 1. Loading States
  if (authLoading || sessionResolving) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Resolving active session...</span>
        </div>
      </div>
    );
  }

  // 2. Error State: No session or expired session
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
            {errorText || 'Please create or join a collaborative digitization lobby to activate your camera upload feed.'}
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
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans select-none relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-20 pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-100 rounded-full blur-3xl opacity-20 pointer-events-none -ml-20 -mb-20" />

      {/* Top Navigator */}
      <header className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 relative z-10 shadow-xs">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-850 transition-colors py-1.5 font-semibold">
          <ArrowLeft className="h-4 w-4" />
          <span>Exit Workspace</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
            Lobby: {sessionCode.toUpperCase()}
          </span>
        </div>
        {isConfigured && user ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/50">
            <User className="h-3.5 w-3.5" />
            <span className="max-w-[70px] truncate">{user.email?.split('@')[0]}</span>
          </div>
        ) : (
          <div className="h-6 w-6" />
        )}
      </header>

      {/* Main interactive mobile view area */}
      <div className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full relative z-10 overflow-hidden">
        
        {/* TOP ACTION CARD: prominent photo trigger or review options */}
        <div className="shrink-0 mb-4">
          {uploading ? (
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-md text-center space-y-4">
              <div className="relative inline-flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-indigo-650 animate-spin" />
                <span className="absolute text-[10px] font-mono font-bold text-indigo-850">{uploadProgress}%</span>
              </div>
              <p className="text-sm font-bold text-indigo-650">Sending photo to desk...</p>
              <p className="text-xs text-slate-400">Uploading fabric snapshot securely</p>
            </div>
          ) : success ? (
            <div className="bg-white rounded-3xl p-5 border border-emerald-150 bg-emerald-50/10 shadow-md text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto animate-bounce">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Uploaded Successfully!</p>
                {lastUploadedName && (
                  <p className="text-[10px] text-slate-450 mt-1 font-mono max-w-[200px] truncate mx-auto bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
                    {lastUploadedName}
                  </p>
                )}
              </div>
            </div>
          ) : previewUrl ? (
            <div className="bg-white rounded-3xl p-5 border border-indigo-100 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[10px] uppercase font-bold">
                  📷 Review Snapshot
                </span>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-650 font-bold"
                >
                  Cancel
                </button>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white aspect-video relative shadow-inner">
                <img 
                  src={previewUrl} 
                  alt="Fabric Sample Capture Preview" 
                  className="object-cover h-full w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    triggerCamera();
                  }}
                  className="py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  Retake
                </button>
                <button
                  onClick={async () => {
                    if (selectedFile) {
                      const fileToUpload = selectedFile;
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      await uploadPhoto(fileToUpload);
                    }
                  }}
                  className="py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100 border-b-2 border-indigo-805"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={triggerCamera}
                className="w-full py-5 bg-indigo-650 hover:bg-indigo-705 text-white active:scale-98 border-b-4 border-indigo-805 shadow-xl shadow-indigo-150 rounded-2xl flex flex-col justify-center items-center gap-1.5 transition-all cursor-pointer"
              >
                <Camera className="h-7 w-7 text-white" />
                <span className="font-extrabold tracking-wide uppercase text-[11px]">Take Fabric Photo</span>
              </button>
            </div>
          )}
        </div>

        {/* ALERTS: Rejection & Offline notifications */}
        <div className="shrink-0 space-y-3 mb-2">
          {rejectionAlert && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 animate-in slide-in-from-top duration-300 shadow-xs relative">
              <div className="flex items-start justify-between gap-1.5 pr-4">
                <div className="flex gap-2 shrink-0">
                  <Ban className="h-5 w-5 text-rose-550 mt-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-900">Desk rejected a photo</p>
                  <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                    Reason: <strong className="font-bold">&quot;{rejectionAlert.reason}&quot;</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  localStorage.setItem('last_rejection_dismissed_id', rejectionAlert.id);
                  setRejectionAlert(null);
                }}
                className="absolute top-2 right-3 text-stone-400 hover:text-stone-750 p-1 text-[11px] font-bold font-mono cursor-pointer"
                title="Dismiss Alert"
              >
                ✕
              </button>
            </div>
          )}

          {!isConfigured && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-100/60 flex items-start gap-2.5 shadow-2xs">
              <Compass className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Demo Mode (Sandbox)</p>
                <p className="text-[10px] text-amber-700 mt-0.5 leading-normal">
                  Operations sync locally within your browser tab.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* MIDDLE AREA: stack of photos taken (real-time list scroll) */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-1 mb-2 shrink-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">
              Photo Stack ({sessionFabrics.length})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-slate-500 font-bold bg-slate-100 border border-slate-205/60 px-2 py-0.5 rounded">
                Lobby Total: {capturedCount}
              </span>
              <button 
                onClick={() => {
                  setCapturedCount(0);
                  localStorage.removeItem(`captured_count_${sessionCode}`);
                }}
                className="text-[9px] text-slate-400 hover:text-rose-600 font-bold"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 px-0.5 pb-6 scroll-smooth pr-1 scrollbar-thin">
            {loadingFabrics ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-6 w-6 text-indigo-650 animate-spin" />
                <span className="text-xs text-slate-400 font-medium">Syncing photo stack...</span>
              </div>
            ) : sessionFabrics.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-3">
                <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto">
                  <Camera className="h-5 w-5 animate-pulse text-indigo-500" />
                </div>
                <div className="max-w-[200px] mx-auto">
                  <p className="text-xs text-slate-700 font-bold">No photos captured yet</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                    Snap fabric swatches and they will pile up in real-time here.
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {sessionFabrics.map((item, index) => {
                  const dateStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <motion.div
                      key={item.id}
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="bg-white/85 backdrop-blur-sm border border-slate-200/70 rounded-2xl p-3 shadow-2xs hover:shadow-xs transition-shadow flex gap-3 relative overflow-hidden items-center"
                    >
                      {/* Photo Thumbnail */}
                      <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 relative">
                        <img 
                          src={item.image_url} 
                          alt="Captured fabric" 
                          className="object-cover h-full w-full"
                        />
                      </div>

                      {/* Info & Status */}
                      <div className="flex-1 min-w-0 pr-1 flex flex-col justify-between h-16 py-0.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {item.name || `Fabric Photo #${sessionFabrics.length - index}`}
                          </p>
                          <span className="text-[9px] font-mono text-slate-400 font-semibold uppercase tracking-wider shrink-0">
                            {dateStr}
                          </span>
                        </div>

                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <span className="h-1 w-1 bg-amber-500 rounded-full animate-pulse" />
                              Awaiting Review
                            </span>
                          )}
                          {item.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                              Labeled ({item.qr_code_id})
                            </span>
                          )}
                          {item.status === 'discarded' && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                              <Ban className="h-2.5 w-2.5 text-rose-500" />
                              Retake Required
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rejection Overlays or Direct Actions */}
                      {item.status === 'discarded' && (
                        <div className="absolute inset-x-0 bottom-0 bg-rose-600/95 text-white text-[10px] font-medium p-2 rounded-b-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
                          <span className="truncate flex-1">
                            Reason: <strong>{item.rejection_reason || 'Photo glare / blurry'}</strong>
                          </span>
                          <button
                            onClick={() => {
                              // Retake now trigger
                              triggerCamera();
                            }}
                            className="bg-white text-rose-650 hover:bg-rose-50 font-bold px-2 py-1 rounded-lg shrink-0 border border-transparent shadow-xs transition-colors"
                          >
                            Retake Now
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Global error block */}
        {errorText && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-center gap-2 mb-3 shadow-xs shrink-0">
            <AlertCircle className="h-4 w-4 text-rose-550 shrink-0" />
            <p className="font-semibold">{errorText}</p>
          </div>
        )}

        {/* Subtle lobby description footer */}
        <div className="text-center text-[10px] text-slate-400 shrink-0 mt-auto pt-2">
          Digitized samples are synchronized in real-time with the labeling desk.
        </div>
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        id="camera-upload-input"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
    </main>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Initializing scanner interface...</span>
        </div>
      </div>
    }>
      <CapturePageContent />
    </Suspense>
  );
}
