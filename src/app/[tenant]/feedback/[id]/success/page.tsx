import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantFeedbackFormSuccessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') {
      query.set(key, value);
    }
  }
  query.set('formId', id);
  redirect(`/feedback/confirmation?${query.toString()}`);
}
