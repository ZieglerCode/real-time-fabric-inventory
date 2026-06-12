'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

interface PublicQrScannerProps {
  isOpen: boolean;
  onClose: () => void;
}

type DetectedBarcode = {
  rawValue: string;
};

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

function getViewerTarget(rawValue: string): string | null {
  const value = rawValue.trim();
  const fabricMatch = value.match(/FABRIC-[A-Z0-9-]+/i);

  try {
    const url = new URL(value, window.location.origin);
    const publicFabricMatch = url.pathname.match(/\/public\/fabrics\/([^/]+)/);
    const apiFabricMatch = url.pathname.match(/\/api\/public\/fabrics\/([^/]+)/);

    if (publicFabricMatch) {
      return url.href;
    }

    if (apiFabricMatch) {
      return `/public/fabrics/${encodeURIComponent(decodeURIComponent(apiFabricMatch[1]))}`;
    }
  } catch {
    // Fall through to direct fabric id parsing.
  }

  if (fabricMatch) {
    return `/public/fabrics/${encodeURIComponent(fabricMatch[0].toUpperCase())}`;
  }

  return null;
}

export default function PublicQrScanner({ isOpen, onClose }: PublicQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const stopCamera = () => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const startScanner = async () => {
      setIsStarting(true);
      setErrorText('');

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not available in this browser.');
        }

        const BarcodeDetector = (window as any).BarcodeDetector as BarcodeDetectorConstructor | undefined;
        if (!BarcodeDetector) {
          throw new Error('This browser cannot scan QR codes directly. Paste or type the fabric code below.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetector({ formats: ['qr_code'] });

        const scanFrame = async () => {
          if (!videoRef.current || cancelled) return;

          try {
            const detected = await detector.detect(videoRef.current);
            const rawValue = detected[0]?.rawValue;

            if (rawValue) {
              const target = getViewerTarget(rawValue);
              if (target) {
                stopCamera();
                window.location.href = target;
                return;
              }

              setErrorText('QR code found, but it is not a fabric QR code.');
            }
          } catch {
            // Ignore transient detection errors while the camera is warming up.
          }

          frameRef.current = window.requestAnimationFrame(scanFrame);
        };

        frameRef.current = window.requestAnimationFrame(scanFrame);
      } catch (err: any) {
        setErrorText(err.message || 'Camera could not be started.');
      } finally {
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen]);

  const handleManualSubmit = () => {
    const target = getViewerTarget(manualValue);
    if (!target) {
      setErrorText('Please enter a valid fabric QR code, e.g. FABRIC-3313ED11.');
      return;
    }

    window.location.href = target;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <header className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Camera Scanner</p>
            <h2 className="text-xl font-black tracking-tight">Scan fabric QR</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <section className="flex-1 px-4 pb-4">
          <div className="relative h-full min-h-[420px] overflow-hidden rounded-[2rem] bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,transparent_42%,rgba(2,6,23,0.68)_43%,rgba(2,6,23,0.82)_100%)]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border-2 border-white shadow-[0_0_0_999px_rgba(2,6,23,0.18)]" />

            {isStarting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/60">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm font-black">Opening camera...</p>
              </div>
            )}
          </div>
        </section>

        <div className="space-y-3 px-4 pb-5">
          <p className="text-center text-xs font-bold leading-relaxed text-white/60">
            Point the camera at a fabric QR code. It will open automatically after detection.
          </p>

          {errorText && (
            <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-xs font-bold leading-relaxed text-white">
              {errorText}
            </div>
          )}

          <div className="rounded-[1.5rem] bg-white p-2">
            <div className="flex gap-2">
              <input
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="FABRIC-3313ED11"
                className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black uppercase text-slate-950 outline-none"
              />
              <button
                type="button"
                onClick={handleManualSubmit}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
              >
                <Camera className="h-4 w-4" />
                Open
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
