import { NextRequest, NextResponse } from 'next/server';
import {
  getFabricAdminClient,
  getFabricApiKeyError,
  hydrateFabricRecords,
  normalizeQrCodeId,
} from '@/lib/fabric-api';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ qrCodeId: string }> }
) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const { qrCodeId } = await context.params;
    const normalizedQrCodeId = normalizeQrCodeId(qrCodeId);

    if (!normalizedQrCodeId) {
      return NextResponse.json({ error: 'QR code id is required.' }, { status: 400 });
    }

    const supabase = getFabricAdminClient();
    const { data, error } = await supabase
      .from('fabrics')
      .select('*')
      .eq('qr_code_id', normalizedQrCodeId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'Fabric not found.' }, { status: 404 });
    }

    const [fabric] = await hydrateFabricRecords([data], req.nextUrl.origin);

    return NextResponse.json({
      data: fabric,
    });
  } catch (err: any) {
    console.error('Protected fabric lookup failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load fabric.' },
      { status: 500 }
    );
  }
}
