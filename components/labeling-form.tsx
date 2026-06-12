'use client';

import React from 'react';
import { Tag, Loader2, AlertCircle, ArrowRight, Ban, CheckCircle2, Pencil } from 'lucide-react';

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
  color?: string | null;
  pattern?: string | null;
  material?: string | null;
}

interface LabelingFormProps {
  activeFabric: Fabric;
  fabricName: string;
  setFabricName: (name: string) => void;
  color: string;
  setColor: (color: string) => void;
  pattern: string;
  setPattern: (pattern: string) => void;
  material: string;
  setMaterial: (material: string) => void;
  isDiscarding: boolean;
  setIsDiscarding: (val: boolean) => void;
  rejectionReason: string;
  setRejectionReason: (val: string) => void;
  saving: boolean;
  onSubmitLabel: (e: React.FormEvent) => void;
  onSubmitDiscard: (e: React.FormEvent) => void;
  detectLoading: boolean;
  handleFetchSuggestions: () => void;
  suggestions: { name: string; color: string; pattern: string; material: string } | null;
  detectError: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function LabelingForm({
  activeFabric,
  fabricName,
  setFabricName,
  color,
  setColor,
  pattern,
  setPattern,
  material,
  setMaterial,
  isDiscarding,
  setIsDiscarding,
  rejectionReason,
  setRejectionReason,
  saving,
  onSubmitLabel,
  onSubmitDiscard,
  detectLoading,
  handleFetchSuggestions,
  suggestions,
  detectError,
  inputRef
}: LabelingFormProps) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-5 flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
        <Tag className="h-5 w-5 text-indigo-650" />
        <h3 className="font-bold text-slate-800 text-base">Label Fabric</h3>
      </div>

      {!isDiscarding ? (
        <form onSubmit={onSubmitLabel} className="space-y-4">

          {/* Pre-labeled badge — shown when photographer already added a title */}
          {activeFabric.name && (
            <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in fade-in duration-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Bereits vom Fotografen beschriftet</p>
                <p className="text-xs text-emerald-700 font-semibold mt-0.5 truncate">&ldquo;{activeFabric.name}&rdquo;</p>
              </div>
              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">Vorausgefüllt</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label htmlFor="fabric-name-input" className="text-xs font-bold text-slate-550 uppercase tracking-wider block flex items-center gap-1.5">
                {activeFabric.name ? (
                  <><Pencil className="h-3 w-3 text-slate-400" /> Titel bearbeiten (optional)</>  
                ) : (
                  'Fabric Name / Pattern Variant'
                )}
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
                    onClick={() => {
                      setFabricName(suggestions.name);
                      setColor(suggestions.color);
                      setPattern(suggestions.pattern);
                      setMaterial(suggestions.material);
                    }}
                    className="text-[10px] text-indigo-650 hover:text-indigo-805 font-bold uppercase tracking-widest cursor-pointer"
                  >
                    Apply all suggestions
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
                    onClick={() => {
                      setFabricName(suggestions.name);
                      setColor(suggestions.color);
                      setPattern(suggestions.pattern);
                      setMaterial(suggestions.material);
                    }}
                    className="shrink-0 text-[10px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-2 py-1 rounded-lg text-indigo-700 font-bold transition-all cursor-pointer"
                  >
                    Use All
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
              placeholder={activeFabric.name
                ? 'Titel überschreiben oder lehr lassen...'
                : 'e.g. Indigo Herringbone Linen, Silk Satin 03'
              }
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 font-medium text-slate-900 focus:bg-white text-sm"
              disabled={saving}
            />

            {/* Structured attributes fields grid */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label htmlFor="fabric-color-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Farbe
                </label>
                <input
                  type="text"
                  id="fabric-color-input"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="z.B. Blau"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 text-xs font-semibold text-slate-800 focus:bg-white"
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="fabric-pattern-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Muster
                </label>
                <input
                  type="text"
                  id="fabric-pattern-input"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="z.B. Karo"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 text-xs font-semibold text-slate-800 focus:bg-white"
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="fabric-material-input" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Material
                </label>
                <input
                  type="text"
                  id="fabric-material-input"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  placeholder="z.B. Seide"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder:text-slate-400 text-xs font-semibold text-slate-800 focus:bg-white"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || !fabricName.trim()}
            className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer border-b-2 ${
              saving || !fabricName.trim()
                ? 'bg-slate-100 text-slate-400 border border-slate-200 border-b-slate-200 cursor-not-allowed shadow-none'
                : activeFabric.name
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-100 border-emerald-800'
                  : 'bg-indigo-650 hover:bg-indigo-700 text-white shadow-indigo-100 border-indigo-805'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Saving label...</span>
              </>
            ) : activeFabric.name ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Bestätigen & QR generieren</span>
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
              className="text-xs font-semibold text-rose-650 hover:text-rose-700 flex items-center gap-1.5 transition-colors cursor-pointer border border-transparent hover:border-rose-100 hover:bg-rose-50 px-3 py-2 rounded-xl"
            >
              <Ban className="h-3.5 w-3.5" />
              Unsuitable photo? Request retake
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSubmitDiscard} className="space-y-4 animate-in fade-in duration-200">
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
              className="py-3 bg-rose-600 hover:bg-rose-705 disabled:bg-rose-100 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-rose-100 border-b-2 border-rose-800"
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
  );
}
