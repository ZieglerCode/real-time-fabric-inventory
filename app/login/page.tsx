'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { KeyRound, Mail, ArrowRight, Loader2, Compass, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const [isConfigured] = useState<boolean>(() => isSupabaseConfigured());
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return;

    setLoading(true);
    setErrorText('');
    setSuccessText('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setSuccessText('Registration successful! Check your email to verify your account or sign in directly.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.push('/');
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSandboxAccess = () => {
    // Navigate straight to dashboard if not configured
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Dynamic blurred background accents */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-40 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-violet-200 rounded-full blur-3xl opacity-40 pointer-events-none" />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 shadow-xl relative z-10 animate-panel">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-200/50 items-center justify-center text-indigo-650 mb-4">
            <KeyRound className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory Hub Portal
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {isConfigured ? 'Sign in to access your shared workspace' : 'Explore the digitized inventory sandbox'}
          </p>
        </div>

        {isConfigured ? (
          <form onSubmit={handleAuth} className="space-y-5">
            {errorText && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{errorText}</span>
              </div>
            )}

            {successText && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{successText}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="email-input"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white text-sm font-medium transition-all text-slate-900"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password-input" className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-50/50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none focus:bg-white text-sm font-medium transition-all text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-650 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-150 transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-indigo-805"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Please wait...</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {/* Toggle Sign Up / Sign In */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorText('');
                  setSuccessText('');
                }}
                className="text-xs text-indigo-650 hover:text-indigo-805 font-semibold cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-850 text-xs flex flex-col gap-1.5 leading-relaxed">
              <span className="font-bold flex items-center gap-1.5"><Compass className="h-4 w-4 text-amber-600" /> Server Connectivity Standby</span>
              <span>No active cloud credentials detected in environment. The system will operate in offline-sandbox mode.</span>
            </div>

            <button
              onClick={handleSandboxAccess}
              className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-150 transition-all flex items-center justify-center gap-2 cursor-pointer border-b-2 border-indigo-805"
            >
              <span>Launch Local Sandbox</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
