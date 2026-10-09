/**
 * Automated Google Registration Service for Small/Cultural Events
 * 
 * IMPORTANT ARCHITECTURAL INVARIANT:
 * - Google Sheets is the ONLY source of truth for participant registrations.
 * - ZERO participant registration rows are stored in Supabase.
 * - Automatically creates & links Google Drive folders, Google Forms, and Google Sheets.
 * - Reuses existing Google Workspace OAuth infrastructure (executeWithCollegeGoogleOAuthRetry).
 */

import { executeWithCollegeGoogleOAuthRetry, isCollegeGoogleConfigured } from './auth';
import { getCachedAcademicMasters } from '@/lib/supabase/academic-cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getColumnLetter } from './sheets';
import { linkFormToSpreadsheet } from './linking';
import { getEventRegistrationConfirmationMessage } from './template';
import { APP_URL, appUrl } from '@/lib/config/app';
import type {
  GoogleRegistrationStatus,
  GoogleRegistrationResources,
  GoogleFormParticipantResponse,
  CollegeEvent,
  EventRegistrationType,
} from '@/types/events';
import PDFDocument from 'pdfkit';
import { streamToBuffer, fetchLogoBuffer, PDF_COLORS, formatDateTime } from '@/lib/events/event-pdf-reports';
import { generateRegistrationNumber } from '@/lib/events/program-registrations-service';
import { renderPdfAttributionFooter } from '@/lib/utils/pdf-attribution';

// ============================================================
// CONSTANTS & SCHEMAS
// ============================================================

export const GOOGLE_EVENT_REG_HEADERS = [
  'Timestamp',                  // Col A (0)
  'Participant Name',           // Col B (1)
  'Registration Number',        // Col C (2)
  'Roll Number',                // Col D (3)
  'Year',                       // Col E (4)
  'Branch',                     // Col F (5)
  'Contact Number',             // Col G (6)
  'Email',                      // Col H (7)
  'Performance Type',           // Col I (8)
  'Participation Type',         // Col J (9)
  'Notes / Remarks',            // Col K (10)
  'Consent',                    // Col L (11)
];

export const DEFAULT_PERFORMANCE_TYPES = [
  'Singing',
  'Poetry / Shayari',
  'Stand-up Comedy',
  'Storytelling',
  'Instrumental Performance',
  'Dance',
  'Mimicry / Voice Acting',
  'Technical / Presentation',
  'Other',
];

export const DEFAULT_PARTICIPATION_TYPES = [
  'Solo',
  'Duet',
  'Group',
];

export const DEFAULT_YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  'Final Year',
];

// In-memory response cache to minimize Google API quota consumption on rapid reloads
interface CachedResponses {
  timestamp: number;
  data: GoogleFormParticipantResponse[];
}
const responseCache = new Map<string, CachedResponses>();
const CACHE_TTL_MS = 20 * 1000; // 20 seconds TTL

// ============================================================
// 1. GOOGLE DRIVE FOLDER MANAGEMENT
// ============================================================

/**
 * Searches or creates a folder inside a given parent in Google Drive.
 */
async function getOrCreateFolder(
  drive: any,
  folderName: string,
  parentId?: string
): Promise<{ id: string; url: string }> {
  const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  let query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  try {
    const listRes = await drive.files.list({
      q: query,
      fields: 'files(id, name, webViewLink)',
      pageSize: 1,
    });

    const existing = listRes.data.files?.[0];
    if (existing?.id) {
      return {
        id: existing.id,
        url: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
      };
    }
  } catch (err) {
    console.warn(`[AutoRegDrive] Folder search failed for "${folderName}":`, err);
  }

  // Create folder
  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id, name, webViewLink',
  });

  const newId = createRes.data.id;
  if (!newId) {
    throw new Error(`Failed to create Google Drive folder "${folderName}".`);
  }

  return {
    id: newId,
    url: createRes.data.webViewLink || `https://drive.google.com/drive/folders/${newId}`,
  };
}

/**
 * Ensures standard hierarchical Google Drive folder structure:
 * CampusFlow / <Institution> / Events / Small Events / <Event Name> / Registration (for Small / Google Form events)
 * CampusFlow / <Institution> / Events / Big Events / <Event Name> / Registration (for Big / Flagship events)
 */
export async function ensureEventGoogleDriveFolder(params: {
  collegeId: string;
  collegeName: string;
  eventTitle: string;
  existingFolderId?: string | null;
  registrationType?: EventRegistrationType | 'small' | 'big' | null;
}): Promise<{ folderId: string; folderUrl: string }> {
  const { collegeId, collegeName, eventTitle, existingFolderId, registrationType } = params;

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ drive }) => {
    // 1. Build hierarchical path
    // Root: CampusFlow
    const campusFlowFolder = await getOrCreateFolder(drive, 'CampusFlow');

    // Level 1: <Institution Name>
    const institutionClean = collegeName.trim() || 'Institution';
    const institutionFolder = await getOrCreateFolder(drive, institutionClean, campusFlowFolder.id);

    // Level 2: Events
    const eventsFolder = await getOrCreateFolder(drive, 'Events', institutionFolder.id);

    // Level 3: Ensure BOTH Category folders exist inside Events:
    // - "Small Events" (1-day Google Form events)
    // - "Big Events" (Multi-programs / Flagship events)
    const smallEventsFolder = await getOrCreateFolder(drive, 'Small Events', eventsFolder.id);
    const bigEventsFolder = await getOrCreateFolder(drive, 'Big Events', eventsFolder.id);

    const isBigEvent = registrationType === 'internal' || registrationType === 'big';
    const targetCategoryFolder = isBigEvent ? bigEventsFolder : smallEventsFolder;

    const cleanEventTitle = eventTitle.trim();

    // Check if an event folder with cleanEventTitle was previously placed directly under Events (auto-migrate)
    try {
      const directSearch = await drive.files.list({
        q: `mimeType = 'application/vnd.google-apps.folder' and name = '${cleanEventTitle.replace(/'/g, "\\'")}' and '${eventsFolder.id}' in parents and trashed = false`,
        fields: 'files(id, name, parents)',
        spaces: 'drive',
      });
      const directFiles = directSearch.data.files || [];
      for (const dFile of directFiles) {
        if (dFile.id) {
          await drive.files.update({
            fileId: dFile.id,
            addParents: targetCategoryFolder.id,
            removeParents: eventsFolder.id,
            fields: 'id, parents',
          });
        }
      }
    } catch (migErr) {
      console.warn('[AutoRegDrive] Direct folder migration notice:', migErr);
    }

    // 2. Verify existing folder ID if provided
    if (existingFolderId) {
      try {
        const check = await drive.files.get({
          fileId: existingFolderId,
          fields: 'id, name, trashed, webViewLink, parents',
        });
        if (check.data?.id && !check.data.trashed) {
          // If the registration folder's parent is directly under Events, move it to targetCategoryFolder
          const regParentId = check.data.parents?.[0];
          if (regParentId) {
            try {
              const parentCheck = await drive.files.get({
                fileId: regParentId,
                fields: 'id, name, parents',
              });
              if (parentCheck.data?.parents?.includes(eventsFolder.id)) {
                await drive.files.update({
                  fileId: regParentId,
                  addParents: targetCategoryFolder.id,
                  removeParents: eventsFolder.id,
                  fields: 'id, parents',
                });
              }
            } catch {
              // Ignore parent check error
            }
          }

          return {
            folderId: check.data.id,
            folderUrl: check.data.webViewLink || `https://drive.google.com/drive/folders/${check.data.id}`,
          };
        }
      } catch {
        console.warn(`[AutoRegDrive] Stored folder ID ${existingFolderId} invalid or inaccessible. Re-creating hierarchy.`);
      }
    }

    // Level 4: <Event Name> inside the category folder (Small Events or Big Events)
    const eventFolder = await getOrCreateFolder(drive, cleanEventTitle, targetCategoryFolder.id);

    // Level 5: Registration
    const registrationFolder = await getOrCreateFolder(drive, 'Registration', eventFolder.id);

    return {
      folderId: registrationFolder.id,
      folderUrl: registrationFolder.url,
    };
  });
}

// ============================================================
// 2. GOOGLE FORM CREATION & QUESTION SCHEMA
// ============================================================

export function buildEventRegistrationQuestions(params: {
  branches: string[];
  performanceTypes?: string[];
  participationTypes?: string[];
  eventRef?: string;
  paymentRequired?: boolean;
  paymentAmount?: number | null;
  paymentUpiId?: string | null;
  paymentQrUrl?: string | null;
  paymentInstructions?: string | null;
}) {
  const requests: any[] = [];
  let index = 0;

  // 1. Participant Name (Short answer, required)
  requests.push({
    createItem: {
      item: {
        title: 'Participant Name',
        description: 'Enter your full legal name as per college enrollment records.',
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: false },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 2. Registration Number (Short answer, optional)
  requests.push({
    createItem: {
      item: {
        title: 'Registration Number',
        description: 'University / College Registration Number (if issued). Leave blank if not yet assigned.',
        questionItem: {
          question: {
            required: false,
            textQuestion: { paragraph: false },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 3. Roll Number (Short answer, required)
  requests.push({
    createItem: {
      item: {
        title: 'Roll Number',
        description: 'Your class or examination roll number.',
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: false },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 4. Year (Multiple choice, required)
  requests.push({
    createItem: {
      item: {
        title: 'Academic Year',
        description: 'Select your current year of study.',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'RADIO',
              options: DEFAULT_YEAR_OPTIONS.map((val) => ({ value: val })),
              shuffle: false,
            },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 5. Branch (Choice list populated dynamically from active branches, required)
  const branchOptions = params.branches.length > 0
    ? params.branches
    : [
        'Computer Science & Engineering',
        'Civil Engineering',
        'Mechanical Engineering',
        'Electrical Engineering',
        'Electronics & Communication Engineering',
      ];

  requests.push({
    createItem: {
      item: {
        title: 'Branch / Department',
        description: 'Select your academic branch.',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: branchOptions.length > 5 ? 'DROP_DOWN' : 'RADIO',
              options: branchOptions.map((b) => ({ value: b })),
              shuffle: false,
            },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 6. Contact Number (Short answer, required)
  requests.push({
    createItem: {
      item: {
        title: 'Contact Number',
        description: 'Active 10-digit WhatsApp / mobile number for event coordination.',
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: false },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 7. Email (Email short answer, required)
  requests.push({
    createItem: {
      item: {
        title: 'Email Address',
        description: 'Your primary email address for registration confirmation and event updates.',
        questionItem: {
          question: {
            required: true,
            textQuestion: { paragraph: false },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 8. Performance Category (Configured by admin in EventForm)
  const catOptions = params.performanceTypes && params.performanceTypes.length > 0
    ? params.performanceTypes
    : DEFAULT_PERFORMANCE_TYPES;

  requests.push({
    createItem: {
      item: {
        title: 'In which type of performance will you present ?',
        description: 'Choose the category of performance or activity you are registering for.',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'RADIO',
              options: [
                ...catOptions.map((p) => ({ value: p })),
                { isOther: true },
              ],
              shuffle: false,
            },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 9. Participation Mode (Hardcoded: Solo, Duet, Group performance)
  requests.push({
    createItem: {
      item: {
        title: 'what type of performance would you like to participate in?',
        description: 'Indicate whether you are participating individually or in a team.',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'RADIO',
              options: [
                { value: 'Solo' },
                { value: 'Duet' },
                { value: 'Group performance' },
              ],
              shuffle: false,
            },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 10. Topic / Title / Details / Special Requirements (Paragraph, optional)
  requests.push({
    createItem: {
      item: {
        title: 'Project Title / Topic / Special Requirements',
        description: 'Project name, song/poem title, team members (if group), or special technical/stage requirements (leave blank if none).',
        questionItem: {
          question: {
            required: false,
            textQuestion: { paragraph: true },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 11. Consent / Declaration (Checkbox, required)
  requests.push({
    createItem: {
      item: {
        title: 'Declaration & Code of Conduct',
        description: 'Please review and accept the event participation guidelines.',
        questionItem: {
          question: {
            required: true,
            choiceQuestion: {
              type: 'CHECKBOX',
              options: [
                {
                  value:
                    'I confirm that the information provided is accurate and agree to adhere to all event rules, schedules, and college conduct guidelines.',
                },
              ],
              shuffle: false,
            },
          },
        },
      },
      location: { index: index++ },
    },
  });

  // 12. Payment Items (If payment required)
  if (params.paymentRequired) {
    if (params.paymentQrUrl) {
      requests.push({
        createItem: {
          item: {
            title: `Scan QR Code to Pay (${params.paymentAmount ? `₹${params.paymentAmount}` : 'Payment Required'}${params.paymentUpiId ? ` - UPI ID: ${params.paymentUpiId}` : ''})`,
            description: params.paymentInstructions || 'Scan this official UPI QR Code using Google Pay, PhonePe, Paytm, or BHIM UPI app. After payment, enter your 12-digit UTR / Transaction Reference Number below.',
            imageItem: {
              image: {
                sourceUri: params.paymentQrUrl,
                altText: 'Official UPI Payment QR Code',
              },
            },
          },
          location: { index: index++ },
        },
      });
    }

    requests.push({
      createItem: {
        item: {
          title: `UPI / UTR Transaction Reference ID (Payment Required${params.paymentAmount ? `: ₹${params.paymentAmount}` : ''})`,
          description: `Payment Fee: ${params.paymentAmount ? `₹${params.paymentAmount}` : 'As specified'}\nUPI ID: ${params.paymentUpiId || 'Provided above'}\nPay using the UPI ID or QR Code, then enter the 12-digit UPI / UTR Transaction Reference Number from your payment receipt (Google Pay / PhonePe / Paytm / BHIM).`,
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: index++ },
      },
    });

    requests.push({
      createItem: {
        item: {
          title: 'Payment Screenshot / Proof Link (Optional)',
          description: 'Optional: If you want to attach payment proof, paste your Google Drive or image link here.',
          questionItem: {
            question: {
              required: false,
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index: index++ },
      },
    });
  }

  return requests;
}

export function generateEventFormDescription(params: {
  eventTitle: string;
  collegeName: string;
  startAt?: string;
  endAt?: string;
  venue?: string;
  description?: string;
  registrationDeadline?: string;
  eventSlug?: string;
  tenantSlug?: string;
}): string {
  const parts: string[] = [];

  parts.push(`Official Registration Form for ${params.eventTitle}`);
  parts.push(params.collegeName);

  const scheduleInfo: string[] = [];
  if (params.startAt) {
    scheduleInfo.push(`Date: ${formatDateTime(params.startAt)}`);
  }
  if (params.venue) {
    scheduleInfo.push(`Venue: ${params.venue}`);
  }
  if (scheduleInfo.length) {
    parts.push(scheduleInfo.join(' | '));
  }

  if (params.description?.trim()) {
    parts.push(params.description.trim());
  }

  if (params.registrationDeadline) {
    parts.push(`Registration Deadline: ${formatDateTime(params.registrationDeadline)}`);
  }

  const portalUrl = params.tenantSlug ? appUrl(params.tenantSlug) : APP_URL;
  parts.push(`Managed via CampusFlow Platform (${portalUrl})`);
  parts.push('Note: After submitting, your registration pass can be verified and downloaded directly from CampusFlow.');

  return parts.join('\n\n');
}

/**
 * Creates or updates the Google Form for the event with idempotent preservation.
 */
export async function createOrUpdateEventGoogleForm(params: {
  collegeId: string;
  collegeName: string;
  eventTitle: string;
  eventDescription?: string;
  startAt?: string;
  endAt?: string;
  venue?: string;
  registrationDeadline?: string;
  eventSlug?: string;
  tenantSlug?: string;
  branches: string[];
  performanceCategories?: string[];
  participationModes?: string[];
  paymentRequired?: boolean;
  paymentAmount?: number | null;
  paymentUpiId?: string | null;
  paymentQrUrl?: string | null;
  paymentInstructions?: string | null;
  existingFormId?: string | null;
  targetFolderId?: string | null;
}): Promise<{ formId: string; formUrl: string; editUri: string }> {
  const {
    collegeId,
    collegeName,
    eventTitle,
    eventDescription,
    startAt,
    endAt,
    venue,
    registrationDeadline,
    eventSlug,
    tenantSlug,
    branches,
    performanceCategories,
    participationModes,
    paymentRequired,
    paymentAmount,
    paymentUpiId,
    paymentQrUrl,
    paymentInstructions,
    existingFormId,
    targetFolderId,
  } = params;

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ forms, drive }) => {
    const formTitle = `${eventTitle.trim()} - Registration`;
    const formDesc = generateEventFormDescription({
      eventTitle,
      collegeName,
      startAt,
      endAt,
      venue,
      description: eventDescription,
      registrationDeadline,
      eventSlug,
      tenantSlug,
    });

    // 1. If existingFormId provided, verify and update title/description (preserve questions & responses)
    if (existingFormId) {
      try {
        const getRes = await forms.forms.get({ formId: existingFormId });
        if (getRes.data?.formId) {
          const formId = getRes.data.formId;
          const responderUri = getRes.data.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
          const existingItems = getRes.data.items || [];

          const updateRequests: any[] = [
            {
              updateFormInfo: {
                info: {
                  title: formTitle,
                  description: formDesc,
                },
                updateMask: 'title,description',
              },
            },
          ];

          // If existing form has questions, update Category & Mode questions to match new settings
          if (existingItems.length > 0) {
            const catItemIndex = existingItems.findIndex((it: any) =>
              it.title && (
                it.title.toLowerCase().includes('category') ||
                it.title.toLowerCase().includes('performance') ||
                it.title.toLowerCase().includes('present')
              )
            );
            if (catItemIndex !== -1) {
              const catItem = existingItems[catItemIndex];
              const opts = (performanceCategories && performanceCategories.length > 0)
                ? performanceCategories
                : DEFAULT_PERFORMANCE_TYPES;

              updateRequests.push({
                updateItem: {
                  item: {
                    itemId: catItem.itemId,
                    title: 'In which type of performance will you present ?',
                    description: 'Choose the category of performance or activity you are registering for.',
                    questionItem: {
                      question: {
                        required: true,
                        choiceQuestion: {
                          type: 'RADIO',
                          options: [
                            ...opts.map((p) => ({ value: p })),
                            { isOther: true },
                          ],
                          shuffle: false,
                        },
                      },
                    },
                  },
                  location: { index: catItemIndex },
                  updateMask: 'questionItem,title,description',
                },
              });
            }

            const modeItemIndex = existingItems.findIndex((it: any) =>
              it.title && (
                it.title.toLowerCase().includes('mode') ||
                it.title.toLowerCase().includes('participate') ||
                it.title.toLowerCase().includes('what type')
              )
            );
            if (modeItemIndex !== -1) {
              const modeItem = existingItems[modeItemIndex];
              updateRequests.push({
                updateItem: {
                  item: {
                    itemId: modeItem.itemId,
                    title: 'what type of performance would you like to participate in?',
                    description: 'Indicate whether you are participating individually or in a team.',
                    questionItem: {
                      question: {
                        required: true,
                        choiceQuestion: {
                          type: 'RADIO',
                          options: [
                            { value: 'Solo' },
                            { value: 'Duet' },
                            { value: 'Group performance' },
                          ],
                          shuffle: false,
                        },
                      },
                    },
                  },
                  location: { index: modeItemIndex },
                  updateMask: 'questionItem,title,description',
                },
              });
            }

            if (paymentRequired) {
              const hasPaymentItem = existingItems.some((it: any) =>
                it.title && (
                  it.title.toLowerCase().includes('upi') ||
                  it.title.toLowerCase().includes('utr') ||
                  it.title.toLowerCase().includes('transaction')
                )
              );
              if (!hasPaymentItem) {
                let insertIdx = existingItems.length;
                if (paymentQrUrl) {
                  updateRequests.push({
                    createItem: {
                      item: {
                        title: `Scan QR Code to Pay (${paymentAmount ? `₹${paymentAmount}` : 'Payment Required'}${paymentUpiId ? ` - UPI ID: ${paymentUpiId}` : ''})`,
                        description: paymentInstructions || 'Scan this official UPI QR Code using Google Pay, PhonePe, Paytm, or BHIM UPI app. After payment, enter your 12-digit UTR / Transaction Reference Number below.',
                        imageItem: {
                          image: {
                            sourceUri: paymentQrUrl,
                            altText: 'Official UPI Payment QR Code',
                          },
                        },
                      },
                      location: { index: insertIdx++ },
                    },
                  });
                }
                updateRequests.push({
                  createItem: {
                    item: {
                      title: `UPI / UTR Transaction Reference ID (Payment Required${paymentAmount ? `: ₹${paymentAmount}` : ''})`,
                      description: `Payment Fee: ${paymentAmount ? `₹${paymentAmount}` : 'As specified'}\nUPI ID: ${paymentUpiId || 'Provided above'}\nPay using the UPI ID or QR Code, then enter the 12-digit UPI / UTR Transaction Reference Number from your payment receipt (Google Pay / PhonePe / Paytm / BHIM).`,
                      questionItem: {
                        question: {
                          required: true,
                          textQuestion: { paragraph: false },
                        },
                      },
                    },
                    location: { index: insertIdx++ },
                  },
                });
                updateRequests.push({
                  createItem: {
                    item: {
                      title: 'Payment Screenshot / Proof Link (Optional)',
                      description: 'Optional: If you want to attach payment proof, paste your Google Drive or image link here.',
                      questionItem: {
                        question: {
                          required: false,
                          textQuestion: { paragraph: false },
                        },
                      },
                    },
                    location: { index: insertIdx++ },
                  },
                });
              }
            }
          }

          try {
            await forms.forms.batchUpdate({
              formId,
              requestBody: {
                requests: updateRequests,
              },
            });
          } catch (updateBatchErr) {
            console.warn('[AutoRegForm] Non-fatal: batchUpdate on existing form failed, falling back to info-only update:', updateBatchErr);
            await forms.forms.batchUpdate({
              formId,
              requestBody: {
                requests: [
                  {
                    updateFormInfo: {
                      info: {
                        title: formTitle,
                        description: formDesc,
                      },
                      updateMask: 'title,description',
                    },
                  },
                ],
              },
            });
          }

          return {
            formId,
            formUrl: responderUri,
            editUri: `https://docs.google.com/forms/d/${formId}/edit`,
          };
        }
      } catch (checkErr) {
        console.warn(`[AutoRegForm] Form ${existingFormId} verify failed; creating new form:`, checkErr);
      }
    }

    // 2. Create brand new Google Form
    const createRes = await forms.forms.create({
      requestBody: {
        info: {
          title: formTitle,
          documentTitle: formTitle,
        },
      },
    });

    const formId = createRes.data.formId;
    const responderUri = createRes.data.responderUri;

    if (!formId || !responderUri) {
      throw new Error('Google Forms API did not return valid formId or responderUri.');
    }

    // 3. Populate Description & Generated Questions via batchUpdate
    const questionRequests = buildEventRegistrationQuestions({
      branches,
      performanceTypes: performanceCategories,
      participationTypes: participationModes,
      eventRef: eventSlug || eventTitle,
      paymentRequired,
      paymentAmount,
      paymentUpiId,
      paymentQrUrl,
      paymentInstructions,
    });

    await forms.forms.batchUpdate({
      formId,
      requestBody: {
        requests: [
          {
            updateFormInfo: {
              info: {
                description: formDesc,
              },
              updateMask: 'description',
            },
          },
          ...questionRequests,
        ],
      },
    });

    // 4. Move Form to designated Google Drive folder if provided
    if (targetFolderId) {
      try {
        const fileInfo = await drive.files.get({ fileId: formId, fields: 'parents' });
        const prevParents = (fileInfo.data.parents || []).join(',');
        await drive.files.update({
          fileId: formId,
          addParents: targetFolderId,
          removeParents: prevParents || undefined,
          fields: 'id, parents',
        });
      } catch (moveErr) {
        console.warn('[AutoRegForm] Warning moving form to Drive folder:', moveErr);
      }
    }

    return {
      formId,
      formUrl: responderUri,
      editUri: `https://docs.google.com/forms/d/${formId}/edit`,
    };
  });
}

// ============================================================
// 3. GOOGLE SPREADSHEET CREATION & STYLING
// ============================================================

/**
 * Creates or verifies the response Google Sheet in the event's Google Drive folder.
 */
export async function createOrUpdateEventResponseSpreadsheet(params: {
  collegeId: string;
  eventTitle: string;
  existingSpreadsheetId?: string | null;
  targetFolderId?: string | null;
  formId?: string | null;
  confirmationMessage?: string;
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const { collegeId, eventTitle, existingSpreadsheetId, targetFolderId, formId, confirmationMessage } = params;

  return executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets, drive }) => {
    const sheetTitle = `${eventTitle.trim()} - Responses`;

    // 1. Verify existing spreadsheet if provided
    if (existingSpreadsheetId) {
      try {
        const check = await sheets.spreadsheets.get({
          spreadsheetId: existingSpreadsheetId,
          fields: 'spreadsheetId,properties/title',
        });
        if (check.data?.spreadsheetId) {
          const sId = check.data.spreadsheetId;
          return {
            spreadsheetId: sId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${sId}/edit`,
          };
        }
      } catch {
        console.warn(`[AutoRegSheet] Stored sheet ID ${existingSpreadsheetId} inaccessible; creating new sheet.`);
      }
    }

    // 2. Create brand new spreadsheet
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title: sheetTitle },
        sheets: [
          {
            properties: {
              title: 'Form Responses 1',
              index: 0,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Google Sheets API did not return a valid spreadsheetId.');
    }

    const firstSheetId = createRes.data.sheets?.[0]?.properties?.sheetId ?? 0;
    const lastCol = getColumnLetter(GOOGLE_EVENT_REG_HEADERS.length);

    // 3. Write Headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'Form Responses 1'!A1:${lastCol}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [GOOGLE_EVENT_REG_HEADERS] },
    });

    // 4. Style Headers (Official Navy Blue #0B192C with White Bold text)
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: firstSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: GOOGLE_EVENT_REG_HEADERS.length,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 11 / 255, green: 25 / 255, blue: 44 / 255 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE',
                    wrapStrategy: 'WRAP',
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: firstSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: GOOGLE_EVENT_REG_HEADERS.length,
                },
              },
            },
          ],
        },
      });
    } catch (styleErr) {
      console.warn('[AutoRegSheet] Header styling warning:', styleErr);
    }

    // 5. Move spreadsheet to target Google Drive folder
    if (targetFolderId) {
      try {
        const fileInfo = await drive.files.get({ fileId: spreadsheetId, fields: 'parents' });
        const prevParents = (fileInfo.data.parents || []).join(',');
        await drive.files.update({
          fileId: spreadsheetId,
          addParents: targetFolderId,
          removeParents: prevParents || undefined,
          fields: 'id, parents',
        });
      } catch (moveErr) {
        console.warn('[AutoRegSheet] Warning moving sheet to Drive folder:', moveErr);
      }
    }

    // 6. Attempt Google Apps Script linking if available
    if (formId) {
      try {
        await linkFormToSpreadsheet(formId, spreadsheetId, confirmationMessage, collegeId);
      } catch (linkErr) {
        console.warn('[AutoRegSheet] Form to sheet linking notice:', linkErr);
      }
    }

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
  });
}

// ============================================================
// 4. DATABASE METADATA PERSISTENCE (DEFENSIVE & FORWARD-COMPATIBLE)
// ============================================================

/**
 * Persists Google resource metadata in Supabase without throwing if newly migrated
 * columns have not yet been applied by database administrator.
 */
export async function persistEventGoogleResources(params: {
  eventId: string;
  collegeId: string;
  resources: GoogleRegistrationResources;
}): Promise<void> {
  const { eventId, collegeId, resources } = params;
  const db = createAdminClient();
  if (!db) return;

  const nowIso = new Date().toISOString();

  // Attempt 1: Full payload targeting new migration columns
  const fullUpdate: Record<string, any> = {
    registration_type: 'google_form',
    google_form_id: resources.googleFormId,
    google_form_url: resources.googleFormUrl,
    google_spreadsheet_id: resources.googleSpreadsheetId,
    google_spreadsheet_url: resources.googleSpreadsheetUrl,
    google_drive_folder_id: resources.googleDriveFolderId,
    google_drive_folder_url: resources.googleDriveFolderUrl,
    google_registration_status: resources.status,
    google_registration_error: resources.error || null,
    google_resources_updated_at: nowIso,
    registration_sheet_id: resources.googleSpreadsheetId, // existing column
  };

  const { error: fullError } = await db
    .from('events')
    .update(fullUpdate)
    .eq('id', eventId)
    .eq('college_id', collegeId);

  if (!fullError) {
    return;
  }

  // Attempt 2: If column does not exist, save registration_sheet_id and embed JSON metadata tag in description
  console.warn('[AutoRegPersist] Column update fallback (migration pending):', fullError.message);

  try {
    const { data: currentEvent } = await db
      .from('events')
      .select('description')
      .eq('id', eventId)
      .eq('college_id', collegeId)
      .maybeSingle();

    const rawDesc = currentEvent?.description || '';
    // Strip old meta tag if present
    const cleanDesc = rawDesc.replace(/<!--CAMPUSFLOW_GOOGLE_META:[\s\S]*?-->/g, '').trim();

    const metaTag = `\n\n<!--CAMPUSFLOW_GOOGLE_META:${JSON.stringify({
      google_form_id: resources.googleFormId,
      google_form_url: resources.googleFormUrl,
      google_spreadsheet_id: resources.googleSpreadsheetId,
      google_spreadsheet_url: resources.googleSpreadsheetUrl,
      google_drive_folder_id: resources.googleDriveFolderId,
      google_drive_folder_url: resources.googleDriveFolderUrl,
      google_registration_status: resources.status,
      google_registration_error: resources.error || null,
      registration_type: 'google_form',
    })}-->`;

    const { error: sheetErr } = await db
      .from('events')
      .update({
        registration_sheet_id: resources.googleSpreadsheetId,
        description: cleanDesc + metaTag,
      })
      .eq('id', eventId)
      .eq('college_id', collegeId);

    if (sheetErr) {
      await db
        .from('events')
        .update({
          description: cleanDesc + metaTag,
        })
        .eq('id', eventId)
        .eq('college_id', collegeId);
    }
  } catch (fallbackErr) {
    console.warn('[AutoRegPersist] Metadata tag fallback failed:', fallbackErr);
  }
}

/**
 * Extracts and enriches CollegeEvent with Google resource metadata from either
 * table columns or embedded metadata comment.
 */
export function enrichEventWithGoogleMetadata(event: any): CollegeEvent {
  if (!event) return event;

  let formId = event.google_form_id;
  let formUrl = event.google_form_url;
  let sheetId = event.google_spreadsheet_id || event.registration_sheet_id;
  let sheetUrl = event.google_spreadsheet_url;
  let folderId = event.google_drive_folder_id;
  let folderUrl = event.google_drive_folder_url;
  let status: GoogleRegistrationStatus = event.google_registration_status || (formUrl ? 'READY' : 'NOT_CONFIGURED');
  let regType = event.registration_type;
  let perfCategories = event.performance_categories || null;
  let partModes = event.participation_modes || null;

  // Extract from description if columns were not present
  if (event.description && typeof event.description === 'string' && event.description.includes('<!--CAMPUSFLOW_GOOGLE_META:')) {
    try {
      const match = event.description.match(/<!--CAMPUSFLOW_GOOGLE_META:([\s\S]*?)-->/);
      if (match?.[1]) {
        const parsed = JSON.parse(match[1]);
        formId = formId || parsed.google_form_id;
        formUrl = formUrl || parsed.google_form_url;
        sheetId = sheetId || parsed.google_spreadsheet_id;
        sheetUrl = sheetUrl || parsed.google_spreadsheet_url;
        folderId = folderId || parsed.google_drive_folder_id;
        folderUrl = folderUrl || parsed.google_drive_folder_url;
        status = status === 'NOT_CONFIGURED' ? parsed.google_registration_status || 'READY' : status;
        regType = regType || parsed.registration_type;
        perfCategories = perfCategories || parsed.performance_categories || null;
        partModes = partModes || parsed.participation_modes || null;
      }
    } catch {
      // ignore parse error
    }
  }

  // Clean description for public / display consumption
  const cleanDescription = event.description
    ? event.description.replace(/<!--CAMPUSFLOW_GOOGLE_META:[\s\S]*?-->/g, '').trim()
    : null;

  return {
    ...event,
    description: cleanDescription,
    registration_type: regType || (formUrl ? 'google_form' : 'internal'),
    google_form_id: formId || null,
    google_form_url: formUrl || null,
    google_spreadsheet_id: sheetId || null,
    google_spreadsheet_url: sheetUrl || (sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : null),
    google_drive_folder_id: folderId || null,
    google_drive_folder_url: folderUrl || (folderId ? `https://drive.google.com/drive/folders/${folderId}` : null),
    google_registration_status: status,
    registration_sheet_id: sheetId || null,
    performance_categories: perfCategories,
    participation_modes: partModes,
  };
}

// ============================================================
// 5. AUTOMATED SETUP ORCHESTRATOR
// ============================================================

/**
 * Automatically creates and links complete Google registration resources for a Small/Cultural Event:
 * 1. Checks institutional Google OAuth connection.
 * 2. Creates/reuses dedicated Google Drive folder (CampusFlow/<Institution>/Events/<Event>/Registration).
 * 3. Creates/reuses Google Form with dynamic 11 questions.
 * 4. Creates/reuses response Google Sheet with formatted headers.
 * 5. Saves resource IDs into database.
 * 
 * IDEMPOTENT: Reuses valid existing resources.
 */
export async function setupAutomatedEventRegistration(params: {
  collegeId: string;
  eventId: string;
  eventTitle: string;
  eventDescription?: string;
  startAt?: string;
  endAt?: string;
  venue?: string;
  registrationDeadline?: string;
  eventSlug?: string;
  performanceCategories?: string[];
  participationModes?: string[];
  paymentRequired?: boolean;
  paymentAmount?: number | null;
  paymentUpiId?: string | null;
  paymentQrUrl?: string | null;
  paymentInstructions?: string | null;
  forceRecreate?: boolean;
}): Promise<{
  success: boolean;
  resources: GoogleRegistrationResources;
  message: string;
  error?: string;
}> {
  const {
    collegeId,
    eventId,
    eventTitle,
    eventDescription,
    startAt,
    endAt,
    venue,
    registrationDeadline,
    eventSlug,
    performanceCategories,
    participationModes,
    paymentRequired,
    paymentAmount,
    paymentUpiId,
    paymentQrUrl,
    paymentInstructions,
    forceRecreate = false,
  } = params;

  // 1. Strict Fail-Closed Check for Google OAuth
  const isConnected = await isCollegeGoogleConfigured(collegeId);
  if (!isConnected) {
    const errorMsg = 'Google Drive access is required to automatically create event registration resources. Please connect your institutional Google Workspace account in Admin Settings.';
    await persistEventGoogleResources({
      eventId,
      collegeId,
      resources: {
        status: 'ERROR',
        error: errorMsg,
      },
    });
    return {
      success: false,
      resources: { status: 'ERROR', error: errorMsg },
      message: errorMsg,
      error: 'GOOGLE_AUTH_REQUIRED',
    };
  }

  const db = createAdminClient();
  if (!db) {
    throw new Error('Supabase client unavailable.');
  }

  // 2. Fetch College Metadata & Academic Branches
  const collegeRes = await db.from('colleges').select('name, slug, code').eq('id', collegeId).single();
  let branches: string[] = [];

  try {
    const academic = await getCachedAcademicMasters(collegeId);
    branches = (academic.branches || []).map((b) => b.name || b.code).filter(Boolean);
  } catch {
    const { data: bData } = await db
      .from('branches')
      .select('name, code')
      .eq('college_id', collegeId)
      .eq('is_active', true)
      .order('name', { ascending: true });
    branches = (bData || []).map((b: any) => b.name || b.code).filter(Boolean);
  }

  const collegeName = collegeRes.data?.name || 'Institution';
  const tenantSlug = collegeRes.data?.slug || undefined;

  // 3. Check existing resources on event
  const { data: existingEventRaw } = await db
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  const existingEvent = enrichEventWithGoogleMetadata(existingEventRaw);

  const existingFolderId = forceRecreate ? null : existingEvent?.google_drive_folder_id;
  const existingFormId = forceRecreate ? null : existingEvent?.google_form_id;
  const existingSpreadsheetId = forceRecreate ? null : (existingEvent?.google_spreadsheet_id || existingEvent?.registration_sheet_id);

  try {
    // 4. Ensure Dedicated Google Drive Folder (CampusFlow / <Institution> / Events / Small Events / <Event> / Registration)
    const driveFolder = await ensureEventGoogleDriveFolder({
      collegeId,
      collegeName,
      eventTitle,
      existingFolderId,
      registrationType: 'google_form',
    });

    // 5. Create or Update Google Form
    const googleForm = await createOrUpdateEventGoogleForm({
      collegeId,
      collegeName,
      eventTitle,
      eventDescription,
      startAt,
      endAt,
      venue,
      registrationDeadline,
      eventSlug,
      tenantSlug,
      branches,
      performanceCategories,
      participationModes,
      paymentRequired,
      paymentAmount,
      paymentUpiId,
      paymentQrUrl,
      paymentInstructions,
      existingFormId,
      targetFolderId: driveFolder.folderId,
    });

    // 6. Create or Update Response Spreadsheet
    const confirmationMessage = getEventRegistrationConfirmationMessage(
      eventTitle,
      eventSlug,
      tenantSlug
    );
    const responseSheet = await createOrUpdateEventResponseSpreadsheet({
      collegeId,
      eventTitle,
      existingSpreadsheetId,
      targetFolderId: driveFolder.folderId,
      formId: googleForm.formId,
      confirmationMessage,
    });

    const resources: GoogleRegistrationResources = {
      googleFormId: googleForm.formId,
      googleFormUrl: googleForm.formUrl,
      googleSpreadsheetId: responseSheet.spreadsheetId,
      googleSpreadsheetUrl: responseSheet.spreadsheetUrl,
      googleDriveFolderId: driveFolder.folderId,
      googleDriveFolderUrl: driveFolder.folderUrl,
      status: 'READY',
      error: null,
    };

    // 7. Persist in database
    await persistEventGoogleResources({
      eventId,
      collegeId,
      resources,
    });

    // Invalidate response cache for this event
    responseCache.delete(eventId);

    return {
      success: true,
      resources,
      message: 'Google registration form created and connected successfully.',
    };
  } catch (err: any) {
    console.error('[AutoRegSetup] Setup error:', err);
    const errorMsg = err.message || 'Failed to setup Google registration resources.';
    await persistEventGoogleResources({
      eventId,
      collegeId,
      resources: {
        status: 'ERROR',
        error: errorMsg,
      },
    });

    return {
      success: false,
      resources: { status: 'ERROR', error: errorMsg },
      message: errorMsg,
      error: err.code || 'GOOGLE_API_FAILURE',
    };
  }
}

// ============================================================
// 6. LIVE RESPONSE SYNC LAYER (ZERO SUPABASE PARTICIPANT ROWS)
// ============================================================

/**
 * Helper to generate a unique deduplication signature for an event registration response.
 * Uses persistent student identifiers (Registration Number, Roll Number, Email, Phone, Name)
 * across Google Forms API responses and Google Sheet rows.
 * Excludes variable timestamps to prevent duplicate rows caused by timezone, millisecond, or date format differences.
 */
function makeRegistrationSignature(params: {
  roll?: string;
  name?: string;
  regNo?: string;
  email?: string;
  contact?: string;
  perfType?: string;
}): string {
  const cleanRoll = (params.roll || '').trim().toLowerCase();
  const cleanRegNo = (params.regNo || '').trim().toLowerCase();
  const cleanEmail = (params.email || '').trim().toLowerCase();
  const cleanContact = (params.contact || '').trim().replace(/\D/g, '');
  const cleanName = (params.name || '').trim().toLowerCase();
  const cleanPerf = (params.perfType || '').trim().toLowerCase();

  // 1. Highest priority: College Registration Number (Unique student ID)
  if (cleanRegNo && cleanRegNo !== '—' && cleanRegNo !== '-' && cleanRegNo !== 'none' && cleanRegNo !== 'null') {
    return `reg:${cleanRegNo}|cat:${cleanPerf}`;
  }

  // 2. Second priority: College Roll Number (Unique within college/batch)
  if (cleanRoll && cleanRoll !== '—' && cleanRoll !== '-' && cleanRoll !== 'none' && cleanRoll !== 'null') {
    return `roll:${cleanRoll}|cat:${cleanPerf}`;
  }

  // 3. Third priority: Email address
  if (cleanEmail && cleanEmail.includes('@') && cleanEmail !== '—') {
    return `email:${cleanEmail}|cat:${cleanPerf}`;
  }

  // 4. Fourth priority: Contact / Mobile number (last 10 digits)
  if (cleanContact.length >= 10) {
    return `phone:${cleanContact.slice(-10)}|cat:${cleanPerf}`;
  }

  // 5. Fallback: Normalized participant name + performance category
  return `name:${cleanName}|cat:${cleanPerf}`;
}

/**
 * Safely parses spreadsheet timestamp strings, handling ISO formats,
 * DD/MM/YYYY, and localized Google Sheets timestamps without day/month inversion.
 */
function parseSheetTimestamp(raw: string | undefined): string {
  if (!raw || !raw.trim()) return new Date().toISOString();
  const trimmed = raw.trim();

  // If already an ISO string with T (e.g. 2026-10-09T18:40:13.757Z)
  if (trimmed.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Handle DD/MM/YYYY or D/M/YYYY or M/D/YYYY
  const parts = trimmed.split(/[\s,]+/);
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  const slashMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);

    const actualDay = p2 > 12 ? p2 : p1;
    const actualMonth = p2 > 12 ? p1 : p2;

    const [hh, mm, ss] = timePart.split(':').map((v) => parseInt(v || '0', 10));
    const d = new Date(Date.UTC(year, actualMonth - 1, actualDay, hh || 0, mm || 0, ss || 0));
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
}

/**
 * Fetches participant registration responses directly from Google Sheets & Forms API.
 * Automatically synchronizes Google Form web submissions into the Google Sheet ledger,
 * deduplicates entries, and returns normalized participant objects with zero database storage.
 */
export async function fetchGoogleFormEventResponses(params: {
  collegeId: string;
  eventId: string;
  bypassCache?: boolean;
}): Promise<{
  responses: GoogleFormParticipantResponse[];
  totalCount: number;
  syncedAt: string;
  source: 'GOOGLE_SHEETS' | 'GOOGLE_FORMS_API';
}> {
  const { collegeId, eventId, bypassCache = false } = params;

  // 1. Check in-memory cache
  if (!bypassCache) {
    const cached = responseCache.get(eventId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        responses: cached.data,
        totalCount: cached.data.length,
        syncedAt: new Date(cached.timestamp).toISOString(),
        source: 'GOOGLE_SHEETS',
      };
    }
  }

  // 2. Resolve Event Metadata
  const db = createAdminClient();
  if (!db) {
    throw new Error('Supabase client unavailable.');
  }

  const { data: rawEvent, error: eventErr } = await db
    .from('events')
    .select('*')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (eventErr || !rawEvent) {
    throw new Error(`Event not found or unauthorized: ${eventErr?.message || eventId}`);
  }

  const event = enrichEventWithGoogleMetadata(rawEvent);
  const eventSlug = event.slug || 'EVENT';
  const sheetId = event.google_spreadsheet_id || event.registration_sheet_id;
  const formId = event.google_form_id;

  const formApiResponses: GoogleFormParticipantResponse[] = [];
  let sheetRows: any[][] = [];
  let tabName = 'Form Responses 1';
  let source: 'GOOGLE_SHEETS' | 'GOOGLE_FORMS_API' = 'GOOGLE_SHEETS';

  // 3. Fetch data from Google Forms API & Google Sheets API
  await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ forms, sheets }) => {
    // 3a. Read live responses from Google Forms API
    if (formId) {
      try {
        const [formSchemaRes, formResponsesRes] = await Promise.all([
          forms.forms.get({ formId }),
          forms.forms.responses.list({ formId }),
        ]);

        const questionMap = new Map<string, string>();
        (formSchemaRes.data.items || []).forEach((item) => {
          const qId = item.questionItem?.question?.questionId;
          if (qId && item.title) {
            questionMap.set(qId, item.title.trim().toLowerCase());
          }
        });

        const rawFormResponses = formResponsesRes.data.responses || [];
        rawFormResponses.forEach((fRes, idx) => {
          const rawAnswers: Record<string, string> = {};
          let name = '';
          let regNo = '';
          let roll = '';
          let year = '';
          let branch = '';
          let contact = '';
          let email = fRes.respondentEmail || '';
          let perfType = '';
          let partType = 'Solo';
          let notes = '';

          const answers = fRes.answers || {};
          for (const [qId, ansObj] of Object.entries(answers)) {
            const qTitle = questionMap.get(qId) || '';
            const val = (ansObj.textAnswers?.answers || []).map((a) => a.value).filter(Boolean).join(', ');
            rawAnswers[qTitle || qId] = val;

            if (
              qTitle.includes('participation') ||
              qTitle.includes('participate') ||
              qTitle.includes('what type of performance would you like')
            ) {
              partType = val;
            } else if (
              qTitle.includes('which type of performance will you present') ||
              qTitle.includes('category') ||
              qTitle.includes('performance')
            ) {
              perfType = val;
            } else if (qTitle.includes('participant name') || (qTitle.includes('name') && !qTitle.includes('project'))) {
              name = val;
            } else if (qTitle.includes('registration number') || qTitle.includes('reg no')) {
              regNo = val;
            } else if (qTitle.includes('roll number') || qTitle.includes('roll')) {
              roll = val;
            } else if (qTitle.includes('academic year') || qTitle.includes('year')) {
              year = val;
            } else if (qTitle.includes('branch') || qTitle.includes('department')) {
              branch = val;
            } else if (qTitle.includes('contact') || qTitle.includes('mobile') || qTitle.includes('phone') || qTitle.includes('whatsapp')) {
              contact = val;
            } else if (qTitle.includes('email')) {
              email = email || val;
            } else if (
              qTitle.includes('title') ||
              qTitle.includes('topic') ||
              qTitle.includes('requirement') ||
              qTitle.includes('notes') ||
              qTitle.includes('remark')
            ) {
              notes = val;
            }
          }

          formApiResponses.push({
            responseId: fRes.responseId || `form-res-${idx + 1}`,
            submittedAt: fRes.lastSubmittedTime || fRes.createTime || new Date().toISOString(),
            participantName: name || 'Participant',
            registrationNumber: '',
            collegeRegistrationNumber: regNo || undefined,
            rollNumber: roll || '—',
            year: year || '1st Year',
            branch: branch || 'General',
            contactNumber: contact || '—',
            email: email || '—',
            performanceType: perfType || 'General Entry',
            participationType: partType || 'Solo',
            notes: notes || '',
            consent: true,
            rawAnswers,
          });
        });
      } catch (formApiErr) {
        console.warn('[AutoRegFetch] Forms API read error:', formApiErr);
      }
    }

    // 3b. Read existing ledger rows from Google Sheets API
    if (sheetId) {
      try {
        const meta = await sheets.spreadsheets.get({
          spreadsheetId: sheetId,
          fields: 'sheets(properties(sheetId,title))',
        });
        tabName = meta.data.sheets?.[0]?.properties?.title || 'Form Responses 1';

        const valuesRes = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${tabName}'!A1:Z5000`,
        });
        sheetRows = valuesRes.data.values || [];
      } catch (sheetErr) {
        console.warn('[AutoRegFetch] Sheet read warning:', sheetErr);
      }
    }
  });

  // 4. Merge & Deduplicate responses
  const sheetData = sheetRows.slice(1);
  const dedupMap = new Map<string, GoogleFormParticipantResponse>();

  // Add Forms API responses first (authoritative on web form submissions)
  formApiResponses.forEach((r) => {
    const sig = makeRegistrationSignature({
      roll: r.rollNumber,
      name: r.participantName,
      regNo: r.collegeRegistrationNumber,
      email: r.email,
      contact: r.contactNumber,
      perfType: r.performanceType,
    });
    dedupMap.set(sig, r);
  });

  // Add any rows from Google Sheet that might not be in Forms API (e.g. manual entries)
  sheetData.forEach((row, idx) => {
    if (!row || row.length === 0 || !row[1]) return;
    const submittedAt = row[0] ? parseSheetTimestamp(row[0]) : new Date().toISOString();
    const participantName = (row[1] || '').trim();
    const customRegNo = (row[2] || '').trim();
    const rollNumber = (row[3] || '').trim();
    const contact = (row[6] || '').trim();
    const email = (row[7] || '').trim();
    const perfType = (row[8] || '').trim();

    const sig = makeRegistrationSignature({
      roll: rollNumber,
      name: participantName,
      regNo: customRegNo,
      email,
      contact,
      perfType,
    });

    if (!dedupMap.has(sig)) {
      dedupMap.set(sig, {
        responseId: `sheet-row-${idx + 2}`,
        submittedAt,
        participantName,
        registrationNumber: '',
        collegeRegistrationNumber: customRegNo || undefined,
        rollNumber: rollNumber || '—',
        year: (row[4] || '1st Year').trim(),
        branch: (row[5] || '').trim(),
        contactNumber: contact || '—',
        email: email || '—',
        performanceType: perfType || 'General Entry',
        participationType: (row[9] || 'Solo').trim(),
        notes: (row[10] || '').trim(),
        consent: true,
        rawAnswers: {
          Name: participantName,
          Roll: rollNumber,
          RegNo: customRegNo,
          Year: row[4] || '',
          Branch: row[5] || '',
          Mobile: contact || '',
          Email: email || '',
          Category: perfType || '',
          Mode: row[9] || '',
          Remarks: row[10] || '',
        },
      });
    }
  });

  const mergedResponses = Array.from(dedupMap.values());
  // Sort chronologically
  mergedResponses.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  // Assign sequential pass numbers
  mergedResponses.forEach((r, idx) => {
    r.registrationNumber = generateRegistrationNumber(eventSlug, 'REG', idx + 1);
  });

  // 5. Automatically write & synchronize the complete ledger back to Google Sheet
  if (sheetId && mergedResponses.length > 0) {
    try {
      await executeWithCollegeGoogleOAuthRetry(collegeId, async ({ sheets }) => {
        const formattedRows = mergedResponses.map((r) => [
          r.submittedAt,
          r.participantName,
          r.collegeRegistrationNumber || '',
          r.rollNumber,
          r.year,
          r.branch,
          r.contactNumber,
          r.email,
          r.performanceType || '',
          r.participationType || 'Solo',
          r.notes || '',
          'Yes',
        ]);

        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `'${tabName}'!A1:L${formattedRows.length + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [GOOGLE_EVENT_REG_HEADERS, ...formattedRows],
          },
        });

        // If the sheet previously had more rows (e.g. duplicate rows), clear trailing rows
        if (sheetRows.length > formattedRows.length + 1) {
          await sheets.spreadsheets.values.clear({
            spreadsheetId: sheetId,
            range: `'${tabName}'!A${formattedRows.length + 2}:L${sheetRows.length + 10}`,
          });
        }
      });
    } catch (syncErr) {
      console.warn('[AutoRegFetch] Sheet sync update notice:', syncErr);
    }
  }

  if (mergedResponses.length > 0 && formApiResponses.length > 0) {
    source = 'GOOGLE_SHEETS';
  } else if (formApiResponses.length > 0) {
    source = 'GOOGLE_FORMS_API';
  }

  // Update in-memory cache
  responseCache.set(eventId, {
    timestamp: Date.now(),
    data: mergedResponses,
  });

  return {
    responses: mergedResponses,
    totalCount: mergedResponses.length,
    syncedAt: new Date().toISOString(),
    source,
  };
}

// ============================================================
// 7. PARTICIPANT REGISTRATION PDF PASS GENERATION
// ============================================================

/**
 * Dynamically generates a high-quality Participant Pass & Confirmation PDF
 * reading participant data directly from Google Sheets / Forms (ZERO database storage).
 */
export async function generateGoogleEventParticipantPdf(params: {
  collegeId: string;
  eventId: string;
  responseId: string;
}): Promise<Buffer> {
  const { collegeId, eventId, responseId } = params;

  // 1. Fetch Event & College branding
  const db = createAdminClient();
  if (!db) throw new Error('Supabase client unavailable.');

  const { data: rawEvent, error } = await db
    .from('events')
    .select('*, college:colleges(*)')
    .eq('id', eventId)
    .eq('college_id', collegeId)
    .maybeSingle();

  if (error || !rawEvent) {
    throw new Error('Event not found.');
  }

  const event = enrichEventWithGoogleMetadata(rawEvent);

  // 2. Fetch live Google response
  const syncResult = await fetchGoogleFormEventResponses({ collegeId, eventId });
  const participant = syncResult.responses.find(
    (r) => r.responseId === responseId || r.registrationNumber === responseId
  );

  if (!participant) {
    throw new Error(`Participant registration record "${responseId}" not found in Google Sheets.`);
  }

  const rawCollege = (rawEvent as any).college;
  const collegeName = rawCollege?.name || 'Institution';
  const collegeCode = rawCollege?.code || 'CAMPUS';
  const logoBuffer = await fetchLogoBuffer(rawCollege?.logo_url);

  // 3. Create PDF Document (A4, 1-page pass)
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    info: {
      Title: `Event Pass - ${participant.participantName} - ${event.title}`,
      Author: 'CampusFlow Platform',
      Subject: 'Official Event Registration Pass',
    },
  });

  const bufferPromise = streamToBuffer(doc);

  const pageWidth = 595.28;
  const contentWidth = pageWidth - 80;

  // Decorative Top Accent Bar
  doc.rect(40, 40, contentWidth, 6).fill(PDF_COLORS.secondary);

  // Header Box
  let y = 56;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 45, y, { fit: [50, 50] });
    } catch {
      // fallback if logo fails
    }
  }

  const headerLeft = logoBuffer ? 105 : 45;

  doc.font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(PDF_COLORS.primary)
    .text(collegeName.toUpperCase(), headerLeft, y, { width: contentWidth - (headerLeft - 40) });

  doc.font('Helvetica')
    .fontSize(9)
    .fillColor(PDF_COLORS.slateMuted)
    .text(`OFFICIAL EVENT REGISTRATION PASS & CONFIRMATION RECEIPT`, headerLeft, y + 20);

  // Status Badge on Top Right
  const badgeX = pageWidth - 160;
  doc.roundedRect(badgeX, y, 120, 24, 4).fill(PDF_COLORS.bgLight).stroke(PDF_COLORS.border);
  doc.font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor(PDF_COLORS.success)
    .text('✓ CONFIRMED ENTRY', badgeX, y + 7, { width: 120, align: 'center' });

  y += 55;
  doc.moveTo(40, y).lineTo(40 + contentWidth, y).strokeColor(PDF_COLORS.borderLight).stroke();
  y += 15;

  // Event Banner Card
  doc.roundedRect(40, y, contentWidth, 75, 8).fill(PDF_COLORS.bgAlt);
  doc.font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(PDF_COLORS.primary)
    .text(event.title, 55, y + 12, { width: contentWidth - 30 });

  doc.font('Helvetica')
    .fontSize(9.5)
    .fillColor(PDF_COLORS.slateText)
    .text(`Venue: ${event.venue || 'Campus Auditorium'}`, 55, y + 34);

  const startFormatted = event.start_at ? formatDateTime(event.start_at) : 'TBD';
  doc.text(`Event Schedule: ${startFormatted}`, 55, y + 49);

  // Verification Reference Box
  const passBoxX = pageWidth - 190;
  doc.roundedRect(passBoxX, y + 10, 135, 55, 6).fill(PDF_COLORS.white).stroke(PDF_COLORS.border);
  doc.font('Helvetica')
    .fontSize(7.5)
    .fillColor(PDF_COLORS.slateMuted)
    .text('PASS NUMBER', passBoxX, y + 18, { width: 135, align: 'center' });
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(PDF_COLORS.primary)
    .text(participant.registrationNumber, passBoxX, y + 30, { width: 135, align: 'center' });

  y += 90;

  // Participant Information Section
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(PDF_COLORS.secondary)
    .text('PARTICIPANT DETAILS', 40, y);

  y += 18;

  // Details Table / Key-Value Card
  const cardHeight = 135;
  doc.roundedRect(40, y, contentWidth, cardHeight, 6).strokeColor(PDF_COLORS.border).stroke();

  const col1X = 55;
  const col2X = 300;
  let rowY = y + 14;

  const renderField = (label: string, val: string, xPos: number, currentY: number) => {
    doc.font('Helvetica')
      .fontSize(8)
      .fillColor(PDF_COLORS.slateMuted)
      .text(label.toUpperCase(), xPos, currentY);
    doc.font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(PDF_COLORS.slateDark)
      .text(val || '—', xPos, currentY + 11);
  };

  renderField('Full Name', participant.participantName, col1X, rowY);
  renderField('Registration / Pass No', participant.registrationNumber, col2X, rowY);

  rowY += 34;
  renderField('Roll Number', participant.rollNumber, col1X, rowY);
  renderField('Academic Year', participant.year, col2X, rowY);

  rowY += 34;
  renderField('Branch / Department', participant.branch, col1X, rowY);
  renderField('Contact Mobile', participant.contactNumber, col2X, rowY);

  rowY += 34;
  renderField('Email Address', participant.email, col1X, rowY);
  renderField('Submission Timestamp', formatDateTime(participant.submittedAt), col2X, rowY);

  y += cardHeight + 20;

  // Performance / Activity Details Section
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(PDF_COLORS.secondary)
    .text('PERFORMANCE & EVENT PARTICIPATION', 40, y);

  y += 18;

  const perfCardHeight = 85;
  doc.roundedRect(40, y, contentWidth, perfCardHeight, 6).fill(PDF_COLORS.bgLight).stroke(PDF_COLORS.border);

  let pRowY = y + 14;
  renderField('Performance Category', participant.performanceType || 'General Entry', col1X, pRowY);
  renderField('Participation Mode', participant.participationType || 'Solo', col2X, pRowY);

  pRowY += 34;
  renderField('Performance Title / Notes', participant.notes || 'None specified', col1X, pRowY);

  y += perfCardHeight + 20;

  // Guidelines & Terms Box
  doc.roundedRect(40, y, contentWidth, 70, 6).strokeColor(PDF_COLORS.borderLight).stroke();
  doc.font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(PDF_COLORS.slateDark)
    .text('IMPORTANT GUIDELINES FOR PARTICIPANTS:', 50, y + 10);

  doc.font('Helvetica')
    .fontSize(7.5)
    .fillColor(PDF_COLORS.slateText)
    .text('1. Please carry your valid college student identity card along with this pass to the venue.', 50, y + 23)
    .text('2. Arrive at least 20 minutes prior to scheduled performance slot for stage & mic briefing.', 50, y + 34)
    .text('3. Any change in team members or music track must be coordinated with student coordinators in advance.', 50, y + 45)
    .text('4. This registration pass was issued digitally via CampusFlow and recorded in the official Google registry.', 50, y + 56);

  // Footer
  y = 776;
  doc.moveTo(40, y).lineTo(40 + contentWidth, y).strokeColor(PDF_COLORS.borderLight).stroke();
  doc.font('Helvetica')
    .fontSize(7)
    .fillColor(PDF_COLORS.slateMuted)
    .text(`CampusFlow Event Management • ${collegeCode} • Generated on ${new Date().toLocaleDateString('en-IN')}`, 40, y + 6, {
      width: contentWidth,
      align: 'center',
    });

  renderPdfAttributionFooter(doc, y + 17, {
    fontSize: 6.8,
    textColor: PDF_COLORS.slateMuted,
    linkColor: PDF_COLORS.secondary,
  });

  doc.end();

  return bufferPromise;
}
