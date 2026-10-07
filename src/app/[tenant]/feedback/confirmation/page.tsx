import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantFeedbackConfirmationPage({ params, searchParams }: Props) {
  const { tenant } = await params;
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') {
      query.set(key, value);
    }
  }
  if (!query.has('tenant')) {
    query.set('tenant', tenant);
  }
  const qs = query.toString();
  redirect(`/feedback/confirmation${qs ? `?${qs}` : ''}`);
}
