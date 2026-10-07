import { redirect } from 'next/navigation';

export default function AttendanceRoutePage() {
  redirect('/admin/dashboard?tab=academic');
}
