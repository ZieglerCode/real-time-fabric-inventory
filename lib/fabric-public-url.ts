export function getAppBaseUrl(origin?: string): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = origin || configuredUrl || runtimeOrigin;

  return baseUrl.replace(/\/$/, '');
}

export function getPublicFabricLookupUrl(qrCodeId: string, origin?: string): string {
  const baseUrl = getAppBaseUrl(origin);
  const encodedId = encodeURIComponent(qrCodeId);

  return baseUrl ? `${baseUrl}/api/public/fabrics/${encodedId}` : `/api/public/fabrics/${encodedId}`;
}

export function getPublicFabricViewerUrl(qrCodeId: string, origin?: string): string {
  const baseUrl = getAppBaseUrl(origin);
  const encodedId = encodeURIComponent(qrCodeId);

  return baseUrl ? `${baseUrl}/public/fabrics/${encodedId}` : `/public/fabrics/${encodedId}`;
}
