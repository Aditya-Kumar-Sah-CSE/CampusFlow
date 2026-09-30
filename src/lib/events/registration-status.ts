export function checkIsRegistrationOpen(
  event: { status?: string; registration_enabled?: boolean; registration_start?: string | null; registration_end?: string | null },
  program?: { is_active?: boolean; registration_open_at?: string | null; registration_close_at?: string | null } | null,
): { isOpen: boolean; reason?: string } {
  const now = new Date();
  if (event.status !== 'PUBLISHED') return { isOpen: false, reason: 'Event is not accepting registrations.' };
  if (!event.registration_enabled) return { isOpen: false, reason: 'Registration is disabled for this event.' };
  if (event.registration_start && now < new Date(event.registration_start)) return { isOpen: false, reason: 'Registration has not opened yet.' };
  if (event.registration_end && now > new Date(event.registration_end)) return { isOpen: false, reason: `Registration deadline passed on ${new Date(event.registration_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.` };
  if (program) {
    if (program.is_active === false) return { isOpen: false, reason: 'This program is currently inactive.' };
    if (program.registration_open_at && now < new Date(program.registration_open_at)) return { isOpen: false, reason: 'Registration for this program has not opened yet.' };
    if (program.registration_close_at && now > new Date(program.registration_close_at)) return { isOpen: false, reason: `Registration for this program closed on ${new Date(program.registration_close_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.` };
  }
  return { isOpen: true };
}
