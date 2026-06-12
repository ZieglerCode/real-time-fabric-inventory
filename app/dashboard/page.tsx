'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Laptop, LogOut, User, Layers, History, QrCode, Plus, UserPlus, ArrowRight, Share2, Clipboard, CheckCircle2, Loader2, Compass, AlertCircle, RefreshCw, Users, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

interface Team {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

interface Session {
  id: string;
  code: string;
  team_id: string;
  status: 'active' | 'completed';
  created_at: string;
  team_name?: string; // Hydrated field
}

interface Connection {
  session_id: string;
  user_id: string;
  user_email: string;
  role: 'photographer' | 'tagger';
  last_seen_at: string;
}

export default function DashboardPage() {
  const { user, loading, signOut, isConfigured } = useAuth();
  
  // Teams & Sessions lists
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [sessionConnections, setSessionConnections] = useState<Connection[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Track teams in a ref to avoid stale closures inside polling intervals
  const teamsRef = useRef<Team[]>([]);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);
  
  // Selected state
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  
  // Forms state
  const [teamName, setTeamName] = useState('');
  const [teamInviteCode, setTeamInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [joiningSession, setJoiningSession] = useState(false);
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null);
  const [copiedSessionCode, setCopiedSessionCode] = useState<string | null>(null);
  
  const [errorText, setErrorText] = useState('');
  const router = useRouter();

  // Generate a short user-friendly code
  const generateCode = (prefix: string) => {
    const number = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${number}`.toUpperCase();
  };

  const loadDashboardData = async (silent = false) => {
    if (!isConfigured) {
      // --- OFFLINE MOCK MODE ---
      const localTeams: Team[] = JSON.parse(localStorage.getItem('fabric_local_teams') || '[]');
      const localMembers = JSON.parse(localStorage.getItem('fabric_local_team_members') || '[]');
      const localSessions: Session[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
      const localConnections: Connection[] = JSON.parse(localStorage.getItem('fabric_local_connections') || '[]');

      // Filter teams joined by user (user_id = 'sandbox')
      const joinedTeamIds = localMembers
        .filter((m: any) => m.user_id === 'sandbox')
        .map((m: any) => m.team_id);
      
      const userJoinedTeams = localTeams.filter(t => joinedTeamIds.includes(t.id));
      setTeams(userJoinedTeams);

      // Hydrate sessions with team names
      const activeLobbies = localSessions
        .filter(s => s.status === 'active' && joinedTeamIds.includes(s.team_id))
        .map(s => ({
          ...s,
          team_name: localTeams.find(t => t.id === s.team_id)?.name || 'Local Team'
        }));
      setActiveSessions(activeLobbies);

      // Set connections (only active in the last 30s)
      const now = Date.now();
      const activeConns = localConnections.filter(c => new Date(c.last_seen_at).getTime() > now - 30 * 1000);
      setSessionConnections(activeConns);

      setDashboardLoading(false);
      return;
    }

    if (!user) return;

    if (!silent) setDashboardLoading(true);
    setErrorText('');

    try {
      // 1. Fetch joined teams
      const { data: userMemberships, error: memberErr } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (memberErr) throw memberErr;

      const teamIds = userMemberships?.map(m => m.team_id) || [];

      if (teamIds.length === 0) {
        setTeams([]);
        setActiveSessions([]);
        setSessionConnections([]);
        setDashboardLoading(false);
        return;
      }

      // 2. Fetch teams metadata
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('name', { ascending: true });

      if (teamsErr) throw teamsErr;
      setTeams(teamsData || []);

      // 3. Fetch active sessions for those teams
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('sessions')
        .select('*')
        .in('team_id', teamIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (sessionsErr) throw sessionsErr;

      // Hydrate session team names manually or by mapping
      const hydratedSessions = (sessionsData || []).map(session => {
        const teamObj = (teamsData || []).find(t => t.id === session.team_id);
        return {
          ...session,
          team_name: teamObj ? teamObj.name : 'Unknown Team'
        };
      });
      setActiveSessions(hydratedSessions);

      // 4. Fetch all active session connections (seen in last 30s)
      const timeThreshold = new Date(Date.now() - 30 * 1000).toISOString();
      const { data: connsData, error: connsErr } = await supabase
        .from('session_connections')
        .select('*')
        .gt('last_seen_at', timeThreshold);

      if (connsErr) throw connsErr;
      setSessionConnections(connsData || []);

    } catch (err: any) {
      console.error('Error loading dashboard:', err);
      setErrorText('Failed to sync dashboard details.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const pollActiveLobbies = async () => {
    if (!isConfigured) {
      // Offline sandbox mock
      const localTeams: Team[] = JSON.parse(localStorage.getItem('fabric_local_teams') || '[]');
      const localMembers = JSON.parse(localStorage.getItem('fabric_local_team_members') || '[]');
      const localSessions: Session[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
      const localConnections: Connection[] = JSON.parse(localStorage.getItem('fabric_local_connections') || '[]');

      const joinedTeamIds = localMembers
        .filter((m: any) => m.user_id === 'sandbox')
        .map((m: any) => m.team_id);

      const activeLobbies = localSessions
        .filter(s => s.status === 'active' && joinedTeamIds.includes(s.team_id))
        .map(s => ({
          ...s,
          team_name: localTeams.find(t => t.id === s.team_id)?.name || 'Local Team'
        }));
      setActiveSessions(activeLobbies);

      const now = Date.now();
      const activeConns = localConnections.filter(c => new Date(c.last_seen_at).getTime() > now - 30 * 1000);
      setSessionConnections(activeConns);
      return;
    }

    if (!user) return;

    try {
      const currentTeams = teamsRef.current;
      const teamIds = currentTeams.map(t => t.id);
      if (teamIds.length === 0) return;

      // 1. Fetch active sessions for those teams
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('sessions')
        .select('*')
        .in('team_id', teamIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (sessionsErr) throw sessionsErr;

      const hydratedSessions = (sessionsData || []).map(session => {
        const teamObj = currentTeams.find(t => t.id === session.team_id);
        return {
          ...session,
          team_name: teamObj ? teamObj.name : 'Unknown Team'
        };
      });
      setActiveSessions(hydratedSessions);

      // 2. Fetch all active session connections (seen in last 30s)
      const timeThreshold = new Date(Date.now() - 30 * 1000).toISOString();
      const { data: connsData, error: connsErr } = await supabase
        .from('session_connections')
        .select('*')
        .gt('last_seen_at', timeThreshold);

      if (connsErr) throw connsErr;
      setSessionConnections(connsData || []);
    } catch (err) {
      console.error('Error polling active lobbies:', err);
    }
  };

  useEffect(() => {
    if (!loading) {
      loadDashboardData(false);

      let mockTimer: any;
      let cleanupTimer: any;
      let sessionsChannel: any;
      let connsChannel: any;

      if (!isConfigured) {
        // Poll active lobbies and user connections every 5 seconds silently in sandbox
        mockTimer = setInterval(() => {
          pollActiveLobbies();
        }, 5000);
      } else {
        // Real-time connections cleanup (sweep stale entries every 10s locally)
        cleanupTimer = setInterval(() => {
          const threshold = Date.now() - 30 * 1000;
          setSessionConnections(prev => 
            prev.filter(c => new Date(c.last_seen_at).getTime() > threshold)
          );
        }, 10000);

        // Realtime Postgres changes listener for sessions
        sessionsChannel = supabase
          .channel('realtime-sessions')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'sessions' },
            (payload) => {
              const newSession = payload.new as Session;
              const oldSession = payload.old as Session;
              
              if (payload.eventType === 'INSERT') {
                const teamObj = teamsRef.current.find(t => t.id === newSession.team_id);
                if (teamObj && newSession.status === 'active') {
                  const hydrated = { ...newSession, team_name: teamObj.name };
                  setActiveSessions(prev => {
                    if (prev.some(s => s.id === newSession.id)) return prev;
                    return [hydrated, ...prev];
                  });
                }
              } else if (payload.eventType === 'UPDATE') {
                if (newSession.status !== 'active') {
                  setActiveSessions(prev => prev.filter(s => s.id !== newSession.id));
                } else {
                  const teamObj = teamsRef.current.find(t => t.id === newSession.team_id);
                  const hydrated = { ...newSession, team_name: teamObj?.name || 'Unknown Team' };
                  setActiveSessions(prev => prev.map(s => s.id === newSession.id ? hydrated : s));
                }
              } else if (payload.eventType === 'DELETE') {
                setActiveSessions(prev => prev.filter(s => s.id !== oldSession.id));
              }
            }
          )
          .subscribe();

        // Realtime Postgres changes listener for connections (heartbeats)
        connsChannel = supabase
          .channel('realtime-connections')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'session_connections' },
            (payload) => {
              const newConn = payload.new as Connection;
              const oldConn = payload.old as Connection;

              if (payload.eventType === 'INSERT') {
                setSessionConnections(prev => {
                  if (prev.some(c => c.user_id === newConn.user_id && c.session_id === newConn.session_id)) {
                    // Update connection if already present
                    return prev.map(c => (c.user_id === newConn.user_id && c.session_id === newConn.session_id) ? newConn : c);
                  }
                  return [...prev, newConn];
                });
              } else if (payload.eventType === 'UPDATE') {
                setSessionConnections(prev => {
                  if (prev.some(c => c.user_id === newConn.user_id && c.session_id === newConn.session_id)) {
                    return prev.map(c => (c.user_id === newConn.user_id && c.session_id === newConn.session_id) ? newConn : c);
                  }
                  return [...prev, newConn];
                });
              } else if (payload.eventType === 'DELETE') {
                setSessionConnections(prev => prev.filter(c => !(c.user_id === oldConn.user_id && c.session_id === oldConn.session_id)));
              }
            }
          )
          .subscribe();
      }

      // Load active session from local storage if saved
      const savedCode = localStorage.getItem('ziegler_active_session_code');
      const savedId = localStorage.getItem('ziegler_active_session_id');
      const savedTeamId = localStorage.getItem('ziegler_active_session_team_id');
      if (savedCode && savedId && savedTeamId) {
        setSelectedSession({
          id: savedId,
          code: savedCode,
          team_id: savedTeamId,
          status: 'active',
          created_at: new Date().toISOString()
        });
      }

      return () => {
        if (mockTimer) clearInterval(mockTimer);
        if (cleanupTimer) clearInterval(cleanupTimer);
        if (sessionsChannel) supabase.removeChannel(sessionsChannel);
        if (connsChannel) supabase.removeChannel(connsChannel);
      };
    }
  }, [loading, user, isConfigured]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setCreatingTeam(true);
    setErrorText('');
    const code = generateCode(teamName.trim().substring(0, 4).toUpperCase());

    try {
      if (isConfigured) {
        // 1. Insert Team
        const { data: teamData, error: teamErr } = await supabase
          .from('teams')
          .insert({
            name: teamName.trim(),
            invite_code: code,
            created_by: user?.id
          })
          .select()
          .single();

        if (teamErr) throw teamErr;

        // 2. Insert Membership
        const { error: memberErr } = await supabase
          .from('team_members')
          .insert({
            team_id: teamData.id,
            user_id: user?.id,
            role: 'admin'
          });

        if (memberErr) throw memberErr;
      } else {
        // Offline sandbox mock
        const newTeam: Team = {
          id: `mock-team-${Date.now()}`,
          name: teamName.trim(),
          invite_code: code,
          created_at: new Date().toISOString()
        };
        const localTeams = JSON.parse(localStorage.getItem('fabric_local_teams') || '[]');
        localTeams.push(newTeam);
        localStorage.setItem('fabric_local_teams', JSON.stringify(localTeams));

        const localMembers = JSON.parse(localStorage.getItem('fabric_local_team_members') || '[]');
        localMembers.push({ team_id: newTeam.id, user_id: 'sandbox', role: 'admin' });
        localStorage.setItem('fabric_local_team_members', JSON.stringify(localMembers));
      }

      setTeamName('');
      loadDashboardData(true);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to create team.');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamInviteCode.trim()) return;

    setJoiningTeam(true);
    setErrorText('');
    const codeToSearch = teamInviteCode.trim().toUpperCase();

    try {
      if (isConfigured) {
        // Find team
        const { data: teamData, error: teamErr } = await supabase
          .from('teams')
          .select('*')
          .eq('invite_code', codeToSearch)
          .maybeSingle();

        if (teamErr) throw teamErr;
        if (!teamData) throw new Error(`Team with invite code "${codeToSearch}" not found.`);

        // Insert membership
        const { error: memberErr } = await supabase
          .from('team_members')
          .insert({
            team_id: teamData.id,
            user_id: user?.id,
            role: 'member'
          });

        if (memberErr) {
          if (memberErr.code === '23505') {
            throw new Error('You are already a member of this team.');
          }
          throw memberErr;
        }
      } else {
        // Offline sandbox mock
        const localTeams: Team[] = JSON.parse(localStorage.getItem('fabric_local_teams') || '[]');
        const matched = localTeams.find(t => t.invite_code === codeToSearch);
        
        if (!matched) throw new Error(`Team with invite code "${codeToSearch}" not found.`);

        const localMembers = JSON.parse(localStorage.getItem('fabric_local_team_members') || '[]');
        const exists = localMembers.some((m: any) => m.team_id === matched.id && m.user_id === 'sandbox');
        
        if (exists) throw new Error('You are already a member of this team.');
        
        localMembers.push({ team_id: matched.id, user_id: 'sandbox', role: 'member' });
        localStorage.setItem('fabric_local_team_members', JSON.stringify(localMembers));
      }

      setTeamInviteCode('');
      loadDashboardData(true);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to join team.');
    } finally {
      setJoiningTeam(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;

    setCreatingSession(true);
    setErrorText('');
    const code = generateCode('LOBBY');

    try {
      if (isConfigured) {
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            code: code,
            team_id: selectedTeamId,
            status: 'active'
          })
          .select()
          .single();

        if (error) throw error;

        const newSession = data as Session;
        setSelectedSession(newSession);
        localStorage.setItem('ziegler_active_session_code', newSession.code);
        localStorage.setItem('ziegler_active_session_id', newSession.id);
        localStorage.setItem('ziegler_active_session_team_id', newSession.team_id);
      } else {
        // Mock session
        const newSession: Session = {
          id: `mock-session-${Date.now()}`,
          code: code,
          team_id: selectedTeamId,
          status: 'active',
          created_at: new Date().toISOString()
        };
        const local = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        local.push(newSession);
        localStorage.setItem('fabric_local_sessions', JSON.stringify(local));

        setSelectedSession(newSession);
        localStorage.setItem('ziegler_active_session_code', newSession.code);
        localStorage.setItem('ziegler_active_session_id', newSession.id);
        localStorage.setItem('ziegler_active_session_team_id', newSession.team_id);
      }

      setSelectedTeamId('');
      loadDashboardData(true);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to create session.');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    setJoiningSession(true);
    setErrorText('');
    const codeToSearch = joinCode.trim().toUpperCase();

    try {
      // Fetch joined team IDs
      const joinedTeamIds = teams.map(t => t.id);

      if (isConfigured) {
        const { data, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('code', codeToSearch)
          .eq('status', 'active')
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error(`Lobby "${codeToSearch}" not found or inactive.`);
        
        // Scope verification
        if (!joinedTeamIds.includes(data.team_id)) {
          throw new Error('You do not belong to the team hosting this session. Please join their team first.');
        }

        const matchedSession = data as Session;
        setSelectedSession(matchedSession);
        localStorage.setItem('ziegler_active_session_code', matchedSession.code);
        localStorage.setItem('ziegler_active_session_id', matchedSession.id);
        localStorage.setItem('ziegler_active_session_team_id', matchedSession.team_id);
      } else {
        // Mock offline session join
        const local: Session[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        const found = local.find(s => s.code === codeToSearch && s.status === 'active');
        
        if (!found) throw new Error(`Lobby "${codeToSearch}" not found.`);
        if (!joinedTeamIds.includes(found.team_id)) {
          throw new Error('You do not belong to the team hosting this session.');
        }

        setSelectedSession(found);
        localStorage.setItem('ziegler_active_session_code', found.code);
        localStorage.setItem('ziegler_active_session_id', found.id);
        localStorage.setItem('ziegler_active_session_team_id', found.team_id);
      }

      setJoinCode('');
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Failed to join session.');
    } finally {
      setJoiningSession(false);
    }
  };

  const handleLeaveSession = () => {
    setSelectedSession(null);
    localStorage.removeItem('ziegler_active_session_code');
    localStorage.removeItem('ziegler_active_session_id');
    localStorage.removeItem('ziegler_active_session_team_id');
  };

  const handleArchiveSession = async () => {
    if (!selectedSession) return;
    if (!confirm('Are you sure you want to archive and close this session? Co-workers will no longer be able to select roles in it.')) return;

    try {
      if (isConfigured) {
        const { error } = await supabase
          .from('sessions')
          .update({ status: 'completed' })
          .eq('id', selectedSession.id);

        if (error) throw error;
      } else {
        const local: Session[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        const updated = local.map(s => s.id === selectedSession.id ? { ...s, status: 'completed' } as Session : s);
        localStorage.setItem('fabric_local_sessions', JSON.stringify(updated));
      }

      handleLeaveSession();
      loadDashboardData(true);
    } catch (err: any) {
      console.error(err);
      alert('Failed to archive session.');
    }
  };

  const handleCopyTeamInvite = (teamId: string, inviteCode: string) => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedTeamId(teamId);
    setTimeout(() => setCopiedTeamId(null), 2000);
  };

  const handleCopySessionCode = () => {
    if (!selectedSession) return;
    navigator.clipboard.writeText(selectedSession.code);
    setCopiedSessionCode(selectedSession.code);
    setTimeout(() => setCopiedSessionCode(null), 2000);
  };

  // Group connection stats for dashboard lists
  const getSessionConnectionsCount = (sessId: string) => {
    const activeConns = sessionConnections.filter(c => c.session_id === sessId);
    const photographers = activeConns.filter(c => c.role === 'photographer').length;
    const taggers = activeConns.filter(c => c.role === 'tagger').length;
    return {
      total: activeConns.length,
      photographers,
      taggers
    };
  };

  // Determine if active session already has a tagger connected (excluding current user)
  const isTaggerOccupied = (sessId: string) => {
    return sessionConnections.some(
      c => c.session_id === sessId && c.role === 'tagger' && c.user_id !== (user?.id || 'sandbox')
    );
  };

  if (loading || dashboardLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-indigo-650 animate-spin" />
          <span className="text-sm font-medium text-slate-500">Syncing lobby browser...</span>
        </div>
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
              Lobby & Team Browser
            </h1>
            <p className="mt-2 text-sm text-slate-500 max-w-xl">
              Join teams, invite co-workers, and connect to active fabric cataloging lobbies with live player queues.
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

        {errorText && (
          <div className="max-w-4xl mx-auto mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-start gap-2.5 shadow-xs animate-panel">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorText}</span>
          </div>
        )}

        {selectedSession ? (
          /* SECTION A: INSIDE A SESSION (Choose Role with Occupancy limit check) */
          <div className="max-w-4xl mx-auto space-y-8 animate-panel">
            {/* Active Session Code Card */}
            <div className="bg-white rounded-3xl border border-indigo-200 p-8 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
              <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Current Digitization Lobby</p>
              
              <div className="mt-3 flex items-center justify-center gap-3">
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{selectedSession.code}</h2>
                <button
                  onClick={handleCopySessionCode}
                  className="h-10 w-10 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                  title="Copy session code"
                >
                  {copiedSessionCode ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Clipboard className="h-5 w-5" />}
                </button>
              </div>
              
              <p className="text-xs text-slate-500 mt-3 max-w-sm mx-auto">
                Share this lobby code with your team. Only one user can join as the Tagger (Desktop), but multiple users can upload as Photographers (Mobile)!
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
              {/* Role 1: Mobile Scanner (Multiple allowed) */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650 group-hover:scale-105 transition-transform">
                      <Camera className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 uppercase tracking-wider">
                      Role 1: Mobile (unlimited)
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Mobile Scanner</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">
                    Open this on your mobile device. Take pictures of physical fabric samples to add them to this lobby's indexing queue.
                  </p>
                  <div className="text-xs text-indigo-650 font-semibold bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100/35">
                    Active Photographers in Lobby: {getSessionConnectionsCount(selectedSession.id).photographers}
                  </div>
                </div>
                <div className="p-8 pt-0">
                  <Link
                    href={`/capture?session=${selectedSession.code}`}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-indigo-650 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-150 transition-all cursor-pointer group-hover:gap-3 border-b-2 border-indigo-805"
                  >
                    <span>Join as Photographer</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Role 2: Desktop Tagger (Limit: 1 active) */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden flex flex-col justify-between">
                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-650 group-hover:scale-105 transition-transform">
                      <Laptop className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-bold text-violet-750 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100 uppercase tracking-wider">
                      Role 2: Desktop (1 max)
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Desktop Desk</h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">
                    Open this on your desktop. Review incoming fabric photos for this lobby, assign catalog names, and print barcode stickers.
                  </p>
                  
                  {isTaggerOccupied(selectedSession.id) ? (
                    <div className="text-xs text-rose-700 font-semibold bg-rose-50 p-3.5 rounded-xl border border-rose-100 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                      <span>Slot occupied by another Desktop Tagger.</span>
                    </div>
                  ) : (
                    <div className="text-xs text-violet-650 font-semibold bg-violet-50/50 p-3.5 rounded-xl border border-violet-100/35">
                      Tagger Desk status: Available (0/1 active)
                    </div>
                  )}
                </div>
                <div className="p-8 pt-0">
                  {isTaggerOccupied(selectedSession.id) ? (
                    <button
                      disabled
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl font-bold cursor-not-allowed"
                    >
                      <span>Tagger Slot Full</span>
                    </button>
                  ) : (
                    <Link
                      href={`/tagging?session=${selectedSession.code}`}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-violet-600 hover:bg-violet-550 text-white rounded-2xl font-bold shadow-lg shadow-violet-150 transition-all cursor-pointer group-hover:gap-3 border-b-2 border-violet-800"
                    >
                      <span>Join as Tagger</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* SECTION B: OUTSIDE A SESSION (Lobby & Team browser) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-panel">
            
            {/* Left Panel: Teams management */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Join or Create Team Form */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-6">
                
                {/* Create Team Form */}
                <form onSubmit={handleCreateTeam} className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Plus className="h-4 w-4 text-indigo-650" /> Create a Team
                  </h3>
                  <input
                    type="text"
                    placeholder="e.g. Ziegler Europe"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-semibold text-slate-900 focus:bg-white text-xs"
                    disabled={creatingTeam}
                  />
                  <button
                    type="submit"
                    disabled={creatingTeam || !teamName.trim()}
                    className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-b border-indigo-850"
                  >
                    {creatingTeam ? 'Creating...' : 'Create Team'}
                  </button>
                </form>

                <div className="border-t border-slate-100 my-4" />

                {/* Join Team Form */}
                <form onSubmit={handleJoinTeam} className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="h-4 w-4 text-indigo-650" /> Join a Team
                  </h3>
                  <input
                    type="text"
                    placeholder="Invite Code (e.g. ZIEG-102)"
                    required
                    value={teamInviteCode}
                    onChange={(e) => setTeamInviteCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-semibold text-slate-900 focus:bg-white text-xs uppercase text-center tracking-wider"
                    disabled={joiningTeam}
                  />
                  <button
                    type="submit"
                    disabled={joiningTeam || !teamInviteCode.trim()}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-b border-slate-950"
                  >
                    {joiningTeam ? 'Joining...' : 'Join Team'}
                  </button>
                </form>

              </div>

              {/* Joined Teams list */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
                <h3 className="text-xs uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>My Teams ({teams.length})</span>
                </h3>

                {teams.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No teams joined yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto pr-1">
                    {teams.map((t) => (
                      <div key={t.id} className="py-3 flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 truncate">{t.name}</p>
                          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider mt-0.5">Invite: {t.invite_code}</p>
                        </div>
                        <button
                          onClick={() => handleCopyTeamInvite(t.id, t.invite_code)}
                          className="shrink-0 text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg text-slate-500 hover:text-slate-800 font-semibold transition-all cursor-pointer"
                        >
                          {copiedTeamId === t.id ? 'Copied!' : 'Copy Code'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Panel: Game Server Browser for Lobbies */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 flex flex-col justify-between">
              
              {/* Header inside server browser */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <Laptop className="h-5 w-5 text-indigo-650" /> Active Session Browser
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Click join to choose your workspace role in a lobby</p>
                </div>
                
                {/* Search / Join direct input */}
                <form onSubmit={handleJoinSession} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Lobby Code"
                    required
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider text-center w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    Join
                  </button>
                </form>
              </div>

              {/* Lobbies Server Browser list */}
              <div className="flex-1 min-h-[200px] overflow-y-auto space-y-3">
                {activeSessions.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm font-medium space-y-4">
                    <p>No active lobbies found inside your teams.</p>
                    {teams.length > 0 && (
                      <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl max-w-sm mx-auto text-left space-y-3">
                        <p className="text-[11px] font-bold text-slate-700">Start the first lobby session:</p>
                        <form onSubmit={handleCreateSession} className="space-y-3.5">
                          <select
                            required
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="">-- Choose Hosting Team --</option>
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            disabled={creatingSession || !selectedTeamId}
                            className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            {creatingSession ? 'Creating...' : '+ Create Active Lobby'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View (md screens and wider) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider pb-2">
                            <th className="pb-3">Lobby Code</th>
                            <th className="pb-3">Hosting Team</th>
                            <th className="pb-3 text-center">Occupants (Heartbeats)</th>
                            <th className="pb-3 text-right pr-4">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {activeSessions.map((session) => {
                            const stats = getSessionConnectionsCount(session.id);
                            return (
                              <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-4 font-mono font-bold text-slate-800 uppercase tracking-wide">
                                  {session.code}
                                </td>
                                <td className="py-4 font-semibold text-slate-500">
                                  {session.team_name}
                                </td>
                                <td className="py-4 text-center">
                                  <div className="inline-flex items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${stats.photographers > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                      📷 {stats.photographers}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${stats.taggers > 0 ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                      💻 {stats.taggers}/1
                                    </span>
                                  </div>
                                </td>
                                <td className="py-4 text-right pr-4">
                                  <button
                                    onClick={() => {
                                      setSelectedSession(session);
                                      localStorage.setItem('ziegler_active_session_code', session.code);
                                      localStorage.setItem('ziegler_active_session_id', session.id);
                                      localStorage.setItem('ziegler_active_session_team_id', session.team_id);
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-650 hover:text-indigo-805 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                  >
                                    <span>Choose Role</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View (visible on screen sizes below md) */}
                    <div className="md:hidden space-y-3">
                      {activeSessions.map((session) => {
                        const stats = getSessionConnectionsCount(session.id);
                        return (
                          <div key={session.id} className="bg-slate-50/50 border border-slate-200/60 rounded-2xl p-4.5 space-y-3 hover:bg-indigo-50/10 transition-colors">
                            <div className="flex justify-between items-center">
                              <span className="font-mono font-extrabold text-slate-800 uppercase tracking-wide text-sm">
                                {session.code}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {session.team_name}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-slate-100/60 pt-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${stats.photographers > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                  📷 {stats.photographers}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${stats.taggers > 0 ? 'bg-violet-50 text-violet-700 border-violet-100' : 'bg-slate-50 text-slate-405 border-slate-100'}`}>
                                  💻 {stats.taggers}/1
                                </span>
                              </div>
                              
                              <button
                                onClick={() => {
                                  setSelectedSession(session);
                                  localStorage.setItem('ziegler_active_session_code', session.code);
                                  localStorage.setItem('ziegler_active_session_id', session.id);
                                  localStorage.setItem('ziegler_active_session_team_id', session.team_id);
                                }}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-650 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                              >
                                <span>Enter</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Quick Session Create Bar (at the bottom when sessions are active) */}
              {activeSessions.length > 0 && teams.length > 0 && (
                <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                  <p className="text-xs text-slate-500 font-semibold">Start another cataloging session:</p>
                  <form onSubmit={handleCreateSession} className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      required
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48"
                    >
                      <option value="">-- Select Team --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={creatingSession || !selectedTeamId}
                      className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                    >
                      {creatingSession ? '...' : '+ Create Lobby'}
                    </button>
                  </form>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
