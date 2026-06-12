'use client';

import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, Search, Download, Printer, Layers, Clock, 
  ArrowLeft, RefreshCw, Compass, AlertCircle, Loader2, QrCode, 
  Database, UserCheck, ShieldCheck, Tag, X, FileText, Bluetooth, Usb
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { usePrinter, PrinterLanguage } from '@/hooks/use-printer';
import ScannableCode, { CodeType } from '@/components/scannable-code';

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
  session_code?: string; // Hydrated field
  team_name?: string;    // Hydrated field
}

interface Team {
  id: string;
  name: string;
}

interface Session {
  id: string;
  code: string;
  team_id: string;
}

export default function DigitizationLogPage() {
  const { user, loading: authLoading, isConfigured } = useAuth();
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

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal print state
  const [activePrintFabric, setActivePrintFabric] = useState<Fabric | null>(null);

  // Dynamic code formats for visual table
  const [table2DFormat, setTable2DFormat] = useState<CodeType>('qrcode');
  const [table1DFormat, setTable1DFormat] = useState<CodeType>('code128');

  // Dynamic code formats for thermal printer stickers
  const [print2DFormat, setPrint2DFormat] = useState<CodeType>('qrcode');
  const [print1DFormat, setPrint1DFormat] = useState<CodeType>('code128');

  // Bulk Selection States
  const [selectedFabricIds, setSelectedFabricIds] = useState<string[]>([]);
  const [isBulkPrintModalOpen, setIsBulkPrintModalOpen] = useState(false);

  // Bulk Print Grid Configuration
  const [bulkColumns, setBulkColumns] = useState<number>(3);
  const [bulkGap, setBulkGap] = useState<number>(12);
  const [bulkShowTitle, setBulkShowTitle] = useState(true);
  const [bulkShowRef, setBulkShowRef] = useState(true);
  const [bulkShow2D, setBulkShow2D] = useState(true);
  const [bulkShow1D, setBulkShow1D] = useState(true);
  const [bulkShowFooter, setBulkShowFooter] = useState(true);
  const [bulkScale, setBulkScale] = useState<number>(1);

  // Direct printing stream states
  const [isPrintingBulk, setIsPrintingBulk] = useState(false);
  const [bulkPrintProgress, setBulkPrintProgress] = useState(0);
  const [bulkPrintError, setBulkPrintError] = useState('');

  const toggleSelectFabric = (id: string) => {
    setSelectedFabricIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    // Only select completed fabrics that have a qr_code_id
    const printableFilteredFabrics = filteredFabrics.filter(f => f.status === 'completed' && f.qr_code_id);
    const printableIds = printableFilteredFabrics.map(f => f.id);
    const allSelected = printableIds.every(id => selectedFabricIds.includes(id));

    if (allSelected) {
      setSelectedFabricIds(prev => prev.filter(id => !printableIds.includes(id)));
    } else {
      setSelectedFabricIds(prev => {
        const newSelection = [...prev];
        printableIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleBulkPrintDirect = async () => {
    setIsPrintingBulk(true);
    setBulkPrintProgress(0);
    setBulkPrintError('');
    
    // Get list of selected completed fabrics
    const selectedFabricsList = fabrics.filter(f => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id);
    
    try {
      for (let i = 0; i < selectedFabricsList.length; i++) {
        const fabric = selectedFabricsList[i];
        const labelData = {
          name: fabric.name || 'Unnamed Fabric',
          qrCodeId: fabric.qr_code_id || '',
          sessionCode: fabric.session_code || 'SANDBOX'
        };
        
        const success = await printDirect(labelData, !isConfigured);
        if (!success) {
          throw new Error(`Failed to transmit print command for "${fabric.name || fabric.qr_code_id}".`);
        }
        
        setBulkPrintProgress(i + 1);
        // Throttle print jobs by 300ms
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Success completion
      alert(`Successfully queued ${selectedFabricsList.length} labels for direct printing!`);
      setIsBulkPrintModalOpen(false);
      setSelectedFabricIds([]);
    } catch (err: any) {
      console.error('Bulk printing stream failed:', err);
      setBulkPrintError(err.message || 'Direct stream bulk printing failed.');
    } finally {
      setIsPrintingBulk(false);
    }
  };

  const loadLogData = async (silent = false) => {
    if (!silent) setLoading(true);
    setErrorText('');

    try {
      if (!isConfigured) {
        // --- OFFLINE MOCK MODE ---
        const localTeams: any[] = JSON.parse(localStorage.getItem('fabric_local_teams') || '[]');
        const localMembers: any[] = JSON.parse(localStorage.getItem('fabric_local_team_members') || '[]');
        const localSessions: any[] = JSON.parse(localStorage.getItem('fabric_local_sessions') || '[]');
        const localQueue: any[] = JSON.parse(localStorage.getItem('fabric_local_queue') || '[]');
        const localCompleted: any[] = JSON.parse(localStorage.getItem('fabric_local_completed') || '[]');

        // Filter teams user is member of (user = 'sandbox')
        const joinedTeamIds = localMembers
          .filter(m => m.user_id === 'sandbox')
          .map(m => m.team_id);

        const joinedTeams = localTeams.filter(t => joinedTeamIds.includes(t.id));
        setTeams(joinedTeams);

        const joinedSessions = localSessions.filter(s => joinedTeamIds.includes(s.team_id));
        setSessions(joinedSessions);

        // Merge queue (pending) and completed fabrics
        const allLocalFabrics = [...localQueue, ...localCompleted];

        // Hydrate and filter local fabrics
        const hydratedFabrics = allLocalFabrics
          .filter(f => {
            const sess = joinedSessions.find(s => s.id === f.session_id);
            return sess !== undefined;
          })
          .map(f => {
            const sess = joinedSessions.find(s => s.id === f.session_id);
            const team = joinedTeams.find(t => t.id === sess?.team_id);
            return {
              ...f,
              session_code: sess ? sess.code : 'UNKNOWN',
              team_name: team ? team.name : 'Unknown Team'
            } as Fabric;
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setFabrics(hydratedFabrics);
        setLoading(false);
        return;
      }

      if (!user) return;

      // 1. Fetch joined teams
      const { data: memberData, error: memberErr } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (memberErr) throw memberErr;
      const teamIds = memberData?.map(m => m.team_id) || [];

      if (teamIds.length === 0) {
        setTeams([]);
        setSessions([]);
        setFabrics([]);
        setLoading(false);
        return;
      }

      // 2. Fetch metadata for joined teams
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      if (teamsErr) throw teamsErr;
      setTeams(teamsData || []);

      // 3. Fetch active/inactive sessions belonging to these teams
      const { data: sessionsData, error: sessionsErr } = await supabase
        .from('sessions')
        .select('id, code, team_id')
        .in('team_id', teamIds);

      if (sessionsErr) throw sessionsErr;
      setSessions(sessionsData || []);

      const sessionIds = sessionsData?.map(s => s.id) || [];
      if (sessionIds.length === 0) {
        setFabrics([]);
        setLoading(false);
        return;
      }

      // 4. Fetch fabrics for these sessions
      const { data: fabricsData, error: fabricsErr } = await supabase
        .from('fabrics')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });

      if (fabricsErr) throw fabricsErr;

      // Hydrate session code and team name
      const hydrated = (fabricsData || []).map(f => {
        const sess = (sessionsData || []).find(s => s.id === f.session_id);
        const team = (teamsData || []).find(t => t.id === sess?.team_id);
        return {
          ...f,
          session_code: sess ? sess.code : 'UNKNOWN',
          team_name: team ? team.name : 'Unknown Team'
        };
      });

      setFabrics(hydrated);

    } catch (err: any) {
      console.error('Error loading log data:', err);
      setErrorText(err.message || 'Failed to sync digitization log records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadLogData();
    }
  }, [authLoading, user]);

  // Handle CSV Export
  const exportToCSV = () => {
    if (filteredFabrics.length === 0) return;

    // Headers
    const headers = [
      'Fabric ID',
      'Name / Pattern',
      'QR Code Reference',
      'Status',
      'Created At',
      'Uploaded By (Email)',
      'Labeled By (Email)',
      'Session Code',
      'Hosting Team'
    ];

    // Build rows
    const rows = filteredFabrics.map(f => [
      f.id,
      f.name || 'Unlabeled / Pending',
      f.qr_code_id || 'None',
      f.status.toUpperCase(),
      new Date(f.created_at).toISOString(),
      f.created_by_email || 'Anonymous',
      f.tagged_by_email || 'N/A',
      f.session_code || 'N/A',
      f.team_name || 'N/A'
    ]);

    // CSV format escape helper
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\r\n');

    // Trigger file download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ziegler_inventory_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Filter fabrics based on current filter states
  const filteredFabrics = fabrics.filter(f => {
    // Search query filter
    const nameMatch = f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const codeMatch = f.qr_code_id?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const sessionMatch = f.session_code?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
    const idMatch = f.id.toLowerCase().includes(searchQuery.toLowerCase());
    const queryMatch = searchQuery === '' || nameMatch || codeMatch || sessionMatch || idMatch;

    // Team filter
    const sess = sessions.find(s => s.id === f.session_id);
    const teamMatch = selectedTeamId === '' || (sess && sess.team_id === selectedTeamId);

    // Session filter
    const sessionFilterMatch = selectedSessionId === '' || f.session_id === selectedSessionId;

    // Status filter
    const statusMatch = selectedStatus === '' || f.status === selectedStatus;

    return queryMatch && teamMatch && sessionFilterMatch && statusMatch;
  });

  const getStats = () => {
    return {
      total: fabrics.length,
      completed: fabrics.filter(f => f.status === 'completed').length,
      pending: fabrics.filter(f => f.status === 'pending').length,
      discarded: fabrics.filter(f => f.status === 'discarded').length,
    };
  };

  const handlePrintLabel = async () => {
    if (printerMode === 'browser') {
      window.print();
    } else {
      if (!activePrintFabric) return;
      const labelData = {
        name: activePrintFabric.name || 'Unnamed Fabric',
        qrCodeId: activePrintFabric.qr_code_id || '',
        sessionCode: activePrintFabric.session_code || 'SANDBOX'
      };
      await printDirect(labelData, !isConfigured);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 text-indigo-650 animate-spin" />
          <span className="text-sm font-medium text-slate-500">Syncing inventory archives...</span>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 sm:p-8 relative selection:bg-indigo-500 selection:text-white print:bg-white print:p-0">
      
      {/* Background accents */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-20 pointer-events-none -mr-40 -mt-40 print:hidden" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-3xl opacity-20 pointer-events-none -ml-40 -mb-40 print:hidden" />

      <div className="max-w-7xl mx-auto space-y-8 print:max-w-none print:space-y-0">
        
        {/* Header Block */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200/80 pb-6 print:hidden">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardCheck className="h-5 w-5 text-indigo-650" />
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                Log Database
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Digitization Log & Inventory
            </h1>
            <p className="mt-1.5 text-xs text-slate-400 font-semibold max-w-xl">
              Query completed fabric rolls, view scannable QR / 1D Barcodes, and export log spreadsheets.
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex gap-3">
            <button
              onClick={() => loadLogData(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 text-xs font-bold text-slate-650 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredFabrics.length === 0}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-indigo-650 hover:bg-indigo-750 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-transparent text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-150 border-b border-indigo-850"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </header>

        {errorText && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-start gap-2.5 shadow-xs print:hidden">
            <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{errorText}</span>
          </div>
        )}

        {/* Info Metric Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Total Cataloged</p>
            <h2 className="text-2xl font-bold text-slate-805 tracking-tight mt-1">{stats.total}</h2>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold text-emerald-600">Completed Labels</p>
            <h2 className="text-2xl font-bold text-slate-805 tracking-tight mt-1 text-emerald-600">{stats.completed}</h2>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold text-amber-500">Pending Review</p>
            <h2 className="text-2xl font-bold text-slate-805 tracking-tight mt-1 text-amber-500">{stats.pending}</h2>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold text-rose-600">Discarded Samples</p>
            <h2 className="text-2xl font-bold text-slate-805 tracking-tight mt-1 text-rose-600">{stats.discarded}</h2>
          </div>
        </div>

        {/* Search and Filter Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/85 p-5 shadow-xs space-y-4 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Search Input */}
            <div className="md:col-span-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search by name, code, session ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs text-slate-900 font-semibold"
              />
            </div>

            {/* Team Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedTeamId}
                onChange={(e) => {
                  setSelectedTeamId(e.target.value);
                  setSelectedSessionId(''); // Reset session filter since teams changed
                }}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Filter by Team (All) --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Session Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Filter by Lobby (All) --</option>
                {sessions
                  .filter(s => selectedTeamId === '' || s.team_id === selectedTeamId)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.code}</option>
                  ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">-- Status (All) --</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="discarded">Discarded</option>
              </select>
            </div>

          </div>
        </div>

        {/* Labeled Fabrics Table list */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden print:hidden">
          {filteredFabrics.length === 0 ? (
            <div className="text-center py-20 text-slate-400 space-y-4">
              <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto">
                <Database className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">No fabrics found</p>
                <p className="text-xs text-slate-400 mt-1">Adjust search parameters or select other teams.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table View (lg screens and wider) */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-4 pl-6 text-center w-12">
                        <input
                          type="checkbox"
                          checked={
                            filteredFabrics.filter(f => f.status === 'completed' && f.qr_code_id).length > 0 &&
                            filteredFabrics.filter(f => f.status === 'completed' && f.qr_code_id).every(f => selectedFabricIds.includes(f.id))
                          }
                          onChange={toggleSelectAll}
                          className="h-4 w-4 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-4 pl-2">Fabric Sample</th>
                      <th className="py-4">Fabric Details</th>
                      <th className="py-4 text-center min-w-[125px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>2D Format</span>
                          <select
                            value={table2DFormat}
                            onChange={(e) => setTable2DFormat(e.target.value as CodeType)}
                            className="bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-650 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="qrcode">QR Code</option>
                            <option value="datamatrix">Data Matrix</option>
                            <option value="pdf417">PDF417</option>
                          </select>
                        </div>
                      </th>
                      <th className="py-4 text-center min-w-[155px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>1D Format</span>
                          <select
                            value={table1DFormat}
                            onChange={(e) => setTable1DFormat(e.target.value as CodeType)}
                            className="bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-650 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="code128">Code 128</option>
                            <option value="code39">Code 39</option>
                            <option value="ean13">EAN-13</option>
                            <option value="upca">UPC-A</option>
                          </select>
                        </div>
                      </th>
                      <th className="py-4">Session & Team</th>
                      <th className="py-4">Log Operators</th>
                      <th className="py-4 text-right pr-6">Sticker Print</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 text-xs">
                    {filteredFabrics.map((fabric) => (
                      <tr key={fabric.id} className={`hover:bg-slate-50/30 transition-colors ${selectedFabricIds.includes(fabric.id) ? 'bg-indigo-50/20' : ''}`}>
                        {/* Checkbox cell */}
                        <td className="py-4 pl-6 text-center w-12">
                          {fabric.status === 'completed' && fabric.qr_code_id ? (
                            <input
                              type="checkbox"
                              checked={selectedFabricIds.includes(fabric.id)}
                              onChange={() => toggleSelectFabric(fabric.id)}
                              className="h-4.5 w-4.5 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                          ) : (
                            <div className="h-4.5 w-4.5 border border-slate-200 bg-slate-50/50 rounded cursor-not-allowed mx-auto flex items-center justify-center" title="Only completed rolls can be printed.">
                              <span className="text-[8px] text-slate-400 font-bold font-sans">-</span>
                            </div>
                          )}
                        </td>

                        {/* Photo Thumbnail */}
                        <td className="py-4 pl-2">
                          <div className="h-14 w-14 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-inner relative group/thumb">
                            <img 
                              src={fabric.image_url} 
                              alt="Fabric catalog sample" 
                              className="object-cover h-full w-full group-hover/thumb:scale-105 transition-transform"
                            />
                          </div>
                        </td>

                        {/* Details & ID */}
                        <td className="py-4">
                          <p className="font-bold text-slate-800 max-w-[200px] truncate">
                            {fabric.name || <span className="text-slate-400 font-medium italic">Unlabeled / Pending</span>}
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5 uppercase">ID: {fabric.id.slice(0, 8)}...</p>
                          <div className="mt-1">
                            {fabric.status === 'completed' && (
                              <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                                Completed
                              </span>
                            )}
                            {fabric.status === 'pending' && (
                              <span className="inline-flex items-center text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                                Pending
                              </span>
                            )}
                            {fabric.status === 'discarded' && (
                              <span className="inline-flex items-center text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">
                                Discarded
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2D Code SVG */}
                        <td className="py-4 text-center">
                          {fabric.qr_code_id ? (
                            <div className="inline-flex p-1 bg-white border border-slate-200 rounded-lg shadow-2xs" title={fabric.qr_code_id}>
                              <ScannableCode value={fabric.qr_code_id} type={table2DFormat} scale={1.2} />
                            </div>
                          ) : (
                            <span className="text-slate-300 font-semibold">—</span>
                          )}
                        </td>

                        {/* 1D Barcode SVG */}
                        <td className="py-4 text-center">
                          {fabric.qr_code_id ? (
                            <div className="inline-flex scale-90 origin-center">
                              <ScannableCode value={fabric.qr_code_id} type={table1DFormat} scale={1.2} height={8} />
                            </div>
                          ) : (
                            <span className="text-slate-300 font-semibold">—</span>
                          )}
                        </td>

                        {/* Session / Team hosting */}
                        <td className="py-4">
                          <p className="font-mono font-bold text-slate-800 uppercase tracking-wide">{fabric.session_code}</p>
                          <p className="text-[10px] text-slate-400 font-bold mt-0.5">{fabric.team_name}</p>
                        </td>

                        {/* Operators info */}
                        <td className="py-4">
                          <p className="text-[10.5px] font-semibold text-slate-650">📷 {fabric.created_by_email?.split('@')[0] || 'Photographer'}</p>
                          {fabric.tagged_by_email && (
                            <p className="text-[10.5px] font-semibold text-slate-500 mt-0.5">💻 {fabric.tagged_by_email.split('@')[0] || 'Tagger'}</p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 text-right pr-6">
                          {fabric.status === 'completed' && fabric.qr_code_id ? (
                            <button
                              onClick={() => setActivePrintFabric(fabric)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-650 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/70 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Sticker print</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-350 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg cursor-not-allowed"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Sticker print</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (visible on screen sizes below lg) */}
              <div className="lg:hidden divide-y divide-slate-150">
                {filteredFabrics.map((fabric) => (
                  <div key={fabric.id} className={`p-5 space-y-4 hover:bg-slate-50/20 transition-colors relative ${selectedFabricIds.includes(fabric.id) ? 'bg-indigo-50/10' : ''}`}>
                    {/* Top segment: Image & Details */}
                    <div className="flex gap-4 items-start">
                      {fabric.status === 'completed' && fabric.qr_code_id && (
                        <div className="pt-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={selectedFabricIds.includes(fabric.id)}
                            onChange={() => toggleSelectFabric(fabric.id)}
                            className="h-5 w-5 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </div>
                      )}
                      <div className="h-16 w-16 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-inner shrink-0 relative">
                        <img 
                          src={fabric.image_url} 
                          alt="Fabric catalog sample" 
                          className="object-cover h-full w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 truncate text-sm">
                            {fabric.name || <span className="text-slate-450 italic font-medium">Unlabeled / Pending</span>}
                          </h4>
                          <div className="shrink-0">
                            {fabric.status === 'completed' && (
                              <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md">
                                Completed
                              </span>
                            )}
                            {fabric.status === 'pending' && (
                              <span className="inline-flex items-center text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                                Pending
                              </span>
                            )}
                            {fabric.status === 'discarded' && (
                              <span className="inline-flex items-center text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">
                                Discarded
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] font-mono text-slate-400 font-bold uppercase mt-0.5">ID: {fabric.id.slice(0, 8)}...</p>
                        <p className="text-[10.5px] text-slate-500 font-semibold font-sans mt-1">
                          Lobby: <span className="font-mono text-slate-805 uppercase">{fabric.session_code}</span> • {fabric.team_name}
                        </p>
                      </div>
                    </div>

                    {/* Scannable codes block */}
                    {fabric.qr_code_id && (
                      <div className="bg-slate-50/60 border border-slate-150/50 rounded-2xl p-3 flex items-center justify-around gap-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{table2DFormat}</span>
                          <div className="bg-white p-1 rounded-xl border border-slate-150 shadow-3xs">
                            <ScannableCode value={fabric.qr_code_id} type={table2DFormat} scale={1} />
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{table1DFormat}</span>
                          <div className="bg-white p-1 rounded-xl border border-slate-150 shadow-3xs scale-90">
                            <ScannableCode value={fabric.qr_code_id} type={table1DFormat} scale={1} height={7} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Operators & Action buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="text-[10.5px] space-y-0.5">
                        <p className="font-semibold text-slate-650">📷 {fabric.created_by_email?.split('@')[0] || 'Photographer'}</p>
                        {fabric.tagged_by_email && (
                          <p className="text-slate-455">💻 {fabric.tagged_by_email.split('@')[0]}</p>
                        )}
                      </div>

                      <div>
                        {fabric.status === 'completed' && fabric.qr_code_id ? (
                          <button
                            onClick={() => setActivePrintFabric(fabric)}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-650 bg-indigo-50 active:bg-indigo-100 px-3 py-2 rounded-xl transition-colors cursor-pointer border border-indigo-100/50"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Sticker</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-350 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl cursor-not-allowed"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            <span>Print Sticker</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>

      {/* 5. STICKER PRINT MODAL DIALOG (PRINTABLE CARD ELEMENT) */}
      {activePrintFabric && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 print:relative print:bg-white print:p-0 print:inset-auto animate-in fade-in duration-200">
          
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:border-none print:shadow-none print:rounded-none">
            
            {/* Modal header */}
            <div className="px-6 py-4.5 border-b border-slate-150 flex items-center justify-between print:hidden">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-indigo-650" />
                <span>Adhesive Sticker Printer</span>
              </h3>
              <button 
                onClick={() => setActivePrintFabric(null)}
                className="text-slate-400 hover:text-slate-700 p-1 font-mono text-sm font-bold cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sticker Preview Stage */}
            <div className="p-8 flex items-center justify-center bg-slate-50/50 print:bg-white print:p-0">
              
              {/* PRINT ELEMENT STYLED FOR 50mm x 30mm (2x1.2 inch) THERMAL LABEL PRINTERS */}
              <div 
                id="thermal-sticker-label" 
                className="bg-white border border-slate-300 p-4 rounded-2xl flex flex-col justify-between items-center text-center shadow-xs w-72 h-44 print:border-none print:shadow-none print:rounded-none print:p-0 print:w-[2.2in] print:h-[1.2in] print:m-0"
              >
                <div className="w-full min-w-0">
                  <p className="text-[12px] font-extrabold text-slate-950 truncate print:text-[10px] print:leading-tight">
                    {activePrintFabric.name}
                  </p>
                  <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5 print:text-[7px]">
                    ID: {activePrintFabric.qr_code_id}
                  </p>
                </div>

                {/* Codes side-by-side layout */}
                <div className="flex items-center justify-around w-full gap-4 mt-2">
                  <div className="p-0.5 bg-white border border-slate-150 rounded shrink-0 print:border-none">
                    <ScannableCode 
                      value={activePrintFabric.qr_code_id || ''} 
                      type={print2DFormat} 
                      scale={1.5}
                    />
                  </div>
                  <div className="scale-90 origin-center shrink-0">
                    <ScannableCode 
                      value={activePrintFabric.qr_code_id || ''} 
                      type={print1DFormat} 
                      scale={1.2} 
                      height={9}
                    />
                  </div>
                </div>

                <div className="w-full border-t border-slate-100 pt-1.5 mt-2 flex justify-between items-center text-[7px] font-bold text-slate-400 uppercase tracking-widest print:text-[6px] print:mt-1">
                  <span>Ziegler textile catalog</span>
                  <span className="font-mono">{activePrintFabric.session_code}</span>
                </div>
              </div>

            </div>

            {/* Format settings */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 print:hidden space-y-4">
              {/* Tab Selector for Printer Connection Mode */}
              <div>
                <label className="block text-[9.5px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Printer Mode</label>
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
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
                              connectUSB(!isConfigured);
                            } else {
                              connectBluetooth(!isConfigured);
                            }
                          }}
                          className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white ${
                            printerStatus === 'connecting'
                              ? 'bg-slate-300 cursor-not-allowed shadow-none'
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

            {/* Action footer */}
            <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-150 flex justify-between items-center print:hidden">
              <span className="text-[10px] text-slate-450 font-bold font-sans">
                Label: 2&quot; x 1.2&quot; size
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActivePrintFabric(null)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={printerMode !== 'browser' && printerStatus !== 'connected'}
                  onClick={handlePrintLabel}
                  className={`inline-flex items-center gap-1.5 px-4.5 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md border-b ${
                    (printerMode !== 'browser' && printerStatus !== 'connected')
                      ? 'bg-slate-300 border-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-indigo-650 hover:bg-indigo-750 shadow-indigo-150 border-b border-indigo-850'
                  }`}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Label</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. FLOATING BULK ACTION SHELF */}
      {selectedFabricIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-35 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center justify-between gap-6 border border-slate-800 animate-in slide-in-from-bottom-6 duration-300 w-[90%] max-w-lg print:hidden">
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-200">
              {selectedFabricIds.length} {selectedFabricIds.length === 1 ? 'item' : 'items'} selected
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
              Ready for batch sticker printing
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => setSelectedFabricIds([])}
              className="px-3.5 py-1.5 text-[11px] font-bold text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              onClick={() => setIsBulkPrintModalOpen(true)}
              className="px-4 py-1.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl shadow-md shadow-indigo-905/30 transition-all cursor-pointer border-b border-indigo-800"
            >
              Bulk Print
            </button>
          </div>
        </div>
      )}

      {/* 6. BULK STICKER PRINT MODAL DIALOG (GRID SHEET & DIRECT STREAM) */}
      {isBulkPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 print:relative print:bg-white print:p-0 print:inset-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 print:border-none print:shadow-none print:rounded-none print:max-h-none print:w-full">
            
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-150 flex items-center justify-between shrink-0 print:hidden">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                <Printer className="h-4 w-4 text-indigo-655" />
                <span>Bulk Adhesive Sticker Printing</span>
              </h3>
              <button 
                onClick={() => setIsBulkPrintModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 font-mono text-sm font-bold cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body (Split view: Settings left, Preview right) */}
            <div className="flex-1 overflow-y-auto flex flex-col md:flex-row print:overflow-visible print:block">
              
              {/* Left pane: Configuration settings */}
              <div className="w-full md:w-80 border-r border-slate-150 p-6 bg-slate-50/50 space-y-5 shrink-0 print:hidden">
                {/* Printer Connection Mode */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Printer Mode</label>
                  <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setPrinterMode('browser')}
                      className={`py-1.5 text-[9.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        printerMode === 'browser'
                          ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Printer className="h-3 w-3" />
                      <span>Grid Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrinterMode('usb')}
                      className={`py-1.5 text-[9.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
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
                      className={`py-1.5 text-[9.5px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
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

                {/* Settings for Grid Sheet (Browser Print) */}
                {printerMode === 'browser' ? (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grid Layout Options</h4>
                    
                    {/* Columns selection */}
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-500 mb-1">Grid Columns</label>
                      <select
                        value={bulkColumns}
                        onChange={(e) => setBulkColumns(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={1}>1 Column (Continuous list)</option>
                        <option value={2}>2 Columns (Avery Sheet)</option>
                        <option value={3}>3 Columns (Standard Avery)</option>
                        <option value={4}>4 Columns (Dense grid)</option>
                        <option value={5}>5 Columns (Ultra dense)</option>
                      </select>
                    </div>

                    {/* Gap selection */}
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-500 mb-1">Gap Spacing</label>
                      <select
                        value={bulkGap}
                        onChange={(e) => setBulkGap(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={4}>Compact (4px)</option>
                        <option value={8}>Small (8px)</option>
                        <option value={12}>Medium (12px)</option>
                        <option value={20}>Large (20px)</option>
                        <option value={32}>Wide (32px)</option>
                      </select>
                    </div>

                    {/* Label scaling */}
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-500 mb-1">Label Card Size Scale</label>
                      <select
                        value={bulkScale}
                        onChange={(e) => setBulkScale(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={0.75}>Tiny (75%)</option>
                        <option value={0.9}>Compact (90%)</option>
                        <option value={1}>Default (100%)</option>
                        <option value={1.15}>Medium (115%)</option>
                        <option value={1.3}>Large (130%)</option>
                      </select>
                    </div>

                    {/* Element visibility toggles */}
                    <div className="space-y-2.5 pt-1">
                      <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">Visible Card Info</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={bulkShowTitle}
                            onChange={(e) => setBulkShowTitle(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
                          />
                          <span>Fabric Title</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={bulkShowRef}
                            onChange={(e) => setBulkShowRef(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
                          />
                          <span>Reference ID code</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={bulkShow2D}
                            onChange={(e) => setBulkShow2D(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
                          />
                          <span>2D Barcode (QR)</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={bulkShow1D}
                            onChange={(e) => setBulkShow1D(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
                          />
                          <span>1D Barcode (Code128)</span>
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={bulkShowFooter}
                            onChange={(e) => setBulkShowFooter(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
                          />
                          <span>Footer details</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Direct Stream Configuration drawer
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Print Controls</h4>
                    
                    <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                      {/* Connection status */}
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
                        <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg flex flex-col gap-1.5">
                          <div className="min-w-0">
                            <p className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">Connected Printer</p>
                            <p className="text-xs font-semibold text-emerald-950 truncate">{connectedDeviceName}</p>
                          </div>
                          <button
                            type="button"
                            onClick={disconnectPrinter}
                            className="text-[9px] w-full text-center font-bold text-rose-650 hover:text-rose-800 px-2 py-1 bg-white border border-rose-100 rounded-lg shadow-2xs transition-all cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                      )}

                      {printerStatus !== 'connected' && (
                        <>
                          {((printerMode === 'usb' && !hasUsbSupport) || (printerMode === 'bluetooth' && !hasBluetoothSupport)) ? (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-[10px] font-medium leading-relaxed">
                              Direct {printerMode === 'usb' ? 'USB' : 'Bluetooth'} is unsupported in this browser. Please use Chrome/Edge on Desktop.
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={printerStatus === 'connecting'}
                              onClick={() => {
                                if (printerMode === 'usb') {
                                  connectUSB(!isConfigured);
                                } else {
                                  connectBluetooth(!isConfigured);
                                }
                              }}
                              className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white bg-indigo-650 hover:bg-indigo-750`}
                            >
                              {printerStatus === 'connecting' ? 'Searching Device...' : `Connect ${printerMode === 'usb' ? 'USB' : 'Bluetooth'}`}
                            </button>
                          )}
                        </>
                      )}

                      {printerErrorMsg && (
                        <div className="p-2 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-[10px] font-medium">
                          {printerErrorMsg}
                        </div>
                      )}

                      {/* Language Selection */}
                      <div className="pt-1 border-t border-slate-100">
                        <label className="block text-[9.5px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Printer Language</label>
                        <select
                          value={printerLanguage}
                          onChange={(e) => setPrinterLanguage(e.target.value as PrinterLanguage)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-2 py-1.5 focus:outline-none cursor-pointer text-slate-700"
                        >
                          <option value="TSPL">TSPL (Munbyn, TSC)</option>
                          <option value="ZPL">ZPL (Zebra Printers)</option>
                        </select>
                      </div>
                    </div>

                    {/* Stream Queue Status */}
                    <div className="p-3 bg-slate-100/80 rounded-xl space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Queue Summary</p>
                      <p className="text-xs font-semibold text-slate-700">
                        Total Printable Items: {fabrics.filter(f => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id).length} label rolls
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right pane: Real-time sheet layout grid preview */}
              <div className="flex-1 bg-slate-100/40 p-8 flex items-start justify-center min-h-[300px] print:bg-white print:p-0 print:block">
                
                {/* Print Sheet wrap */}
                <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-md p-6 rounded-2xl print:border-none print:shadow-none print:rounded-none print:p-0 print:max-w-none">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 print:hidden">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Grid Print Sheet Canvas (A4 / Letter size representation)</span>
                    <span className="text-[10px] bg-slate-100 text-slate-650 px-2 py-0.5 rounded font-bold">
                      {fabrics.filter(f => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id).length} Labels
                    </span>
                  </div>

                  {/* GRID CONTAINER TARGETED BY MEDIA PRINT */}
                  <div 
                    id="bulk-grid-print-container" 
                    className="grid"
                    style={{ 
                      gridTemplateColumns: `repeat(${bulkColumns}, minmax(0, 1fr))`, 
                      gap: `${bulkGap}px`,
                      '--grid-cols': bulkColumns
                    } as React.CSSProperties}
                  >
                    {fabrics
                      .filter(f => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id)
                      .map((fabric) => (
                        <div
                          key={fabric.id}
                          className="bulk-grid-label-card bg-white border border-slate-200 p-3 rounded-xl flex flex-col justify-between items-center text-center shadow-3xs aspect-[2.2/1.2] shrink-0 print:border print:border-slate-300 print:shadow-none print:rounded-none"
                          style={{ 
                            transform: `scale(${bulkScale})`,
                            transformOrigin: 'top center',
                            pageBreakInside: 'avoid',
                            breakInside: 'avoid'
                          }}
                        >
                          {bulkShowTitle && (
                            <p className="text-[10px] font-extrabold text-slate-955 truncate w-full leading-tight">
                              {fabric.name}
                            </p>
                          )}
                          {bulkShowRef && (
                            <p className="text-[7px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                              ID: {fabric.qr_code_id}
                            </p>
                          )}

                          {/* Code placement inside card */}
                          <div className="flex items-center justify-center gap-3 w-full my-1.5">
                            {bulkShow2D && fabric.qr_code_id && (
                              <div className="p-0.5 bg-white border border-slate-150 rounded shrink-0">
                                <ScannableCode 
                                  value={fabric.qr_code_id} 
                                  type={print2DFormat} 
                                  scale={1}
                                />
                              </div>
                            )}
                            {bulkShow1D && fabric.qr_code_id && (
                              <div className="scale-75 origin-center shrink-0">
                                <ScannableCode 
                                  value={fabric.qr_code_id} 
                                  type={print1DFormat} 
                                  scale={0.8} 
                                  height={6}
                                />
                              </div>
                            )}
                          </div>

                          {bulkShowFooter && (
                            <div className="w-full border-t border-slate-100 pt-1 flex justify-between items-center text-[6.5px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                              <span>Ziegler textile</span>
                              <span className="font-mono">{fabric.session_code}</span>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                </div>

              </div>

            </div>

            {/* Modal Action Footer */}
            <div className="px-6 py-4.5 bg-slate-50 border-t border-slate-150 flex justify-between items-center shrink-0 print:hidden">
              <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
                Bulk Print Engine
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkPrintModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-650 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close Settings
                </button>
                
                {printerMode === 'browser' ? (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4.5 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-150 border-b border-indigo-850"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Grid Sheet</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={printerStatus !== 'connected' || isPrintingBulk}
                    onClick={handleBulkPrintDirect}
                    className={`inline-flex items-center gap-1.5 px-4.5 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md border-b ${
                      printerStatus !== 'connected' || isPrintingBulk
                        ? 'bg-slate-300 border-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-650 hover:bg-indigo-750 shadow-indigo-150 border-b border-indigo-850'
                    }`}
                  >
                    {isPrintingBulk ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Printing ({bulkPrintProgress}/{fabrics.filter(f => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id).length})...</span>
                      </>
                    ) : (
                      <>
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print direct stream</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PRINT STYLING INJECTIONS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          ${activePrintFabric ? `
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
          ` : ''}
          ${isBulkPrintModalOpen ? `
            #bulk-grid-print-container, #bulk-grid-print-container * {
              visibility: visible;
            }
            #bulk-grid-print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              display: grid !important;
              grid-template-columns: repeat(var(--grid-cols, 3), minmax(0, 1fr)) !important;
            }
            .bulk-grid-label-card {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              border: 1px solid #CBD5E1 !important;
              background-color: white !important;
            }
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
          ` : ''}
        }
      `}</style>

    </main>
  );
}
