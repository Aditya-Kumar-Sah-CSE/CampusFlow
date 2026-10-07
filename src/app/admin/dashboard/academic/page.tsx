import { redirect } from 'next/navigation';

export default async function AcademicRoutePage({
  searchParams,
}: {
  searchParams?: Promise<{ subtab?: string }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const sub = resolved.subtab ? `&subtab=${encodeURIComponent(resolved.subtab)}` : '';
  redirect(`/admin/dashboard?tab=academic${sub}`);
}
