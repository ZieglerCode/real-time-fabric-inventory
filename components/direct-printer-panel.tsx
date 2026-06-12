'use client';

import React from 'react';
import { CheckCircle2, Printer, Usb, Bluetooth, AlertCircle, Loader2 } from 'lucide-react';
import { usePrinter, PrinterLanguage } from '@/hooks/use-printer';
import ScannableCode, { CodeType } from '@/components/scannable-code';

interface DirectPrinterPanelProps {
  savedQrData: { id: string; name: string } | null;
  sessionCode: string;
  connectionStatus: string;
  print2DFormat: CodeType;
  setPrint2DFormat: (type: CodeType) => void;
  print1DFormat: CodeType;
  setPrint1DFormat: (type: CodeType) => void;
}

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

  if (!savedQrData) return null;

  const handlePrint = async () => {
    if (printerMode === 'browser') {
      window.print();
    } else {
      const labelData = {
        name: savedQrData.name || 'Unnamed Fabric',
        qrCodeId: savedQrData.id || '',
        sessionCode: sessionCode || 'SANDBOX'
      };
      await printDirect(labelData, connectionStatus === 'local');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-emerald-250 p-6 shadow-md animate-in fade-in zoom-in duration-300 print-tag-box bg-emerald-50/10 space-y-4">
      <div className="flex items-center gap-2 text-emerald-800 font-bold">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        <span className="text-xs">Sticker Label Generated!</span>
      </div>

      {/* PRINT ELEMENT STYLED FOR 50mm x 30mm (2x1.2 inch) THERMAL LABEL PRINTERS */}
      <div className="p-4 flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-150/80 print:bg-white print:p-0">
        <div 
          id="thermal-sticker-label" 
          className="bg-white border border-slate-300 p-4 rounded-2xl flex flex-col justify-between items-center text-center shadow-xs w-72 h-44 print:border-none print:shadow-none print:rounded-none print:p-0 print:w-[2.2in] print:h-[1.2in] print:m-0"
        >
          <div className="w-full min-w-0">
            <p className="text-[12px] font-extrabold text-slate-950 truncate print:text-[10px] print:leading-tight">
              {savedQrData.name}
            </p>
            <p className="text-[8px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5 print:text-[7px]">
              ID: {savedQrData.id}
            </p>
          </div>

          {/* Codes side-by-side layout */}
          <div className="flex items-center justify-around w-full gap-4 mt-2">
            <div className="p-0.5 bg-white border border-slate-150 rounded shrink-0 print:border-none">
              <ScannableCode 
                value={savedQrData.id || ''} 
                type={print2DFormat} 
                scale={1.5}
              />
            </div>
            <div className="scale-90 origin-center shrink-0">
              <ScannableCode 
                value={savedQrData.id || ''} 
                type={print1DFormat} 
                scale={1.2} 
                height={9}
              />
            </div>
          </div>

          <div className="w-full border-t border-slate-100 pt-1.5 mt-2 flex justify-between items-center text-[7px] font-bold text-slate-400 uppercase tracking-widest print:text-[6px] print:mt-1">
            <span>Ziegler textile catalog</span>
            <span className="font-mono">{sessionCode.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Printer Configuration Panel */}
      <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4 print:hidden">
        {/* Tab Selector for Printer Connection Mode */}
        <div>
          <label className="block text-[9.5px] font-bold text-slate-550 mb-1.5 uppercase tracking-wider">Printer Mode</label>
          <div className="grid grid-cols-3 gap-2 bg-slate-200/50 p-1 rounded-xl">
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
                        connectUSB(connectionStatus === 'local');
                      } else {
                        connectBluetooth(connectionStatus === 'local');
                      }
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-white ${
                      printerStatus === 'connecting'
                        ? 'bg-slate-350 cursor-not-allowed shadow-none'
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
              <label className="block text-[9.5px] font-bold text-slate-550 mb-1 uppercase tracking-wider">Printer Language</label>
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
              <label className="block text-[9.5px] font-bold text-slate-550 mb-1">2D Format</label>
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
              <label className="block text-[9.5px] font-bold text-slate-550 mb-1">1D Format</label>
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

      {/* Action buttons footer */}
      <div className="flex justify-between items-center pt-3 border-t border-slate-200/60 print:hidden">
        <button 
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(savedQrData.id);
            alert('Label ID code copied to clipboard!');
          }}
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
