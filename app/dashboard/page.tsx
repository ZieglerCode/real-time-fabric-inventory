'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Laptop, LogOut, User, Layers, History, QrCode, Plus, UserPlus, ArrowRight, Share2, Clipboard, CheckCircle2, Loader2, Compass, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

interface Session {
  id: string;
  code: string;
  status: 'active' | 'completed';
  created_at: string;
}

export default function DashboardPage() {
  const { user, loading, signOut, isConfigured } = useAuth();
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  
  // Forms state
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // Generate a fun multiplayer-style session code
  const generateSessionCode = () => {
    const materials = ['SILK', 'WOOL', 'LINEN', 'SATIN', 'DENIM', 'COTTON', 'LACE', 'VELVET', 'HEMP', 'NYLON'];
    const material = materials[Math.floor(Math.random() * materials.length)];
    const number = Math.floor(10 + Math.random() * 90); // 2 digit number
    return `${material}-${number}`;
  };

  // Fetch active sessions from DB
  const fetchSessions = async () => {
    if (!isConfigured) {
      // Offline fallback: load mock sessions from localStorage
      const mock = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
      setActiveSessions(mock.filter((s: Session) => s.status === 'active'));
      return;
    }

    if (!user) return;

    setSessionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setActiveSessions(data || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchSessions();
      
      // Load current session if stored
      const savedCode = localStorage.getItem('ziegler_active_session_code');
      const savedId = localStorage.getItem('ziegler_active_session_id');
      if (savedCode && savedId) {
        setCurrentSession({
          id: savedId,
          code: savedCode,
          status: 'active',
          created_at: new Date().toISOString()
        });
      }
    }
  }, [loading, user]);

  const handleCreateSession = async () => {
    setCreating(true);
    setErrorText('');
    const code = generateSessionCode();

    try {
      if (isConfigured) {
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            code: code,
            status: 'active'
          })
          .select()
          .single();

        if (error) throw error;

        const newSession = data as Session;
        setCurrentSession(newSession);
        localStorage.setItem('ziegler_active_session_code', newSession.code);
        localStorage.setItem('ziegler_active_session_id', newSession.id);
      } else {
        // Mock offline session creation
        const mockSession: Session = {
          id: `mock-session-${Date.now()}`,
          code: code,
          status: 'active',
          created_at: new Date().toISOString()
        };
        const local = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        local.push(mockSession);
        localStorage.setItem('fabric_local_sessions', JSON.stringify(local));
        
        setCurrentSession(mockSession);
        localStorage.setItem('ziegler_active_session_code', mockSession.code);
        localStorage.setItem('ziegler_active_session_id', mockSession.id);
      }
      
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to create active session.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoining(true);
    setErrorText('');
    const codeToSearch = joinCode.trim().toUpperCase();

    try {
      if (isConfigured) {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', codeToSearch)
          .eq('status', 'active')
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new Error(`Active session code "${codeToSearch}" not found.`);
        }

        const matchedSession = data as Session;
        setCurrentSession(matchedSession);
        localStorage.setItem('ziegler_active_session_code', matchedSession.code);
        localStorage.setItem('ziegler_active_session_id', matchedSession.id);
      } else {
        // Mock offline session matching
        const local: Session[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        const found = local.find(s => s.code === codeToSearch && s.status === 'active');
        
        if (!found) {
          throw new Error(`Active session code "${codeToSearch}" not found locally.`);
        }

        setCurrentSession(found);
        localStorage.setItem('ziegler_active_session_code', found.code);
        localStorage.setItem('ziegler_active_session_id', found.id);
      }

      setJoinCode('');
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Lobby join failed.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveSession = () => {
    setCurrentSession(null);
    localStorage.removeItem('ziegler_active_session_code');
    localStorage.removeItem('ziegler_active_session_id');
  };

  const handleArchiveSession = async () => {
    if (!currentSession) return;
    if (!confirm('Are you sure you want to archive and close this session? Co-workers will no longer be able to select roles in it.')) return;

    try {
      if (isConfigured) {
        const { error } = await supabase
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', currentSession.id);

        if (error) throw error;
      } else {
        const local: Session[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        const updated = local.map(s => s.id === currentSession.id ? { ...s, status: 'completed' } as Session : s);
        localStorage.setItem('fabric_local_sessions', JSON.stringify(updated));
      }

      handleLeaveSession();
      fetchSessions();
    } catch (err: any) {
      console.error(err);
      alert('Failed to archive session.');
    }
  };

  const handleCopyCode = () => {
    if (!currentSession) return;
    navigator.clipboard.writeText(currentSession.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-indigo-650 animate-spin" />
          <span className="text-sm font-medium text-slate-500">Loading profile...</span>
        </div>
      </div>
    );
  }

  // Auth Guard
  if (isConfigured && !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-sm font-medium text-slate-500">Redirecting...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-30 pointer-events-none -mr-40 -mt-40" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-30 pointer-events-none -ml-40 -mb-40" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        {/* Navigation / Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-5 w-5 text-indigo-650" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                Session Control Center
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              Digitization Lobbies
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Create or join an active inventory cataloging session to collaborate in real-time with other users.
            </p>
          </div>

          {/* User profile */}
          <div className="mt-6 md:mt-0 flex items-center gap-4 bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-650">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 truncate max-w-[160px]">
                  {user ? user.email : 'Sandbox Mode'}
                </p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {isConfigured ? 'Authenticated' : 'Offline Mode'}
                </p>
              </div>
            </div>
            {isConfigured && (
              <button
                onClick={signOut}
                className="h-9 w-9 rounded-xl border border-slate-200 hover:border-rose-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>

        {currentSession ? (
          /* SECTION: INSIDE A SESSION (Choose Role) */
          <div className="max-w-4xl mx-auto space-y-8 animate-panel">
            {/* Active Session Code Card */}
            <div className="bg-white rounded-3xl border border-indigo-200 p-8 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Current Digitization Lobby</p>
              
              <div className="mt-3 flex items-center justify-center gap-3">
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{currentSession.code}</h2>
                <button
                  onClick={handleCopyCode}
                  className="h-10 w-10 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                  title="Copy session code"
                >
                  {copied ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Clipboard className="h-5 w-5" />}
                </button>
              </div>
              
              <p className="text-xs text-slate-500 mt-3 max-w-sm mx-auto">
                Share this lobby code with your partner. One user can join as the photographer on mobile, and the other as the tagger on desktop!
              </p>

              <div className="mt-6 flex justify-center gap-4 border-t border-slate-100 pt-6">
                <button
                  onClick={handleLeaveSession}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Leave Lobby
                </button>
                <button
                  onClick={handleArchiveSession}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 border border-rose-100 hover:bg-rose-50 px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Close & Archive Session
                </button>
              </div>
            </div>

            {/* Choose Role Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Role 1: Mobile Scanner */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 group-hover:scale-105 transition-transform">
                      <Camera className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
                      Role 1
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Mobile Scanner</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">
                    Open this on your mobile device. Take pictures of physical fabric samples to add them to this lobby's indexing queue.
                  </p>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href={`/capture?session=${currentSession.code}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-150 transition-all cursor-pointer group-hover:gap-3 border-b-2 border-indigo-805"
                  >
                    <span>Join as Photographer</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Role 2: Desktop Tagger */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-650 group-hover:scale-105 transition-transform">
                      <Laptop className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-bold text-violet-750 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100 uppercase tracking-wider">
                      Role 2
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Desktop Desk</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">
                    Open this on your desktop. Review incoming fabric photos for this lobby, assign catalog names, and print barcode stickers.
                  </p>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href={`/tagging?session=${currentSession.code}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-violet-600 hover:bg-violet-550 text-white rounded-2xl font-bold shadow-lg shadow-violet-150 transition-all cursor-pointer group-hover:gap-3 border-b-2 border-violet-800"
                  >
                    <span>Join as Tagger</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SECTION: OUTSIDE A SESSION (Manage Lobbies) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-panel">
            {/* Left Column: Create or Join Session */}
            <div className="lg:col-span-5 space-y-6">
              {/* Form card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-sm space-y-6">
                
                {errorText && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <span>{errorText}</span>
                  </div>
                )}

                {/* Create Section */}
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="h-5 w-5 text-indigo-650" /> Start a New Session
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create a new digitization room. We will generate a unique lobby code that you can share with your team.
                  </p>
                  <button
                    onClick={handleCreateSession}
                    disabled={creating}
                    className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-md shadow-indigo-150 transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-indigo-805"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Lobby Room</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="border-t border-slate-100 my-6" />

                {/* Join Section */}
                <form onSubmit={handleJoinSession} className="space-y-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-indigo-650" /> Join Existing Session
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter the lobby code provided by your co-worker to participate in their active workspace.
                  </p>
                  
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="e.g. SILK-12"
                      required
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-semibold text-slate-900 focus:bg-white text-sm text-center uppercase tracking-wider"
                      disabled={joining}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={joining || !joinCode.trim()}
                    className={`w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-slate-950 ${
                      joining || !joinCode.trim() ? 'opacity-55 cursor-not-allowed shadow-none' : ''
                    }`}
                  >
                    {joining ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <span>Join Lobby</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

              </div>
            </div>

            {/* Right Column: Active Session Feed */}
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 border border-slate-200/40">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Active Lobbies
                    </h3>
                    <p className="text-xs text-slate-400">Collaborative sessions currently running</p>
                  </div>
                </div>
                <button
                  onClick={fetchSessions}
                  disabled={sessionsLoading}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-650 hover:text-indigo-805 font-semibold transition-all cursor-pointer py-1.5 px-3 bg-indigo-50 border border-indigo-100 rounded-lg"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              {!isConfigured && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100/60 flex items-start gap-2.5 text-xs text-amber-800 leading-relaxed shadow-xs">
                  <Compass className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Sandbox Active:</span> Local mocks are stored in your browser session. Open multiple tabs on localhost to simulate team collaborations!
                  </div>
                </div>
              )}

              {activeSessions.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm font-medium">
                  No active lobbies found. Start cataloging by creating a new session!
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 rounded-2xl border border-slate-150 hover:border-indigo-100 hover:bg-indigo-50/10 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-50 border border-indigo-100/50 rounded-xl flex items-center justify-center text-indigo-700 font-bold">
                          #
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-slate-800 uppercase tracking-wide">{session.code}</p>
                          <p className="text-[10px] text-slate-450 font-mono">Created: {new Date(session.created_at).toLocaleDateString()} {new Date(session.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setCurrentSession(session);
                          localStorage.setItem('ziegler_active_session_code', session.code);
                          localStorage.setItem('ziegler_active_session_id', session.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-650 hover:text-indigo-805 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        <span>Select Roles</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
