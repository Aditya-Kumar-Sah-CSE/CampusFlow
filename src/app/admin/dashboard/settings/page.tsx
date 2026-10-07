import { redirect } from 'next/navigation';

export default function SettingsRoutePage() {
  redirect('/admin/dashboard?tab=settings');
}
