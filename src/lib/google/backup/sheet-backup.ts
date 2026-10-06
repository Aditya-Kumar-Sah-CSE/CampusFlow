import { backupAcademicStructure as backupAcademicStructureInternal } from '@/lib/backup/academic-backup';
import { backupFeedbackForms } from '@/lib/backup/feedback-backup';
import { backupEventsData } from '@/lib/backup/events-backup';
import { backupBillingAndSystemData } from '@/lib/backup/billing-system-backup';

export const backupAcademicStructure = backupAcademicStructureInternal;
export const backupFeedbackData = backupFeedbackForms;
export const backupEventData = backupEventsData;
export const backupAuditData = backupBillingAndSystemData;

export {
  backupFeedbackForms,
  backupEventsData,
  backupBillingAndSystemData,
};
