import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchServerWebhook } from '@/lib/webhooks';

// Helper to authenticate using either Dev API key or Supabase User JWT
async function validateRequestAuth(req: NextRequest): Promise<boolean> {
  const configuredKeys = (process.env.FABRIC_API_KEYS || process.env.FABRIC_API_KEY || '')
    .split(',')
    .map(key => key.trim())
    .filter(Boolean);
    
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : req.headers.get('x-api-key') || '';
    
  if (!token) return false;

  // 1. Check developer API key
  if (configuredKeys.includes(token)) {
    return true;
  }

  // 2. Check Supabase User JWT
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        return true;
      }
    } catch {
      // Fall through
    }
  }

  return false;
}

// POST: Trigger server-side webhook dispatching
export async function POST(req: NextRequest) {
  const isAuthenticated = await validateRequestAuth(req);
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Invalid or missing authorization credentials.' }, { status: 401 });
  }

  try {
    const { event, payload } = await req.json();

    if (!event || !payload) {
      return NextResponse.json({ error: 'event and payload are required.' }, { status: 400 });
    }

    // Dispatch webhook asynchronously
    dispatchServerWebhook(event, payload);

    return NextResponse.json({ success: true, message: 'Webhooks dispatched successfully.' });
  } catch (err: any) {
    console.error('Webhook dispatch endpoint failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to dispatch webhooks.' },
      { status: 500 }
    );
  }
}
