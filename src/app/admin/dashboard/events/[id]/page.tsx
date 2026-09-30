import { EventEditView } from '@/components/admin/events/EventEditView';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function AdminEventDetailsPage({ params }: Props) {
  const { id } = await params;
  return <EventEditView idOrSlug={id} />;
}
