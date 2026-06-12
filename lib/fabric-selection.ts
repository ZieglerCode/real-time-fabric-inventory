export interface PublicFabric {
  id: string;
  qr_code_id: string;
  name: string | null;
  status: 'pending' | 'completed' | 'discarded';
  created_at: string;
  rejection_reason: string | null;
  discarded_at: string | null;
  created_by_email: string | null;
  tagged_by_email: string | null;
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

const SELECTION_STORAGE_KEY = 'fabric_public_selection_v1';

export function readFabricSelection(): PublicFabric[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SELECTION_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeFabricSelection(items: PublicFabric[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('fabric-selection-updated'));
}

export function addFabricToSelection(fabric: PublicFabric): PublicFabric[] {
  const current = readFabricSelection();
  const existing = current.find((item) => item.qr_code_id === fabric.qr_code_id);
  const next = existing ? current : [fabric, ...current];

  writeFabricSelection(next);
  return next;
}

export function removeFabricFromSelection(qrCodeId: string): PublicFabric[] {
  const next = readFabricSelection().filter((item) => item.qr_code_id !== qrCodeId);
  writeFabricSelection(next);
  return next;
}

export function clearFabricSelection() {
  writeFabricSelection([]);
}

export function formatSelectionMessage(items: PublicFabric[]): string {
  const lines = items.map((item, index) => {
    const name = item.name || 'Unnamed fabric';
    const team = item.team.name ? ` (${item.team.name})` : '';
    return `${index + 1}. ${name}${team}\n   ${item.qr_code_id}\n   ${item.links.public_viewer_url}`;
  });

  return [
    'Meine Stoffauswahl:',
    '',
    ...lines,
  ].join('\n');
}
