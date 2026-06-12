import { getPublicFabricViewerUrl } from './fabric-public-url';

export type PrinterLanguage = 'TSPL' | 'ZPL';
export type LabelLayout = 'standard' | 'minimal';
export type LabelCodeKind = '2d' | '1d';

export interface LabelData {
  name: string;
  qrCodeId: string;
  sessionCode: string;
  teamName?: string;
  layout?: LabelLayout;
  codeKind?: LabelCodeKind;
  publicUrl?: string;
}

export function compileLabel(data: LabelData, language: PrinterLanguage): ArrayBuffer {
  // Safe characters cleaning: escape double quotes for printer strings
  const cleanName = data.name.substring(0, 30).replace(/"/g, '\\"');
  const cleanId = data.qrCodeId.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  const cleanPublicUrl = (data.publicUrl || getPublicFabricViewerUrl(cleanId)).replace(/"/g, '\\"');
  const catalogLine = data.teamName
    ? `${data.teamName.substring(0, 20).toUpperCase()} TEXTILE`
    : 'TEXTILE CATALOG';
  const isMinimal = data.layout === 'minimal';
  const codeKind = data.codeKind || '2d';
  
  let commands = '';

  if (language === 'TSPL') {
    // TSPL commands for 50mm x 30mm (2" x 1.2") thermal labels
    commands = isMinimal
      ? [
          'SIZE 50 mm, 30 mm',
          'GAP 2 mm, 0 mm',
          'DIRECTION 1',
          'CLS',
          `TEXT 20,22,"ROMAN.TTF",0,1,1,"${cleanName}"`,
          codeKind === '2d'
            ? `QRCODE 122,58,M,4,A,0,"${cleanPublicUrl}"`
            : `BARCODE 55,78,"128",72,0,0,2,2,"${cleanId}"`,
          'PRINT 1,1',
          ''
        ].join('\r\n')
      : [
          'SIZE 50 mm, 30 mm',
          'GAP 2 mm, 0 mm',
          'DIRECTION 1',
          'CLS',
          // Title text: TEXT x, y, font, rotation, x-multi, y-multi, "content"
          `TEXT 20,25,"ROMAN.TTF",0,1,1,"${cleanName}"`,
          // Reference ID (no "ID:" prefix)
          `TEXT 20,60,"ROMAN.TTF",0,1,0.8,"${cleanId}"`,
          // 2D QR Code: QRCODE x, y, ECC, cell_width, mode, rotation, "content"
          `QRCODE 20,95,M,3,A,0,"${cleanPublicUrl}"`,
          // 1D Barcode (Code 128): BARCODE x, y, type, height, readable, rotation, narrow, wide, "content"
          `BARCODE 180,95,"128",48,0,0,2,2,"${cleanId}"`,
          // Footer: team/catalog name left, no session code on right
          `TEXT 20,210,"ROMAN.TTF",0,1,0.8,"${catalogLine}"`,
          'PRINT 1,1',
          ''
        ].join('\r\n');
  } else {
    // ZPL commands for 2" x 1.2" (203 DPI = 400px width, 240px height)
    commands = isMinimal
      ? [
          '^XA',
          '^PW400',
          '^LL240',
          `^FO20,24^A0N,28,28^FD${cleanName}^FS`,
          codeKind === '2d'
            ? `^FO125,64^BQN,2,4^FDM,${cleanPublicUrl}^FS`
            : `^FO55,82^BY2^BCN,82,N,N,N^FD${cleanId}^FS`,
          '^XZ',
          ''
        ].join('\r\n')
      : [
          '^XA',
          '^PW400',
          '^LL240',
          // Title text
          `^FO20,20^A0N,24,24^FD${cleanName}^FS`,
          // Reference ID (no "ID:" prefix)
          `^FO20,55^A0N,18,18^FD${cleanId}^FS`,
          // 2D QR Code
          `^FO20,95^BQN,2,3^FDM,${cleanPublicUrl}^FS`,
          // 1D Barcode Code 128 (width=2, height=48)
          `^FO180,95^BY2^BCN,48,N,N,N^FD${cleanId}^FS`,
          // Footer: team/catalog name only
          `^FO20,205^A0N,16,16^FD${catalogLine}^FS`,
          '^XZ',
          ''
        ].join('\r\n');
  }

  const encoder = new TextEncoder();
  return encoder.encode(commands).buffer;
}
