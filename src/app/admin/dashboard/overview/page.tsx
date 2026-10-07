import { redirect } from 'next/navigation';

export default function AdminDashboardOverviewPage() {
  redirect('/admin/dashboard?tab=overview');
}
