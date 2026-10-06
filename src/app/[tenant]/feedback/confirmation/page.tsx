import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantFeedbackConfirmationPage({ searchParams }: Props) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  redirect(`/feedback/confirmation${qs ? `?${qs}` : ''}`);
}
