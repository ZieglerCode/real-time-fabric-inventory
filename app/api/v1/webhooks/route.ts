import { NextRequest, NextResponse } from 'next/server';
import { getFabricAdminClient, getFabricApiKeyError } from '@/lib/fabric-api';

// GET: List all webhook subscriptions
export async function GET(req: NextRequest) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const supabase = getFabricAdminClient();
    const { data, error } = await supabase
      .from('webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('List webhooks failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to list webhook subscriptions.' },
      { status: 500 }
    );
  }
}

// POST: Create a new webhook subscription
export async function POST(req: NextRequest) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const { target_url, secret_token, events } = await req.json();

    if (!target_url || typeof target_url !== 'string') {
      return NextResponse.json({ error: 'target_url is required and must be a valid URL string.' }, { status: 400 });
    }

    try {
      new URL(target_url);
    } catch {
      return NextResponse.json({ error: 'target_url must be a valid absolute URL.' }, { status: 400 });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events must be a non-empty array of event names.' }, { status: 400 });
    }

    const supabase = getFabricAdminClient();
    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        target_url,
        secret_token: secret_token || null,
        events,
        active: true
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    console.error('Create webhook failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to register webhook subscription.' },
      { status: 500 }
    );
  }
}
