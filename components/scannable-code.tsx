'use client';

import React, { useEffect, useRef, useState } from 'react';

export type CodeType = 'qrcode' | 'datamatrix' | 'code128' | 'code39' | 'ean13' | 'upca' | 'pdf417';

interface ScannableCodeProps {
  value: string;
  type: CodeType;
  scale?: number;
  height?: number; // Height in mm (for 1D barcodes)
  includeText?: boolean;
}

export default function ScannableCode({
  value,
  type,
  scale = 2,
  height = 10,
  includeText = false,
}: ScannableCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    setError(null);

    // Dynamic import guarantees browser-only execution and forces Next.js
    // to resolve the browser ESM build (bwip-js.mjs) instead of the Node build.
    import('bwip-js/browser').then((bwipjs) => {
      if (!canvasRef.current) return;
      try {
        let bcid: string = type;
        let cleanedValue = value;

        if (type === 'code39') {
          // Code 39: uppercase alphanumeric + - . $ / + % space only
          cleanedValue = value.toUpperCase().replace(/[^A-Z0-9\-\. \$\/\+\%]/g, '');
        } else if (type === 'ean13') {
          // Numeric only, pad/trim to 12-13 digits
          cleanedValue = value.replace(/[^0-9]/g, '');
          if (cleanedValue.length < 12) cleanedValue = cleanedValue.padEnd(12, '0');
          else if (cleanedValue.length > 13) cleanedValue = cleanedValue.slice(0, 13);
        } else if (type === 'upca') {
          // Numeric only, pad/trim to 11-12 digits
          cleanedValue = value.replace(/[^0-9]/g, '');
          if (cleanedValue.length < 11) cleanedValue = cleanedValue.padEnd(11, '0');
          else if (cleanedValue.length > 12) cleanedValue = cleanedValue.slice(0, 12);
        }

        if (!cleanedValue) {
          throw new Error('Empty or invalid value for this barcode type');
        }

        // toCanvas(canvas, options) — synchronous browser render
        bwipjs.toCanvas(canvasRef.current, {
          bcid: bcid,
          text: cleanedValue,
          scale: scale,
          height: type === 'qrcode' || type === 'datamatrix' ? undefined : height,
          includetext: includeText,
          textxalign: 'center',
        });
      } catch (e: any) {
        // bwip-js throws plain strings, not Error objects
        const msg = typeof e === 'string' ? e : (e?.message || 'Render error');
        console.warn('bwip-js render error:', msg);
        setError(msg);
      }
    }).catch((e) => {
      console.warn('bwip-js load error:', e);
      setError('Failed to load barcode library');
    });
  }, [value, type, scale, height, includeText]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-2 border border-rose-100 bg-rose-50/50 rounded-xl text-[9px] text-rose-600 font-semibold max-w-[130px] min-h-[50px] text-center select-none">
        <span>Format Error</span>
        <span className="text-[7.5px] text-rose-450 font-normal mt-0.5 tracking-wider truncate max-w-full">
          {type.toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center p-1.5 bg-white border border-slate-100 rounded-xl shadow-3xs select-none">
      <canvas ref={canvasRef} className="max-w-full block h-auto object-contain" />
    </div>
  );
}
