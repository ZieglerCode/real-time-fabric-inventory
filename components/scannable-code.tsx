'use client';

import React, { useEffect, useRef, useState } from 'react';
import bwipjs from 'bwip-js';

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
    try {
      let bcid: string = type;
      let cleanedValue = value;

      if (type === 'qrcode') {
        bcid = 'qrcode';
      } else if (type === 'datamatrix') {
        bcid = 'datamatrix';
      } else if (type === 'code128') {
        bcid = 'code128';
      } else if (type === 'code39') {
        bcid = 'code39';
        // Code 39 supports uppercase alphanumeric, space, and - . $ / + %
        cleanedValue = value.toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
      } else if (type === 'ean13') {
        bcid = 'ean13';
        // Numeric only, must be 12 digits (or 13 with checksum)
        cleanedValue = value.replace(/[^0-9]/g, '');
        if (cleanedValue.length < 12) {
          cleanedValue = cleanedValue.padEnd(12, '0');
        } else if (cleanedValue.length > 13) {
          cleanedValue = cleanedValue.slice(0, 13);
        }
      } else if (type === 'upca') {
        bcid = 'upca';
        // Numeric only, must be 11 digits (or 12 with checksum)
        cleanedValue = value.replace(/[^0-9]/g, '');
        if (cleanedValue.length < 11) {
          cleanedValue = cleanedValue.padEnd(11, '0');
        } else if (cleanedValue.length > 12) {
          cleanedValue = cleanedValue.slice(0, 12);
        }
      } else if (type === 'pdf417') {
        bcid = 'pdf417';
      }

      if (!cleanedValue) {
        throw new Error('Empty or invalid value for this barcode type');
      }

      // Render onto target canvas element
      bwipjs.toCanvas(canvasRef.current, {
        bcid: bcid,
        text: cleanedValue,
        scale: scale,
        height: type === 'qrcode' || type === 'datamatrix' ? undefined : height,
        includetext: includeText,
        textxalign: 'center',
      });
    } catch (e: any) {
      console.warn('Barcode rendering error:', e);
      setError(e.message || 'Error rendering');
    }
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
