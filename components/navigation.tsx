'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Camera, Laptop, Layers, LogOut, User, Menu, X, Users, Compass, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function Navigation({ children }: { children: React.ReactNode }) {
  const { user, signOut, isConfigured } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [activeSession, setActiveSession] = useState<string | null>(null);

  // Sync active session code from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const savedCode = localStorage.getItem('ziegler_active_session_code');
      setActiveSession(savedCode);
    };

    handleStorageChange();
    
    // Listen to changes (e.g. from other components or tabs)
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 2000); // Polling fallback

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Don't show navigation on landing page or login page
  const isAuthPage = pathname === '/login' || pathname === '/';
  if (isAuthPage) {
    return <>{children}</>;
  }

  const captureHref = activeSession ? `/capture?session=${activeSession}` : '/capture';
  const taggingHref = activeSession ? `/tagging?session=${activeSession}` : '/tagging';

  const navItems = [
    {
      name: 'Lobby Browser',
      href: '/dashboard',
      icon: Layers,
      active: pathname === '/dashboard',
    },
    {
      name: 'Mobile Scanner',
      href: captureHref,
      icon: Camera,
      active: pathname === '/capture',
    },
    {
      name: 'Labeling Desk',
      href: taggingHref,
      icon: Laptop,
      active: pathname === '/tagging',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row relative">
      
      {/* 1. DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col justify-between w-64 bg-white border-r border-slate-200/80 shrink-0 sticky top-0 h-screen z-20 shadow-xs">
        <div className="p-6 space-y-8">
          
          {/* Logo Header */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-indigo-650 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 text-sm block leading-none">Ziegler</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inventory Hub</span>
            </div>
          </div>

          {/* Active Session Status */}
          {activeSession ? (
            <div className="bg-indigo-50/70 border border-indigo-100/60 rounded-2xl p-4 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-200/20 rounded-full blur-xl pointer-events-none" />
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Active Workspace</span>
              </div>
              <p className="text-sm font-extrabold text-slate-800 tracking-wide font-mono uppercase">{activeSession}</p>
              <button
                onClick={() => {
                  if (confirm('Leave this session and return to main browser?')) {
                    localStorage.removeItem('ziegler_active_session_code');
                    localStorage.removeItem('ziegler_active_session_id');
                    localStorage.removeItem('ziegler_active_session_team_id');
                    setActiveSession(null);
                    router.push('/dashboard');
                  }
                }}
                className="text-[10px] text-slate-400 hover:text-rose-600 font-bold transition-colors block text-left"
              >
                Disconnect Session
              </button>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-relaxed">No active session. Choose or create a lobby in the browser.</p>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    item.active
                      ? 'bg-indigo-50 text-indigo-750 border border-indigo-100/40 shadow-xs'
                      : 'text-slate-500 hover:text-slate-905 hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${item.active ? 'text-indigo-650' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User profile & Logout */}
        <div className="p-6 border-t border-slate-105 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500">
              <User className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {user ? user.email : 'Sandbox Mode'}
              </p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                {isConfigured ? 'Authenticated' : 'Offline Sandbox'}
              </p>
            </div>
          </div>
          {isConfigured && (
            <button
              onClick={signOut}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-rose-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* 2. MOBILE TOP HEADER */}
      <header className="lg:hidden h-16 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between sticky top-0 z-20 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 bg-indigo-650 rounded-lg flex items-center justify-center text-white">
            <Layers className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight text-slate-900 text-xs">Ziegler Inventory</span>
          {activeSession && (
            <span className="text-[9px] bg-indigo-50 text-indigo-750 border border-indigo-100 font-bold uppercase tracking-wide px-1.5 py-0.5 rounded font-mono ml-2">
              {activeSession}
            </span>
          )}
        </div>
        
        {isConfigured && (
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4.5 w-4.5" />
          </button>
        )}
      </header>

      {/* 3. MAIN WORKSPACE CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 overflow-y-auto">
        {children}
      </main>

      {/* 4. MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-6 flex items-center justify-around z-20 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] h-full transition-all relative ${
                item.active ? 'text-indigo-650' : 'text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-bold tracking-tight">{item.name.split(' ')[0]}</span>
              {item.active && (
                <span className="absolute bottom-1 h-1 w-5 bg-indigo-600 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
