import { NextRequest, NextResponse } from 'next/server';
import { getFabricAdminClient, getFabricApiKeyError } from '@/lib/fabric-api';

// DELETE: Unregister/delete a webhook subscription
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = getFabricApiKeyError(req);
  if (authError) return authError;

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: 'Webhook subscription ID is required.' }, { status: 400 });
    }

    const supabase = getFabricAdminClient();
    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Webhook subscription deleted successfully.' });
  } catch (err: any) {
    console.error('Delete webhook failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to delete webhook subscription.' },
      { status: 500 }
    );
  }
}
