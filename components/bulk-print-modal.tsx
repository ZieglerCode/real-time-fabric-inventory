'use client';

import React from 'react';
import { Printer, X, Usb, Bluetooth, Loader2 } from 'lucide-react';
import ScannableCode, { CodeType } from './scannable-code';
import { LabelCodeKind, LabelLayout, PrinterLanguage } from '@/hooks/use-printer';

interface Fabric {
  id: string;
  image_url: string;
  name: string | null;
  qr_code_id: string | null;
  status: 'pending' | 'completed' | 'discarded';
  created_at: string;
  session_code?: string;
  team_name?: string;
}

interface BulkPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  fabrics: Fabric[];
  selectedFabricIds: string[];
  bulkColumns: number;
  setBulkColumns: (cols: number) => void;
  bulkGap: number;
  setBulkGap: (gap: number) => void;
  bulkShowTitle: boolean;
  setBulkShowTitle: (show: boolean) => void;
  bulkShowRef: boolean;
  setBulkShowRef: (show: boolean) => void;
  bulkShow2D: boolean;
  setBulkShow2D: (show: boolean) => void;
  bulkShow1D: boolean;
  setBulkShow1D: (show: boolean) => void;
  bulkShowFooter: boolean;
  setBulkShowFooter: (show: boolean) => void;
  bulkScale: number;
  setBulkScale: (scale: number) => void;
  bulkLabelLayout: LabelLayout;
  setBulkLabelLayout: (layout: LabelLayout) => void;
  bulkMinimalCodeKind: LabelCodeKind;
  setBulkMinimalCodeKind: (kind: LabelCodeKind) => void;
  isPrintingBulk: boolean;
  bulkPrintProgress: number;
  printerMode: 'browser' | 'usb' | 'bluetooth';
  setPrinterMode: (mode: 'browser' | 'usb' | 'bluetooth') => void;
  printerStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectedDeviceName: string;
  printerLanguage: PrinterLanguage;
  setPrinterLanguage: (language: PrinterLanguage) => void;
  disconnectPrinter: () => void;
  connectUSB: (isSandbox?: boolean) => Promise<void>;
  connectBluetooth: (isSandbox?: boolean) => Promise<void>;
  isConfigured: boolean;
  handleBulkPrintDirect: () => void;
  hasUsbSupport: boolean;
  hasBluetoothSupport: boolean;
  printerErrorMsg: string;
  print2DFormat: CodeType;
  print1DFormat: CodeType;
}

export default function BulkPrintModal({
  isOpen,
  onClose,
  fabrics,
  selectedFabricIds,
  bulkColumns,
  setBulkColumns,
  bulkGap,
  setBulkGap,
  bulkShowTitle,
  setBulkShowTitle,
  bulkShowRef,
  setBulkShowRef,
  bulkShow2D,
  setBulkShow2D,
  bulkShow1D,
  setBulkShow1D,
  bulkShowFooter,
  setBulkShowFooter,
  bulkScale,
  setBulkScale,
  bulkLabelLayout,
  setBulkLabelLayout,
  bulkMinimalCodeKind,
  setBulkMinimalCodeKind,
  isPrintingBulk,
  bulkPrintProgress,
  printerMode,
  setPrinterMode,
  printerStatus,
  connectedDeviceName,
  printerLanguage,
  setPrinterLanguage,
  disconnectPrinter,
  connectUSB,
  connectBluetooth,
  isConfigured,
  handleBulkPrintDirect,
  hasUsbSupport,
  hasBluetoothSupport,
  printerErrorMsg,
  print2DFormat,
  print1DFormat,
}: BulkPrintModalProps) {
  if (!isOpen) return null;

  const printableCount = fabrics.filter(
    (f) => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id
  ).length;
  const isMinimal = bulkLabelLayout === 'minimal';

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-40 print:relative print:bg-white print:p-0 print:inset-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 print:border-none print:shadow-none print:rounded-none print:max-h-none print:w-full">
        
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-155 flex items-center justify-between shrink-0 print:hidden">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <Printer className="h-4 w-4 text-indigo-650" />
            <span>Bulk Adhesive Sticker Printing</span>
          </h3>
          <button
            onClick={onClose}
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
              <label className="block text-[9.5px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Printer Mode
              </label>
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
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Grid Layout Options
                </h4>
                
                {/* Columns selection */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-505 mb-1">Grid Columns</label>
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
                  <label className="block text-[9.5px] font-bold text-slate-505 mb-1">Gap Spacing</label>
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
                  <label className="block text-[9.5px] font-bold text-slate-505 mb-1">
                    Label Card Size Scale
                  </label>
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

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-505 mb-1">Label Layout</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    {(['standard', 'minimal'] as const).map((layout) => (
                      <button
                        key={layout}
                        type="button"
                        onClick={() => setBulkLabelLayout(layout)}
                        className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                          bulkLabelLayout === layout
                            ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {layout === 'standard' ? 'Standard' : 'Minimal'}
                      </button>
                    ))}
                  </div>
                </div>

                {isMinimal && (
                  <div>
                    <label className="block text-[9.5px] font-bold text-slate-505 mb-1">Minimal Code</label>
                    <select
                      value={bulkMinimalCodeKind}
                      onChange={(e) => setBulkMinimalCodeKind(e.target.value as LabelCodeKind)}
                      className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="2d">2D Code only</option>
                      <option value="1d">1D Barcode only</option>
                    </select>
                  </div>
                )}

                {/* Element visibility toggles */}
                {!isMinimal && (
                <div className="space-y-2.5 pt-1">
                  <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">
                    Visible Card Info
                  </label>
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
                )}
              </div>
            ) : (
              // Direct Stream Configuration drawer
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Direct Print Controls
                </h4>
                
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
                  {/* Connection status */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-500 text-[10px] uppercase tracking-wider">
                      Status:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          printerStatus === 'connected'
                            ? 'bg-emerald-500 animate-pulse'
                            : printerStatus === 'connecting'
                            ? 'bg-amber-500 animate-pulse'
                            : printerStatus === 'error'
                            ? 'bg-rose-500'
                            : 'bg-slate-400'
                        }`}
                      />
                      <span className="text-[11px] font-bold capitalize text-slate-700">
                        {printerStatus === 'connected'
                          ? 'Connected'
                          : printerStatus === 'connecting'
                          ? 'Connecting...'
                          : printerStatus === 'error'
                          ? 'Connection Error'
                          : 'Disconnected'}
                      </span>
                    </div>
                  </div>

                  {printerStatus === 'connected' && (
                    <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg flex flex-col gap-1.5">
                      <div className="min-w-0">
                        <p className="text-[9px] text-emerald-800 font-bold uppercase tracking-wider">
                          Connected Printer
                        </p>
                        <p className="text-xs font-semibold text-emerald-950 truncate">
                          {connectedDeviceName}
                        </p>
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
                      {(printerMode === 'usb' && !hasUsbSupport) ||
                      (printerMode === 'bluetooth' && !hasBluetoothSupport) ? (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-800 text-[10px] font-medium leading-relaxed">
                          Direct {printerMode === 'usb' ? 'USB' : 'Bluetooth'} is unsupported in this
                          browser. Please use Chrome/Edge on Desktop.
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
                          className="w-full py-2 px-3 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white bg-indigo-650 hover:bg-indigo-750"
                        >
                          {printerStatus === 'connecting'
                            ? 'Searching Device...'
                            : `Connect ${printerMode === 'usb' ? 'USB' : 'Bluetooth'}`}
                        </button>
                      )}
                    </>
                  )}

                  {printerErrorMsg && (
                    <div className="p-2 bg-rose-50 border border-rose-105 text-rose-800 rounded-lg text-[10px] font-medium">
                      {printerErrorMsg}
                    </div>
                  )}

                  {/* Language Selection */}
                  <div className="pt-1 border-t border-slate-100">
                    <label className="block text-[9.5px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                      Printer Language
                    </label>
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Queue Summary
                  </p>
                  <p className="text-xs font-semibold text-slate-700">
                    Total Printable Items: {printableCount} label rolls
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
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Grid Print Sheet Canvas (A4 / Letter size representation)
                </span>
                <span className="text-[10px] bg-slate-100 text-slate-650 px-2 py-0.5 rounded font-bold">
                  {printableCount} Labels
                </span>
              </div>

              {/* GRID CONTAINER TARGETED BY MEDIA PRINT */}
              <div
                id="bulk-grid-print-container"
                className="grid"
                style={
                  {
                    gridTemplateColumns: `repeat(${bulkColumns}, minmax(0, 1fr))`,
                    gap: `${bulkGap}px`,
                    '--grid-cols': bulkColumns,
                  } as React.CSSProperties
                }
              >
                {fabrics
                  .filter((f) => selectedFabricIds.includes(f.id) && f.status === 'completed' && f.qr_code_id)
                  .map((fabric) => (
                    <div
                      key={fabric.id}
                      className={`bulk-grid-label-card bg-white border border-slate-200 rounded-xl flex flex-col items-center text-center shadow-3xs aspect-[2.2/1.2] shrink-0 print:border print:border-slate-300 print:shadow-none print:rounded-none ${
                        isMinimal ? 'justify-center p-4 gap-2' : 'justify-between p-3'
                      }`}
                      style={{
                        transform: `scale(${bulkScale})`,
                        transformOrigin: 'top center',
                        pageBreakInside: 'avoid',
                        breakInside: 'avoid',
                      }}
                    >
                      {(isMinimal || bulkShowTitle) && (
                        <p className={`text-[10px] font-extrabold truncate w-full leading-tight ${
                          fabric.name ? 'text-slate-955' : 'text-slate-400 italic'
                        }`}>
                          {fabric.name || 'Unnamed Fabric'}
                        </p>
                      )}
                      {!isMinimal && bulkShowRef && (
                        <p className="text-[7px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                          ID: {fabric.qr_code_id}
                        </p>
                      )}

                      {/* Code placement inside card */}
                      <div className={`flex items-center justify-center gap-3 w-full ${isMinimal ? '' : 'my-1.5'}`}>
                        {fabric.qr_code_id && (isMinimal ? bulkMinimalCodeKind === '2d' : bulkShow2D) && (
                          <div className="p-0.5 bg-white border border-slate-150 rounded shrink-0">
                            <ScannableCode value={fabric.qr_code_id} type={print2DFormat} scale={isMinimal ? 1.35 : 1} />
                          </div>
                        )}
                        {fabric.qr_code_id && (isMinimal ? bulkMinimalCodeKind === '1d' : bulkShow1D) && (
                          <div className={`${isMinimal ? 'max-w-full overflow-hidden' : 'scale-75'} origin-center shrink-0`}>
                            <ScannableCode
                              value={fabric.qr_code_id}
                              type={print1DFormat}
                              scale={isMinimal ? 0.9 : 0.8}
                              height={isMinimal ? 9 : 6}
                            />
                          </div>
                        )}
                      </div>

                      {!isMinimal && bulkShowFooter && (
                        <div className="w-full border-t border-slate-100 pt-1 flex justify-between items-center leading-none">
                          <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest">
                            {fabric.team_name
                              ? `${fabric.team_name} Textile`
                              : 'Textile Catalog'}
                          </span>
                          <svg className="h-3 w-3 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                          </svg>
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
              onClick={onClose}
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
                    <span>
                      Printing ({bulkPrintProgress}/{printableCount})...
                    </span>
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
  );
}
