import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onError?: (error: any) => void;
}

export function BarcodeScanner({ onResult, onError }: BarcodeScannerProps) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      /* verbose= */ false
    );
    
    scanner.render(
      (decodedText) => {
        scanner.pause(true);
        onResult(decodedText);
      },
      (error) => {
        if (onError) onError(error);
      }
    );

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onResult, onError]);

  return (
    <div className="w-full max-w-md mx-auto overflow-hidden rounded-xl bg-black">
      <div id="qr-reader" className="w-full"></div>
    </div>
  );
}
