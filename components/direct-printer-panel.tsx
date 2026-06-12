'use client';

import React, { useState } from 'react';
import { CheckCircle2, Printer, Usb, Bluetooth, AlertCircle, Loader2 } from 'lucide-react';
import { LabelCodeKind, LabelLayout, usePrinter, PrinterLanguage } from '@/hooks/use-printer';
import ScannableCode, { CodeType } from '@/components/scannable-code';
import { getPublicFabricViewerUrl } from '@/lib/fabric-public-url';

interface DirectPrinterPanelProps {
  savedQrData: { id: string; name: string; teamName?: string } | null;
  sessionCode: string;
  connectionStatus: string;
  print2DFormat: CodeType;
  setPrint2DFormat: (type: CodeType) => void;
  print1DFormat: CodeType;
  setPrint1DFormat: (type: CodeType) => void;
}

// SVG grid icon used as logo on the sticker footer
const GridIcon = () => (
  <svg className="h-3.5 w-3.5 text-slate-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
  </svg>
);

export default function DirectPrinterPanel({
  savedQrData,
  sessionCode,
  connectionStatus,
  print2DFormat,
  setPrint2DFormat,
  print1DFormat,
  setPrint1DFormat
}: DirectPrinterPanelProps) {
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

  // Code visibility toggles — max 2 per sticker
  const [show2D, setShow2D] = useState(true);
  const [show1D, setShow1D] = useState(true);
  const [labelLayout, setLabelLayout] = useState<LabelLayout>('standard');
  const [minimalCodeKind, setMinimalCodeKind] = useState<LabelCodeKind>('2d');

  if (!savedQrData) return null;
  const publicViewerUrl = getPublicFabricViewerUrl(savedQrData.id);

  const handlePrint = async () => {
    if (printerMode === 'browser') {
      window.print();
    } else {
      const labelData = {
        name: savedQrData.name || 'Unnamed Fabric',
        qrCodeId: savedQrData.id || '',
        sessionCode: sessionCode || 'SANDBOX',
        layout: labelLayout,
        codeKind: minimalCodeKind,
        publicUrl: publicViewerUrl
      };
      await printDirect(labelData, connectionStatus === 'local');
    }
  };

  // Determine code layout scales based on which codes are shown
  const isMinimal = labelLayout === 'minimal';
  const both = !isMinimal && show2D && show1D;
  const qrScale = isMinimal ? 1.05 : both ? 1.2 : 2;
  const barScale = isMinimal ? 1.05 : both ? 0.8 : 1;
  const barHeight = isMinimal ? 12 : both ? 7 : 10;

  const footerText = savedQrData.teamName
    ? `${savedQrData.teamName} Textile`
    : 'Textile Catalog';

  return (
    <div className="bg-white rounded-3xl border border-emerald-250 p-6 shadow-md animate-in fade-in zoom-in duration-300 print-tag-box bg-emerald-50/10 space-y-4">
      <div className="flex items-center gap-2 text-emerald-800 font-bold">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="text-xs">Sticker Label Generated!</span>
      </div>

      {/* ── STICKER PREVIEW ── 50mm × 30mm thermal label */}
      <div className="flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-150/80 p-3 print:bg-white print:p-0">
        <div
          id="thermal-sticker-label"
          className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col"
          style={{ width: 288, height: 172 }} /* 2.2in × 1.2in @ 96dpi preview */
        >
          {/* Header: name + ref */}
          <div className={`${isMinimal ? 'px-4 pt-3 pb-1' : 'px-3 pt-2.5 pb-1'} text-center w-full min-w-0 shrink-0`}>
            <p className={`${isMinimal ? 'text-[10px]' : 'text-[11px]'} font-extrabold leading-tight truncate ${
              savedQrData.name ? 'text-slate-950' : 'text-slate-400 italic'
            }`}>
              {savedQrData.name || 'Unnamed Fabric'}
            </p>
            {!isMinimal && (
              <p className="text-[7px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5 truncate">
                {savedQrData.id}
              </p>
            )}
          </div>

          {/* Codes area – grows to fill, clips overflow */}
          <div className={`${isMinimal ? 'pb-3 px-4' : 'px-2'} flex-1 flex items-center justify-center gap-2 overflow-hidden min-h-0`}>
            {isMinimal ? (
              minimalCodeKind === '2d' ? (
                <div className="shrink-0 max-h-[112px] max-w-[112px] overflow-hidden flex items-center justify-center">
                  <ScannableCode value={publicViewerUrl} type={print2DFormat} scale={qrScale} />
                </div>
              ) : (
                <div className="shrink-0 max-w-[246px] overflow-hidden">
                  <ScannableCode value={savedQrData.id} type={print1DFormat} scale={barScale} height={barHeight} />
                </div>
              )
            ) : !show2D && !show1D ? (
              <p className="text-[9px] text-slate-400 font-medium">No code selected</p>
            ) : both ? (
              /* Both codes: QR square left | slim barcode right */
              <>
                <div className="shrink-0">
                  <ScannableCode value={publicViewerUrl} type={print2DFormat} scale={qrScale} />
                </div>
                <div className="shrink-0 overflow-hidden max-w-[136px]">
                  <ScannableCode value={savedQrData.id} type={print1DFormat} scale={barScale} height={barHeight} />
                </div>
              </>
            ) : show2D ? (
              /* Only 2D — centered, bigger */
              <div className="shrink-0">
                  <ScannableCode value={publicViewerUrl} type={print2DFormat} scale={qrScale} />
              </div>
            ) : (
              /* Only 1D barcode — centered, wider */
              <div className="shrink-0 max-w-[256px] overflow-hidden">
                <ScannableCode value={savedQrData.id} type={print1DFormat} scale={barScale} height={barHeight} />
              </div>
            )}
          </div>

          {/* Footer */}
          {!isMinimal && (
            <div className="px-3 pb-2 pt-1 border-t border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-[6.5px] font-bold text-slate-400 uppercase tracking-widest truncate mr-2">
                {footerText}
              </span>
              <GridIcon />
            </div>
          )}
        </div>
      </div>

      {/* ── PRINTER CONFIGURATION PANEL ── */}
      <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4 print:hidden">
        {/* Printer Mode Tabs */}
        <div>
          <label className="block text-[9.5px] font-bold text-slate-550 mb-1.5 uppercase tracking-wider">Printer Mode</label>
          <div className="grid grid-cols-3 gap-2 bg-slate-200/50 p-1 rounded-xl">
            {(['browser', 'usb', 'bluetooth'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPrinterMode(m)}
                className={`py-1.5 text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  printerMode === m
                    ? 'bg-white text-indigo-650 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'browser' ? <Printer className="h-3 w-3" /> : m === 'usb' ? <Usb className="h-3 w-3" /> : <Bluetooth className="h-3 w-3" />}
                <span>{m === 'browser' ? 'System' : m === 'usb' ? 'USB' : 'Bluetooth'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Direct Connection Drawer */}
        {printerMode !== 'browser' && (
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-550 text-[10px] uppercase tracking-wider">Status:</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${
                  printerStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                  printerStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
                  printerStatus === 'error' ? 'bg-rose-500' : 'bg-slate-400'
                }`} />
                <span className="text-[11px] font-bold capitalize text-slate-705">
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
                <button type="button" onClick={disconnectPrinter}
                  className="text-[10px] font-bold text-rose-650 hover:text-rose-800 px-2 py-1 bg-white border border-rose-100 hover:border-rose-200 rounded-lg shadow-2xs transition-all cursor-pointer">
                  Disconnect
                </button>
              </div>
            )}

            {printerStatus !== 'connected' && (
              <>
                {((printerMode === 'usb' && !hasUsbSupport) || (printerMode === 'bluetooth' && !hasBluetoothSupport)) ? (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2 text-amber-800 text-[10.5px] font-medium leading-relaxed">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <p>Direct {printerMode === 'usb' ? 'USB' : 'Bluetooth'} requires Chrome / Edge on Desktop.</p>
                  </div>
                ) : (
                  <button type="button" disabled={printerStatus === 'connecting'}
                    onClick={() => printerMode === 'usb' ? connectUSB(connectionStatus === 'local') : connectBluetooth(connectionStatus === 'local')}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white ${
                      printerStatus === 'connecting'
                        ? 'bg-slate-350 cursor-not-allowed shadow-none'
                        : 'bg-indigo-650 hover:bg-indigo-750 shadow-indigo-100 border-b border-indigo-850'
                    }`}>
                    {printerStatus === 'connecting' ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Searching...</span></>
                    ) : (
                      <>{printerMode === 'usb' ? <Usb className="h-3.5 w-3.5" /> : <Bluetooth className="h-3.5 w-3.5" />}<span>Connect {printerMode === 'usb' ? 'USB' : 'Bluetooth'} Printer</span></>
                    )}
                  </button>
                )}
              </>
            )}

            {printerErrorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-[10.5px] font-medium flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                <span className="truncate">{printerErrorMsg}</span>
              </div>
            )}

            <div className="pt-1.5">
              <label className="block text-[9.5px] font-bold text-slate-550 mb-1 uppercase tracking-wider">Printer Language</label>
              <select value={printerLanguage} onChange={(e) => setPrinterLanguage(e.target.value as PrinterLanguage)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700">
                <option value="TSPL">TSPL (Munbyn, Xprinter, Rollo, TSC)</option>
                <option value="ZPL">ZPL (Zebra Printers)</option>
              </select>
            </div>
          </div>
        )}

        {/* ── CODE SELECTION ── */}
        <div className="space-y-3">
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Label Layout</h4>
            <div className="grid grid-cols-2 gap-2 bg-slate-200/50 p-1 rounded-xl">
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
              <label className="block text-[9.5px] font-bold text-slate-550 mb-1">Minimal Code</label>
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

          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Codes on Sticker</h4>

          {/* Toggle buttons for show/hide each code */}
          {!isMinimal && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShow2D(v => !v)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                show2D
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-400 line-through'
              }`}
            >
              <span className="text-base leading-none">{show2D ? '☑' : '☐'}</span>
              2D Code
            </button>
            <button
              type="button"
              onClick={() => setShow1D(v => !v)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                show1D
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-slate-200 text-slate-400 line-through'
              }`}
            >
              <span className="text-base leading-none">{show1D ? '☑' : '☐'}</span>
              1D Barcode
            </button>
          </div>
          )}

          {/* Format selectors — only shown when the code is active */}
          <div className="grid grid-cols-2 gap-3">
            {show2D && (
              <div>
                <label className="block text-[9.5px] font-bold text-slate-550 mb-1">2D Format</label>
                <select value={print2DFormat} onChange={(e) => setPrint2DFormat(e.target.value as CodeType)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700">
                  <option value="qrcode">QR Code</option>
                  <option value="datamatrix">Data Matrix</option>
                  <option value="pdf417">PDF417</option>
                </select>
              </div>
            )}
            {show1D && (
              <div className={show2D ? '' : 'col-span-2'}>
                <label className="block text-[9.5px] font-bold text-slate-550 mb-1">1D Format</label>
                <select value={print1DFormat} onChange={(e) => setPrint1DFormat(e.target.value as CodeType)}
                  className="w-full bg-white border border-slate-200 rounded-xl text-xs font-semibold px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700">
                  <option value="code128">Code 128</option>
                  <option value="code39">Code 39</option>
                  <option value="ean13">EAN-13 (Numeric)</option>
                  <option value="upca">UPC-A (Numeric)</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action footer */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-200/60 print:hidden">
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(savedQrData.id); alert('Reference ID copied!'); }}
          className="text-slate-400 hover:text-slate-650 transition-all font-semibold cursor-pointer text-xs"
        >
          Copy Reference ID
        </button>
        <button
          type="button"
          disabled={printerMode !== 'browser' && printerStatus !== 'connected'}
          onClick={handlePrint}
          className={`inline-flex items-center gap-1.5 px-4.5 py-2 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md border-b ${
            (printerMode !== 'browser' && printerStatus !== 'connected')
              ? 'bg-slate-350 border-slate-400 cursor-not-allowed shadow-none'
              : 'bg-indigo-650 hover:bg-indigo-750 shadow-indigo-150 border-b border-indigo-850'
          }`}
        >
          <Printer className="h-3.5 w-3.5" />
          <span>Print Sticker</span>
        </button>
      </div>
    </div>
  );
}
