'use client';

import React, { useState } from 'react';
import { Printer, X, Usb, Bluetooth, AlertCircle, Loader2 } from 'lucide-react';
import ScannableCode, { CodeType } from './scannable-code';
import { LabelCodeKind, LabelLayout, PrinterLanguage } from '@/hooks/use-printer';
import { getPublicFabricViewerUrl } from '@/lib/fabric-public-url';

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

interface SinglePrintModalProps {
  activePrintFabric: Fabric;
  setActivePrintFabric: (fabric: Fabric | null) => void;
  print2DFormat: CodeType;
  setPrint2DFormat: (format: CodeType) => void;
  print1DFormat: CodeType;
  setPrint1DFormat: (format: CodeType) => void;
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
  handlePrintLabel: (options?: { layout?: LabelLayout; codeKind?: LabelCodeKind }) => void;
  hasUsbSupport: boolean;
  hasBluetoothSupport: boolean;
  printerErrorMsg: string;
}

export default function SinglePrintModal({
  activePrintFabric,
  setActivePrintFabric,
  print2DFormat,
  setPrint2DFormat,
  print1DFormat,
  setPrint1DFormat,
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
  handlePrintLabel,
  hasUsbSupport,
  hasBluetoothSupport,
  printerErrorMsg,
}: SinglePrintModalProps) {
  const [show2D, setShow2D] = useState(true);
  const [show1D, setShow1D] = useState(true);
  const [labelLayout, setLabelLayout] = useState<LabelLayout>('standard');
  const [minimalCodeKind, setMinimalCodeKind] = useState<LabelCodeKind>('2d');

  const isMinimal = labelLayout === 'minimal';
  const both = !isMinimal && show2D && show1D;
  const qrScale = isMinimal ? 1.05 : both ? 1.2 : 2;
  const barScale = isMinimal ? 1.05 : both ? 0.8 : 1;
  const barHeight = isMinimal ? 12 : both ? 7 : 10;
  const codeValue = activePrintFabric.qr_code_id || '';
  const publicViewerUrl = getPublicFabricViewerUrl(codeValue);
  const footerText = activePrintFabric.team_name
    ? `${activePrintFabric.team_name} Textile`
    : 'Textile Catalog';

  return (
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
        <div className="p-6 flex items-center justify-center bg-slate-50/50 print:bg-white print:p-0">
          <div
            id="thermal-sticker-label"
            className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col print:border-none print:shadow-none print:rounded-none print:m-0"
            style={{ width: 288, height: 172 }}
          >
            {/* Header: name + ref */}
            <div className={`${isMinimal ? 'px-4 pt-3 pb-1' : 'px-3 pt-2.5 pb-1'} text-center w-full min-w-0 shrink-0`}>
              <p className={`${isMinimal ? 'text-[10px]' : 'text-[11px]'} font-extrabold leading-tight truncate ${
                activePrintFabric.name ? 'text-slate-950' : 'text-slate-400 italic'
              }`}>
                {activePrintFabric.name || 'Unnamed Fabric'}
              </p>
              {!isMinimal && (
                <p className="text-[7px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                  {codeValue}
                </p>
              )}
            </div>

            {/* Codes area — fills remaining height, clips overflow */}
            <div className={`${isMinimal ? 'pb-3 px-4' : 'px-2'} flex-1 flex items-center justify-center gap-2 overflow-hidden min-h-0`}>
              {isMinimal ? (
                minimalCodeKind === '2d' ? (
                  <div className="shrink-0 max-h-[112px] max-w-[112px] overflow-hidden flex items-center justify-center">
                    <ScannableCode value={publicViewerUrl} type={print2DFormat} scale={qrScale} />
                  </div>
                ) : (
                  <div className="shrink-0 max-w-[246px] overflow-hidden">
                    <ScannableCode value={codeValue} type={print1DFormat} scale={barScale} height={barHeight} />
                  </div>
                )
              ) : !show2D && !show1D ? (
                <p className="text-[9px] text-slate-400 font-medium">No code selected</p>
              ) : both ? (
                <>
                  <div className="shrink-0">
                    <ScannableCode value={publicViewerUrl} type={print2DFormat} scale={qrScale} />
                  </div>
                  <div className="shrink-0 overflow-hidden max-w-[136px]">
                    <ScannableCode value={codeValue} type={print1DFormat} scale={barScale} height={barHeight} />
                  </div>
                </>
              ) : show2D ? (
                <div className="shrink-0">
                  <ScannableCode value={publicViewerUrl} type={print2DFormat} scale={qrScale} />
                </div>
              ) : (
                <div className="shrink-0 max-w-[256px] overflow-hidden">
                  <ScannableCode value={codeValue} type={print1DFormat} scale={barScale} height={barHeight} />
                </div>
              )}
            </div>

            {/* Footer */}
            {!isMinimal && (
              <div className="px-3 pb-2 pt-1 border-t border-slate-100 flex justify-between items-center shrink-0">
                <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest truncate mr-2">
                  {footerText}
                </span>
                <svg className="h-3.5 w-3.5 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Format settings */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 print:hidden space-y-4">
          {/* Tab Selector for Printer Connection Mode */}
          <div>
            <label className="block text-[9.5px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              Printer Mode
            </label>
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
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                      Device
                    </p>
                    <p className="text-xs font-semibold text-emerald-950 truncate">
                      {connectedDeviceName}
                    </p>
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
                  {(printerMode === 'usb' && !hasUsbSupport) ||
                  (printerMode === 'bluetooth' && !hasBluetoothSupport) ? (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2 text-amber-800 text-[10.5px] font-medium leading-relaxed">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-bold">Not Supported</p>
                        <p>
                          Direct {printerMode === 'usb' ? 'USB' : 'Bluetooth'} is unsupported in this
                          browser. Please use Chrome or Edge on Desktop, or switch to System Print.
                        </p>
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
                          {printerMode === 'usb' ? (
                            <Usb className="h-3.5 w-3.5" />
                          ) : (
                            <Bluetooth className="h-3.5 w-3.5" />
                          )}
                          <span>
                            Connect {printerMode === 'usb' ? 'USB Printer' : 'Bluetooth Printer'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              {printerErrorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-805 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5 animate-pulse">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                  <span className="truncate">{printerErrorMsg}</span>
                </div>
              )}

              <div className="pt-1.5">
                <label className="block text-[9.5px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                  Printer Language
                </label>
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
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Label Layout
              </h4>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                {(['standard', 'minimal'] as const).map((layout) => (
                  <button
                    key={layout}
                    type="button"
                    onClick={() => setLabelLayout(layout)}
                    className={`py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      labelLayout === layout
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
                <label className="block text-[9.5px] font-bold text-slate-500 mb-1">Minimal Code</label>
                <select
                  value={minimalCodeKind}
                  onChange={(e) => setMinimalCodeKind(e.target.value as LabelCodeKind)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                >
                  <option value="2d">2D Code only</option>
                  <option value="1d">1D Barcode only</option>
                </select>
              </div>
            )}

            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Label Code Formats
            </h4>
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
              onClick={() => handlePrintLabel({ layout: labelLayout, codeKind: minimalCodeKind })}
              className={`inline-flex items-center gap-1.5 px-4.5 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md border-b ${
                printerMode !== 'browser' && printerStatus !== 'connected'
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
  );
}
