import { redirect } from 'next/navigation';

export default function AdminsRoutePage() {
  redirect('/admin/dashboard?tab=admins');
}
