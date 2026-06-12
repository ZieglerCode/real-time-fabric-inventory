import PublicFabricViewer from '@/components/public-fabric-viewer';

interface PublicFabricPageProps {
  params: Promise<{
    qrCodeId: string;
  }>;
}

export default async function PublicFabricPage({ params }: PublicFabricPageProps) {
  const { qrCodeId } = await params;

  return <PublicFabricViewer qrCodeId={qrCodeId} />;
}
