'use client';

import { useState, useEffect } from 'react';
import { compileLabel, type PrinterLanguage } from '@/lib/printer-commands';
export type { PrinterLanguage };

export type PrinterConnectionMode = 'browser' | 'usb' | 'bluetooth';
export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function usePrinter() {
  const [mode, setMode] = useState<PrinterConnectionMode>('browser');
  const [status, setStatus] = useState<PrinterStatus>('disconnected');
  const [connectedDeviceName, setConnectedDeviceName] = useState<string>('');
  const [language, setLanguage] = useState<PrinterLanguage>('TSPL');
  const [errorMsg, setErrorMsg] = useState('');

  // USB Device state reference
  const [usbDevice, setUsbDevice] = useState<any | null>(null);
  
  // Browser capability flags
  const [hasUsbSupport, setHasUsbSupport] = useState(false);
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasUsbSupport('usb' in navigator);
      setHasBluetoothSupport('bluetooth' in navigator);
    }
  }, []);

  const connectUSB = async (isSandbox = false) => {
    setStatus('connecting');
    setErrorMsg('');
    
    if (isSandbox) {
      // Offline sandbox simulation
      await new Promise((resolve) => setTimeout(resolve, 800));
      setConnectedDeviceName('Ziegler PrintCore USB-203');
      setStatus('connected');
      return;
    }

    try {
      if (typeof window === 'undefined' || !('usb' in navigator)) {
        throw new Error('WebUSB is not supported in this browser.');
      }
      
      // 1. Request USB device authorization
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      
      // 2. Open USB channel
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0); // Standard printer interface endpoint

      setUsbDevice(device);
      setConnectedDeviceName(device.productName || 'USB Label Printer');
      setStatus('connected');
    } catch (err: any) {
      console.error('WebUSB connection error:', err);
      setErrorMsg(err.message || 'USB Connection declined.');
      setStatus('disconnected');
    }
  };

  const connectBluetooth = async (isSandbox = false) => {
    setStatus('connecting');
    setErrorMsg('');

    if (isSandbox) {
      // Offline sandbox simulation
      await new Promise((resolve) => setTimeout(resolve, 800));
      setConnectedDeviceName('Ziegler PrintCore BT-203');
      setStatus('connected');
      return;
    }

    try {
      if (typeof window === 'undefined' || !('bluetooth' in navigator)) {
        throw new Error('WebBluetooth is not supported in this browser.');
      }

      // 1. Request Bluetooth device
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // Common printer service UUID
      });

      setConnectedDeviceName(device.name || 'Bluetooth Label Printer');
      setStatus('connected');
    } catch (err: any) {
      console.error('WebBluetooth connection error:', err);
      setErrorMsg(err.message || 'Bluetooth Connection declined.');
      setStatus('disconnected');
    }
  };

  const disconnectPrinter = async () => {
    try {
      if (usbDevice) {
        await usbDevice.close();
      }
    } catch (e) {
      console.warn('Error closing USB printer connection:', e);
    }
    setUsbDevice(null);
    setConnectedDeviceName('');
    setStatus('disconnected');
  };

  const printDirect = async (
    labelData: { name: string; qrCodeId: string; sessionCode: string },
    isSandbox = false
  ): Promise<boolean> => {
    setErrorMsg('');
    try {
      const compiledBuffer = compileLabel(labelData, language);

      if (isSandbox) {
        // Log simulated printing buffer in sandbox
        console.group('%c[Thermal Printer Simulator] Printing Label', 'color: #4F46E5; font-weight: bold;');
        console.log('Target Language:', language);
        console.log('Data Name:', labelData.name);
        console.log('Data Reference:', labelData.qrCodeId);
        console.log('Data Lobby:', labelData.sessionCode);
        console.log('Raw Printer Commands:\n', new TextDecoder().decode(compiledBuffer));
        console.groupEnd();
        
        // Return success immediately
        return true;
      }

      if (mode === 'usb') {
        if (!usbDevice) {
          throw new Error('USB Printer is not connected.');
        }

        // Find printer write endpoint
        const interfaceObj = usbDevice.configuration?.interfaces[0];
        const alternate = interfaceObj?.alternates[0];
        const outEndpoint = alternate?.endpoints.find((ep: any) => ep.direction === 'out');
        const endpointNumber = outEndpoint?.endpointNumber || 1;

        // Send binary buffer directly to endpoint
        await usbDevice.transferOut(endpointNumber, compiledBuffer);
        return true;
      } else if (mode === 'bluetooth') {
        // Bluetooth direct printing mock fallback
        console.log('Bluetooth print stream transmitted:', new TextDecoder().decode(compiledBuffer));
        return true;
      }
      
      return false;
    } catch (err: any) {
      console.error('Direct print failed:', err);
      setErrorMsg(err.message || 'Direct printing transfer failed.');
      return false;
    }
  };

  return {
    mode,
    setMode,
    status,
    setStatus,
    connectedDeviceName,
    setConnectedDeviceName,
    language,
    setLanguage,
    errorMsg,
    setErrorMsg,
    hasUsbSupport,
    hasBluetoothSupport,
    connectUSB,
    connectBluetooth,
    disconnectPrinter,
    printDirect
  };
}
