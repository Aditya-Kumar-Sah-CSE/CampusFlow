import { redirect } from 'next/navigation';

export default function AuditRoutePage() {
  redirect('/admin/dashboard?tab=audit');
}
