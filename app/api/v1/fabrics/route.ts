import { NextRequest, NextResponse } from 'next/server';
import {
  getFabricAdminClient,
  getFabricApiKeyError,
  hydrateFabricRecords,
} from '@/lib/fabric-api';

const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const supabase = getFabricAdminClient();
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(Number(searchParams.get('limit') || 100), MAX_LIMIT);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const status = searchParams.get('status');
    const sessionId = searchParams.get('session_id');
    const teamId = searchParams.get('team_id');
    const updatedSince = searchParams.get('updated_since') || searchParams.get('created_since');
    const query = searchParams.get('q')?.trim();

    let sessionIdsForTeam: string[] | null = null;
    if (teamId) {
      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id')
        .eq('team_id', teamId);

      if (sessionError) throw sessionError;
      sessionIdsForTeam = (sessions || []).map((session) => session.id);

      if (sessionIdsForTeam.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: { limit, offset, count: 0 },
        });
      }
    }

    let request = supabase
      .from('fabrics')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) request = request.eq('status', status);
    if (sessionId) request = request.eq('session_id', sessionId);
    if (sessionIdsForTeam) request = request.in('session_id', sessionIdsForTeam);
    if (updatedSince) request = request.gte('created_at', updatedSince);
    if (query) {
      const safeQuery = query.replace(/[%_]/g, '');
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeQuery);
      request = request.or(
        [
          `name.ilike.%${safeQuery}%`,
          `qr_code_id.ilike.%${safeQuery}%`,
          ...(isUuid ? [`id.eq.${safeQuery}`] : []),
        ].join(',')
      );
    }

    const { data, error, count } = await request;
    if (error) throw error;

    const records = await hydrateFabricRecords(data || [], req.nextUrl.origin);

    return NextResponse.json({
      data: records,
      pagination: {
        limit,
        offset,
        count: count || 0,
      },
    });
  } catch (err: any) {
    console.error('Fabric import API failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load fabrics.' },
      { status: 500 }
    );
  }
}
