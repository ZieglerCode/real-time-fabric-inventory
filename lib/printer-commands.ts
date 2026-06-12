export type PrinterLanguage = 'TSPL' | 'ZPL';

interface LabelData {
  name: string;
  qrCodeId: string;
  sessionCode: string;
}

export function compileLabel(data: LabelData, language: PrinterLanguage): ArrayBuffer {
  // Safe characters cleaning: escape double quotes for printer strings
  const cleanName = data.name.substring(0, 30).replace(/"/g, '\\"');
  const cleanId = data.qrCodeId.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  const cleanSession = data.sessionCode.toUpperCase();
  
  let commands = '';

  if (language === 'TSPL') {
    // TSPL commands for 50mm x 30mm (2" x 1.2") thermal labels
    commands = [
      'SIZE 50 mm, 30 mm',
      'GAP 2 mm, 0 mm',
      'DIRECTION 1',
      'CLS',
      // Title text: TEXT x, y, font, rotation, x-multi, y-multi, "content"
      `TEXT 20,25,"ROMAN.TTF",0,1,1,"${cleanName}"`,
      // Subtitle Reference ID
      `TEXT 20,60,"ROMAN.TTF",0,1,0.8,"Ref: ${cleanId}"`,
      // 2D QR Code: QRCODE x, y, ECC, cell_width, mode, rotation, "content"
      `QRCODE 20,95,M,4,A,0,"${cleanId}"`,
      // 1D Barcode (Code 128): BARCODE x, y, type, height, readable, rotation, narrow, wide, "content"
      `BARCODE 180,95,"128",48,0,0,2,2,"${cleanId}"`,
      // Footer text line
      `TEXT 20,210,"ROMAN.TTF",0,1,0.8,"ZIEGLER TEXTILE CATALOG"`,
      `TEXT 340,210,"ROMAN.TTF",0,1,0.8,"${cleanSession}"`,
      'PRINT 1,1',
      ''
    ].join('\r\n');
  } else {
    // ZPL commands for 2" x 1.2" (203 DPI = 400px width, 240px height)
    commands = [
      '^XA',
      '^PW400',
      '^LL240',
      // Title text
      `^FO20,20^A0N,24,24^FD${cleanName}^FS`,
      // Subtitle ID
      `^FO20,55^A0N,18,18^FDID: ${cleanId}^FS`,
      // 2D QR Code
      `^FO20,95^BQN,2,4^FDM,${cleanId}^FS`,
      // 1D Barcode Code 128 (width=2, height=48)
      `^FO180,95^BY2^BCN,48,N,N,N^FD${cleanId}^FS`,
      // Label footer details
      `^FO20,205^A0N,16,16^FDZiegler Textile Catalog^FS`,
      `^FO320,205^A0N,16,16^FD${cleanSession}^FS`,
      '^XZ',
      ''
    ].join('\r\n');
  }

  const encoder = new TextEncoder();
  return encoder.encode(commands).buffer;
}
