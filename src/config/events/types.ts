export type SmallEventCategory =
  | 'Cultural'
  | 'Cultural Event'
  | 'Technical'
  | 'Technical Event'
  | 'Coding Competition'
  | 'Workshop'
  | 'Seminar'
  | 'Fresher Event'
  | 'Club Event'
  | 'Hackathon'
  | 'Sports Event'
  | 'Open Mic';

export type SmallEventStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface SmallEvent {
  id: string;
  institutionId: 'bce-bgp' | 'gec-gaya' | string;
  title: string;
  shortDescription: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm or e.g. "14:00"
  endTime?: string; // HH:mm or e.g. "18:00"
  venue: string;
  banner: string; // banner image URL
  organizer: string;
  category: SmallEventCategory;
  registrationEnabled: boolean;
  registrationUrl: string; // Direct Google Form URL
  registrationLabel?: string; // default "Register Now"
  status: SmallEventStatus;
  createdAt: string;
  registrationDeadline?: string; // ISO string or human-readable format
}
