import { NextRequest, NextResponse } from 'next/server';
import { getFabricAdminClient, getFabricApiKeyError } from '@/lib/fabric-api';

export async function GET(req: NextRequest) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const supabase = getFabricAdminClient();
    
    // Fetch a sample team to provide integration context
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      authenticated: true,
      message: 'Connection successful. Fabric inventory API is ready.',
      environment: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'production' : 'sandbox',
      info: {
        system: 'Real-Time Fabric Inventory',
        api_version: 'v1'
      },
      team: teams && teams.length > 0 ? teams[0] : null
    });
  } catch (err: any) {
    console.error('Integration test failed:', err);
    // If the DB connection failed or table does not exist yet (e.g. fresh setup),
    // we still return authenticated: true because the API key check passed.
    return NextResponse.json({
      authenticated: true,
      message: 'Authenticated successfully, but database query failed.',
      error: err.message
    });
  }
}
