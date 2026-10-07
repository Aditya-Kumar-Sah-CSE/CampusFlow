import { redirect } from 'next/navigation';

export default function GoogleRoutePage() {
  redirect('/admin/dashboard?tab=google');
}
