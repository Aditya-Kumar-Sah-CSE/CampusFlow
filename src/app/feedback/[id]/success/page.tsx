import { redirect } from 'next/navigation';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FeedbackFormSuccessPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const query = new URLSearchParams(sp as Record<string, string>);
  query.set('formId', id);
  redirect(`/feedback/confirmation?${query.toString()}`);
}
