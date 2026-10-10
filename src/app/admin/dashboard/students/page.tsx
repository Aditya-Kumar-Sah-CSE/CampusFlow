import { redirect } from 'next/navigation';

export default function StudentsRoutePage() {
  redirect('/admin/dashboard?tab=admins&subtab=students');
}
