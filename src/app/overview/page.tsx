import { redirect } from 'next/navigation';

export default function OverviewPage() {
  redirect('/admin/dashboard?tab=overview');
}
