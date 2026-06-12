'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, RefreshCw, AlertCircle, ArrowLeft, Loader2, Compass, Ban, User, LogOut } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';

export default function CapturePage() {
  const { user, loading: authLoading, signOut, isConfigured } = useAuth();
  const [uploading, setUploading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [lastUploadedName, setLastUploadedName] = useState<string>('');
  const [capturedCount, setCapturedCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('captured_today_count');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  const [errorText, setErrorText] = useState<string>('');
  
  // Photo preview states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectionAlert, setRejectionAlert] = useState<{ id: string; reason: string; timestamp: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Revoke preview URL on unmount to prevent resource memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Real-time listener: receive instant alerts when tagging operator rejects snapshots
  useEffect(() => {
    if (isConfigured && user) {
      const channel = supabase
        .channel('capture-db-rejections')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'fabrics'
          },
          (payload) => {
            console.log('Capture subscription update received:', payload);
            if (payload.new && payload.new.status === 'discarded' && payload.new.created_by === user?.id) {
              setRejectionAlert({
                id: payload.new.id,
                reason: payload.new.rejection_reason || 'Photo quality check failed (unsuitable crop / poor lighting)',
                timestamp: new Date().toISOString()
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      const handleStorageUpdate = () => {
        const rejectionStr = localStorage.getItem('last_rejection');
        if (rejectionStr) {
          try {
            const parsed = JSON.parse(rejectionStr);
            const dismissedId = localStorage.getItem('last_rejection_dismissed_id');
            if (parsed.id !== dismissedId) {
              setRejectionAlert(parsed);
            }
          } catch (e) {
            console.error(e);
          }
        }
      };

      window.addEventListener('storage', handleStorageUpdate);
      handleStorageUpdate(); // Sync initially
      return () => {
        window.removeEventListener('storage', handleStorageUpdate);
      };
    }
  }, [isConfigured, user]);

  const triggerCamera = () => {
    if (uploading) return;
    setErrorText('');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setSelectedFile(file);
    
    // Revoke old URL if existing to keep memory footprint low
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    
    // Clear the input value so the same file name can be triggered again easily
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhoto = async (file: File) => {
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

        // 3. Insert metadata, attributing creator to user id
        const { error: dbError } = await supabase
          .from('fabrics')
          .insert({
            image_url: publicUrl,
            status: 'pending',
            created_by: user?.id,
            created_by_email: user?.email
          });

        if (dbError) {
          throw new Error(`Catalog update failed: ${dbError.message}`);
        }

        setUploadProgress(100);
      } else {
        // --- OFFLINE / LOCAL SANDBOX MODE ---
        setUploadProgress(50);
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate latency

        const randomSeed = Math.floor(Math.random() * 1000);
        const demoImageUrl = `https://picsum.photos/seed/${randomSeed}/800/600`;

        const pendingQueue = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        const newRecord = {
          id: `demo-uuid-${Date.now()}`,
          image_url: demoImageUrl,
          name: null,
          qr_code_id: null,
          status: 'pending',
          created_at: new Date().toISOString()
        };
        
        pendingQueue.push(newRecord);
        localStorage.setItem('fabric_local_queue', JSON.stringify(pendingQueue));

        // Dispatch storage event to notify other browser tabs
        window.dispatchEvent(new Event('storage'));

        setUploadProgress(100);
      }

      setSuccess(true);
      const updatedCount = capturedCount + 1;
      setCapturedCount(updatedCount);
      localStorage.setItem('captured_today_count', updatedCount.toString());
      setLastUploadedName(file.name);

      setTimeout(() => {
        setSuccess(false);
        setUploadProgress(0);
      }, 1800);

    } catch (err: any) {
      console.error(err);
      setErrorText(err?.message || 'Failed uploading. Please verify your connection and permissions.');
    } finally {
      setUploading(false);
    }
  };

  // Loading / Auth protection state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-650 animate-spin" />
          <span className="text-xs text-slate-500 font-medium">Loading session...</span>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans select-none relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-20 pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-100 rounded-full blur-3xl opacity-20 pointer-events-none -ml-20 -mb-20" />

      {/* Top Navigator */}
      <header className="px-4 py-3 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 relative z-10">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-850 transition-colors py-1.5 font-semibold">
          <ArrowLeft className="h-4 w-4" />
          <span>Home</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-indigo-650 tracking-wider uppercase">Camera Upload Desk</span>
        </div>
        {isConfigured && user ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/50">
            <User className="h-3.5 w-3.5" />
            <span className="max-w-[80px] truncate">{user.email?.split('@')[0]}</span>
          </div>
        ) : (
          <div className="h-6 w-6" />
        )}
      </header>

      {/* Main interactive mobile view area */}
      <div className="flex-1 flex flex-col justify-between p-6 max-w-md mx-auto w-full relative z-10 animate-panel">
        
        {/* Alerts & Counters */}
        <div className="space-y-4">
          {rejectionAlert && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 animate-in slide-in-from-top duration-300 shadow-sm">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex gap-2 shrink-0">
                  <Ban className="h-5 w-5 text-rose-500 mt-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-900">Image needs to be retaken</p>
                  <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                    Reason: <strong className="font-bold">&quot;{rejectionAlert.reason}&quot;</strong>
                  </p>
                </div>
                <button 
                  onClick={() => {
                    localStorage.setItem('last_rejection_dismissed_id', rejectionAlert.id);
                    setRejectionAlert(null);
                  }}
                  className="text-stone-400 hover:text-stone-700 p-1 text-sm font-bold font-mono cursor-pointer"
                  title="Dismiss alert"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    localStorage.setItem('last_rejection_dismissed_id', rejectionAlert.id);
                    setRejectionAlert(null);
                    triggerCamera();
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-750 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 border-rose-800"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Retake Photo
                </button>
              </div>
            </div>
          )}

          {!isConfigured && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100/60 flex items-start gap-2.5 shadow-xs">
              <Compass className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">Demo Mode (Offline Sandbox)</p>
                <p className="text-[11px] text-amber-700 mt-0.5 font-sans leading-relaxed">
                  Operating without server keys. Using local browser storage.
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex justify-between items-center shadow-xs">
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Uploaded Today</p>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight mt-1">{capturedCount} <span className="text-xs font-normal text-slate-400 font-sans">samples</span></h2>
            </div>
            <button 
              onClick={() => {
                setCapturedCount(0);
                localStorage.removeItem('captured_today_count');
              }}
              className="text-[10px] hover:text-rose-600 text-slate-400 border border-slate-200 hover:border-rose-100 bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors font-semibold cursor-pointer"
            >
              Reset count
            </button>
          </div>
        </div>

        {/* Camera Feed / Photo Preview Stage */}
        <div className="flex-1 flex flex-col justify-center items-center py-8">
          {uploading ? (
            <div className="text-center space-y-4">
              <div className="relative inline-flex items-center justify-center">
                <Loader2 className="h-16 w-16 text-indigo-650 animate-spin" />
                <span className="absolute text-xs font-mono font-bold text-indigo-850">{uploadProgress}%</span>
              </div>
              <p className="text-sm font-bold text-indigo-650">Sending photo to desk...</p>
              <p className="text-xs text-slate-400">Uploading fabric snapshot securely</p>
            </div>
          ) : success ? (
            <div className="text-center space-y-4">
              <div className="h-20 w-20 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">Uploaded Successfully!</p>
                {lastUploadedName && (
                  <p className="text-[10px] text-slate-450 mt-1 font-mono max-w-[200px] truncate mx-auto bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
                    {lastUploadedName}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-slate-400 italic">Ready for next fabric capture</p>
            </div>
          ) : previewUrl ? (
            <div className="text-center space-y-4 max-w-xs w-full">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-[10px] uppercase font-bold">
                📷 Ready to Confirm
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white aspect-square relative shadow-md">
                <img 
                  src={previewUrl} 
                  alt="Fabric Sample Capture Preview" 
                  className="object-cover h-full w-full"
                />
              </div>
              <p className="text-xs text-slate-500 font-medium font-sans">Verify image clarity and lighting before uploading.</p>
            </div>
          ) : (
            <div className="text-center space-y-4 max-w-xs">
              <div className="h-24 w-24 rounded-full bg-slate-100/50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto shadow-inner">
                <Camera className="h-12 w-12 text-slate-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">Place the fabric sample under clean light and point the mobile camera at it.</p>
              </div>
            </div>
          )}

          {errorText && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-center gap-2 max-w-sm">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
              <p className="font-semibold">{errorText}</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="space-y-4">
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

          {previewUrl && !uploading && !success ? (
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  triggerCamera();
                }}
                className="py-4 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
                className="py-4 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-100 border-b-2 border-indigo-805"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Confirm & Upload
              </button>
            </div>
          ) : (
            <button
              onClick={triggerCamera}
              disabled={uploading}
              className={`w-full py-5 rounded-2xl flex flex-col justify-center items-center gap-2 transition-all cursor-pointer shadow-xl ${
                uploading 
                  ? 'bg-slate-100 border border-slate-200 cursor-not-allowed text-slate-400' 
                  : 'bg-indigo-650 hover:bg-indigo-700 text-white active:scale-98 border-b-4 border-indigo-805 shadow-indigo-150'
              }`}
            >
              <Camera className="h-8 w-8 text-white" />
              <span className="font-bold tracking-wide uppercase text-xs">Take Sample Photo</span>
            </button>
          )}

          <p className="text-center text-[10px] text-slate-400">
            Saves securely to your fabric catalog.
          </p>
        </div>
      </div>
    </main>
  );
}
