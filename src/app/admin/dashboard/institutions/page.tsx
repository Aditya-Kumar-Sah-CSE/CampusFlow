import { redirect } from 'next/navigation';

export default function InstitutionsRoutePage() {
  redirect('/admin/dashboard?tab=institutions');
}
