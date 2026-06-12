import { createHmac } from 'crypto';

export interface WebhookSubscription {
  id: string;
  target_url: string;
  secret_token: string | null;
  active: boolean;
  events: string[];
  created_at: string;
}

// Client-side local storage key for sandbox mode
const LOCAL_WEBHOOKS_KEY = 'fabric_local_webhooks';

// Helper to sign payload
export function generateSignature(payload: string, secret: string): string {
  try {
    return createHmac('sha256', secret).update(payload).digest('hex');
  } catch (err) {
    console.error('Failed to generate HMAC signature:', err);
    return '';
  }
}

// Server-side dispatch using admin client
export async function dispatchServerWebhook(event: string, payload: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Webhook dispatch skipped: Supabase credentials missing.');
    return;
  }

  // Create admin client to bypass RLS policies
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // Fetch active webhooks
    const { data: webhooks, error } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('active', true);

    if (error) throw error;
    if (!webhooks || webhooks.length === 0) return;

    const filtered = (webhooks as WebhookSubscription[]).filter(w => 
      w.events.includes(event) || w.events.includes('*')
    );

    if (filtered.length === 0) return;

    await sendWebhookRequests(filtered, event, payload);
  } catch (err) {
    console.error('Error in server webhook dispatch:', err);
  }
}

// Helper to send HTTP requests to webhook URLs
async function sendWebhookRequests(webhooks: WebhookSubscription[], event: string, payload: any) {
  const bodyString = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload
  });

  const requests = webhooks.map(async (webhook) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': event
    };

    if (webhook.secret_token) {
      const signature = generateSignature(bodyString, webhook.secret_token);
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }
    }

    try {
      const response = await fetch(webhook.target_url, {
        method: 'POST',
        headers,
        body: bodyString,
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        console.warn(`Webhook to ${webhook.target_url} returned status ${response.status}`);
      }
    } catch (err) {
      console.error(`Failed to post webhook to ${webhook.target_url}:`, err);
    }
  });

  // Run all in parallel, ignore errors so we don't block
  await Promise.allSettled(requests);
}

// Universal dispatcher that detects environment
export async function dispatchWebhook(event: string, payload: any) {
  if (typeof window !== 'undefined') {
    // Client-side (Sandbox mode local dispatch)
    try {
      const raw = localStorage.getItem(LOCAL_WEBHOOKS_KEY);
      if (!raw) return;

      const webhooks: WebhookSubscription[] = JSON.parse(raw);
      const active = webhooks.filter(w => w.active && (w.events.includes(event) || w.events.includes('*')));
      if (active.length === 0) return;

      const bodyString = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload
      });

      // Browser-side fetch dispatcher
      active.forEach(async (webhook) => {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event
        };

        if (webhook.secret_token) {
          headers['X-Webhook-Signature'] = 'sandbox-mode-signature-placeholder';
        }

        try {
          await fetch(webhook.target_url, {
            method: 'POST',
            headers,
            body: bodyString
          });
        } catch (err) {
          console.error(`Sandbox webhook fail to ${webhook.target_url}:`, err);
        }
      });
    } catch (err) {
      console.error('Error in client webhook dispatch:', err);
    }
  } else {
    // Server-side dispatch
    await dispatchServerWebhook(event, payload);
  }
}
