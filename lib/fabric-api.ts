import { createClient } from '@supabase/supabase-js';
import { getPublicFabricLookupUrl, getPublicFabricViewerUrl } from './fabric-public-url';

type FabricStatus = 'pending' | 'completed' | 'discarded';

interface FabricRecord {
  id: string;
  image_url: string;
  name: string | null;
  qr_code_id: string | null;
  status: FabricStatus;
  rejection_reason?: string | null;
  discarded_at?: string | null;
  created_at: string;
  created_by_email?: string | null;
  tagged_by_email?: string | null;
  session_id?: string | null;
  color?: string | null;
  pattern?: string | null;
  material?: string | null;
}

interface SessionRecord {
  id: string;
  code: string;
  team_id: string;
}

interface TeamRecord {
  id: string;
  name: string;
}

export interface FabricApiRecord {
  id: string;
  qr_code_id: string;
  name: string | null;
  status: FabricStatus;
  created_at: string;
  rejection_reason: string | null;
  discarded_at: string | null;
  created_by_email: string | null;
  tagged_by_email: string | null;
  color: string | null;
  pattern: string | null;
  material: string | null;
  session: {
    id: string | null;
    code: string | null;
  };
  team: {
    id: string | null;
    name: string | null;
  };
  assets: {
    image_url: string;
  };
  links: {
    public_lookup_url: string;
    public_viewer_url: string;
  };
}

export function getFabricApiKeyError(req: Request): Response | null {
  const configuredKeys = (process.env.FABRIC_API_KEYS || process.env.FABRIC_API_KEY || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);

  if (configuredKeys.length === 0) {
    return Response.json(
      { error: 'Protected Fabric API is not configured. Set FABRIC_API_KEYS.' },
      { status: 503 }
    );
  }

  const authorization = req.headers.get('authorization') || '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  const headerToken = req.headers.get('x-api-key') || '';
  const token = bearerToken || headerToken;

  if (!token || !configuredKeys.includes(token)) {
    return Response.json({ error: 'Invalid or missing API key.' }, { status: 401 });
  }

  return null;
}

export function getFabricAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Fabric API requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function normalizeQrCodeId(value: string): string {
  return decodeURIComponent(value).trim().toUpperCase();
}

export async function hydrateFabricRecords(
  fabrics: FabricRecord[],
  origin?: string
): Promise<FabricApiRecord[]> {
  if (fabrics.length === 0) return [];

  const supabase = getFabricAdminClient();
  const sessionIds = [...new Set(fabrics.map((fabric) => fabric.session_id).filter(Boolean))] as string[];

  let sessions: SessionRecord[] = [];
  let teams: TeamRecord[] = [];

  if (sessionIds.length > 0) {
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('id, code, team_id')
      .in('id', sessionIds);

    if (sessionError) throw sessionError;
    sessions = sessionData || [];

    const teamIds = [...new Set(sessions.map((session) => session.team_id).filter(Boolean))];
    if (teamIds.length > 0) {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      if (teamError) throw teamError;
      teams = teamData || [];
    }
  }

  return fabrics.map((fabric) => {
    const session = sessions.find((item) => item.id === fabric.session_id);
    const team = teams.find((item) => item.id === session?.team_id);
    const qrCodeId = fabric.qr_code_id || `FABRIC-${fabric.id.slice(0, 8).toUpperCase()}`;

    return {
      id: fabric.id,
      qr_code_id: qrCodeId,
      name: fabric.name,
      status: fabric.status,
      created_at: fabric.created_at,
      rejection_reason: fabric.rejection_reason || null,
      discarded_at: fabric.discarded_at || null,
      created_by_email: fabric.created_by_email || null,
      tagged_by_email: fabric.tagged_by_email || null,
      color: fabric.color || null,
      pattern: fabric.pattern || null,
      material: fabric.material || null,
      session: {
        id: fabric.session_id || null,
        code: session?.code || null,
      },
      team: {
        id: session?.team_id || null,
        name: team?.name || null,
      },
      assets: {
        image_url: fabric.image_url,
      },
      links: {
        public_lookup_url: getPublicFabricLookupUrl(qrCodeId, origin),
        public_viewer_url: getPublicFabricViewerUrl(qrCodeId, origin),
      },
    };
  });
}
