import { redirect } from 'next/navigation';

export default function BillingRoutePage() {
  redirect('/admin/dashboard?tab=billing');
}
