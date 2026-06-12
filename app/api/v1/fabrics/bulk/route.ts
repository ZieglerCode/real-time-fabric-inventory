import { NextRequest, NextResponse } from 'next/server';
import { getFabricAdminClient, getFabricApiKeyError, hydrateFabricRecords } from '@/lib/fabric-api';
import { dispatchServerWebhook } from '@/lib/webhooks';

// POST: Bulk import fabrics (insert)
export async function POST(req: NextRequest) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const items = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Payload must be a non-empty array of fabric records.' }, { status: 400 });
    }

    // Validate fields
    for (const item of items) {
      if (!item.image_url || typeof item.image_url !== 'string') {
        return NextResponse.json({ error: 'Each record must contain a valid image_url string.' }, { status: 400 });
      }
    }

    const supabase = getFabricAdminClient();

    // Prepare inserts
    const inserts = items.map(item => ({
      image_url: item.image_url,
      name: item.name || null,
      status: 'pending',
      session_id: item.session_id || null,
      color: item.color || null,
      pattern: item.pattern || null,
      material: item.material || null
    }));

    const { data, error } = await supabase
      .from('fabrics')
      .insert(inserts)
      .select();

    if (error) throw error;

    const records = await hydrateFabricRecords(data || [], req.nextUrl.origin);

    // Trigger webhook event
    dispatchServerWebhook('fabric.bulk_created', records);

    return NextResponse.json({
      success: true,
      count: records.length,
      data: records
    }, { status: 201 });

  } catch (err: any) {
    console.error('Bulk insert fabrics failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to import fabrics in bulk.' },
      { status: 500 }
    );
  }
}

// PATCH: Bulk update fabrics
export async function PATCH(req: NextRequest) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const updates = await req.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Payload must be a non-empty array of updates.' }, { status: 400 });
    }

    // Validate ids
    for (const update of updates) {
      if (!update.id || typeof update.id !== 'string') {
        return NextResponse.json({ error: 'Each update record must contain a valid id UUID.' }, { status: 400 });
      }
    }

    const supabase = getFabricAdminClient();
    const updatedRecords: any[] = [];

    // Run updates in parallel
    const promises = updates.map(async (update) => {
      const { id, ...fields } = update;
      const cleanFields: Record<string, any> = {};

      if ('name' in fields) cleanFields.name = fields.name;
      if ('status' in fields) cleanFields.status = fields.status;
      if ('color' in fields) cleanFields.color = fields.color;
      if ('pattern' in fields) cleanFields.pattern = fields.pattern;
      if ('material' in fields) cleanFields.material = fields.material;
      if ('qr_code_id' in fields) cleanFields.qr_code_id = fields.qr_code_id;

      if (Object.keys(cleanFields).length === 0) return;

      const { data, error } = await supabase
        .from('fabrics')
        .update(cleanFields)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        updatedRecords.push(data);
      }
    });

    await Promise.all(promises);

    const records = await hydrateFabricRecords(updatedRecords, req.nextUrl.origin);

    // Trigger webhook event
    dispatchServerWebhook('fabric.bulk_updated', records);

    return NextResponse.json({
      success: true,
      count: records.length,
      data: records
    });

  } catch (err: any) {
    console.error('Bulk update fabrics failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to update fabrics in bulk.' },
      { status: 500 }
    );
  }
}
