import { getOrCreateSpreadsheetInFolder, syncSpreadsheetTab, type SpreadsheetSyncStats } from './sheet-utils';

export interface EventsBackupResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  counts: {
    events: number;
    categories: number;
    programs: number;
    eventRegistrations: number;
    programRegistrations: number;
    teamMembers: number;
    teamInvitations: number;
    teamJoinRequests: number;
  };
  stats: {
    recordsExported: number;
    recordsCreated: number;
    recordsUpdated: number;
  };
}

/**
 * Backs up Events, categories, programs, and team registration records to
 * "CampusFlow - Events Backup" spreadsheet inside "Events" folder.
 */
export async function backupEventsData(params: {
  supabase: any;
  drive: any;
  sheets: any;
  collegeId: string;
  eventsFolderId: string;
}): Promise<EventsBackupResult> {
  const { supabase, drive, sheets, collegeId, eventsFolderId } = params;

  // 1. Fetch Events data
  const [
    { data: events },
    { data: categories },
    { data: programs },
    { data: eventRegs },
    { data: progRegs },
    { data: teamMembers },
    { data: invitations },
    { data: joinRequests },
  ] = await Promise.all([
    supabase.from('events').select('*').eq('college_id', collegeId).order('created_at', { ascending: false }),
    supabase.from('event_categories').select('*').eq('college_id', collegeId).order('display_order', { ascending: true }),
    supabase.from('event_programs').select('*').eq('college_id', collegeId).order('display_order', { ascending: true }),
    supabase.from('event_registrations').select('*').eq('college_id', collegeId).order('registered_at', { ascending: false }),
    supabase.from('program_registrations').select('*').eq('college_id', collegeId).order('registered_at', { ascending: false }),
    supabase.from('program_registration_members').select('*').eq('college_id', collegeId).order('created_at', { ascending: false }),
    supabase.from('event_team_invitations').select('*').eq('college_id', collegeId).order('created_at', { ascending: false }),
    supabase.from('team_join_requests').select('*').eq('college_id', collegeId).order('created_at', { ascending: false }),
  ]);

  // 2. Locate or create Spreadsheet
  const { spreadsheetId, spreadsheetUrl } = await getOrCreateSpreadsheetInFolder(
    drive,
    sheets,
    eventsFolderId,
    'CampusFlow - Events Backup',
    'Events'
  );

  let totalExported = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  function trackStats(st: SpreadsheetSyncStats) {
    totalExported += st.total;
    totalCreated += st.created;
    totalUpdated += st.updated;
  }

  // 3. Tab 1: Events
  const eventHeaders = [
    'Event ID',
    'College ID',
    'Title',
    'Slug',
    'Venue',
    'Start At',
    'End At',
    'Registration Enabled',
    'Payment Required',
    'Amount',
    'Max Capacity',
    'Status',
    'Created At',
    'Updated At',
  ];
  const eventRows = (events || []).map((e: any) => [
    e.id,
    e.college_id,
    e.title,
    e.slug,
    e.venue || '',
    e.start_at || '',
    e.end_at || '',
    e.registration_enabled ? 'YES' : 'NO',
    e.payment_required ? 'YES' : 'NO',
    e.payment_amount ?? '',
    e.max_capacity ?? '',
    e.status,
    e.created_at,
    e.updated_at,
  ]);
  const s1 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Events', eventHeaders, eventRows);
  trackStats(s1);

  // 4. Tab 2: Categories
  const catHeaders = ['Category ID', 'Event ID', 'College ID', 'Name', 'Description', 'Display Order', 'Status', 'Created At'];
  const catRows = (categories || []).map((c: any) => [
    c.id,
    c.event_id,
    c.college_id,
    c.name,
    c.description || '',
    c.display_order ?? 0,
    c.is_active ? 'ACTIVE' : 'INACTIVE',
    c.created_at,
  ]);
  const s2 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Categories', catHeaders, catRows);
  trackStats(s2);

  // 5. Tab 3: Programs
  const progHeaders = [
    'Program ID',
    'Event ID',
    'Category ID',
    'College ID',
    'Name',
    'Slug',
    'Participation Type',
    'Registration Fee',
    'Min Team Size',
    'Max Team Size',
    'Status',
    'Created At',
  ];
  const progRows = (programs || []).map((p: any) => [
    p.id,
    p.event_id,
    p.category_id,
    p.college_id,
    p.name,
    p.slug,
    p.participation_type || 'INDIVIDUAL',
    p.registration_fee ?? 0,
    p.min_team_size ?? '',
    p.max_team_size ?? '',
    p.is_active ? 'ACTIVE' : 'INACTIVE',
    p.created_at,
  ]);
  const s3 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Programs', progHeaders, progRows);
  trackStats(s3);

  // 6. Tab 4: Event Registrations
  const eRegHeaders = [
    'Registration ID',
    'Event ID',
    'College ID',
    'Student Name',
    'Email',
    'Mobile',
    'Registration Number',
    'Payment Status',
    'Registration Status',
    'Registered At',
  ];
  const eRegRows = (eventRegs || []).map((r: any) => [
    r.id,
    r.event_id,
    r.college_id,
    r.student_name,
    r.email,
    r.mobile || '',
    r.registration_number,
    r.payment_status || 'NOT_REQUIRED',
    r.registration_status || 'REGISTERED',
    r.registered_at,
  ]);
  const s4 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Event Registrations', eRegHeaders, eRegRows);
  trackStats(s4);

  // 7. Tab 5: Program Registrations
  const pRegHeaders = [
    'Registration ID',
    'Event ID',
    'Program ID',
    'College ID',
    'Student Name',
    'Email',
    'Mobile',
    'Registration Number',
    'Payment Status',
    'Registration Status',
    'Registered At',
  ];
  const pRegRows = (progRegs || []).map((r: any) => [
    r.id,
    r.event_id,
    r.program_id,
    r.college_id,
    r.student_name,
    r.email,
    r.mobile || '',
    r.registration_number,
    r.payment_status || 'NOT_REQUIRED',
    r.registration_status || 'REGISTERED',
    r.registered_at,
  ]);
  const s5 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Program Registrations', pRegHeaders, pRegRows);
  trackStats(s5);

  // 8. Tab 6: Team Members
  const memberHeaders = [
    'Member ID',
    'Registration ID',
    'College ID',
    'Program ID',
    'Student Name',
    'Email',
    'Mobile',
    'Registration Number',
    'Role',
    'Created At',
  ];
  const memberRows = (teamMembers || []).map((m: any) => [
    m.id,
    m.registration_id,
    m.college_id,
    m.program_id || '',
    m.student_name,
    m.email || '',
    m.mobile || '',
    m.registration_number,
    m.role || 'MEMBER',
    m.created_at,
  ]);
  const s6 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Team Members', memberHeaders, memberRows);
  trackStats(s6);

  // 9. Tab 7: Team Invitations
  const invHeaders = [
    'Invitation ID',
    'Event ID',
    'Program ID',
    'College ID',
    'Team Registration ID',
    'Invited Student Name',
    'Invited Registration Number',
    'Status',
    'Created At',
  ];
  const invRows = (invitations || []).map((inv: any) => [
    inv.id,
    inv.event_id,
    inv.program_id,
    inv.college_id,
    inv.team_registration_id,
    inv.invited_student_name || '',
    inv.invited_registration_number || '',
    inv.status || 'PENDING',
    inv.created_at,
  ]);
  const s7 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Team Invitations', invHeaders, invRows);
  trackStats(s7);

  // 10. Tab 8: Team Join Requests
  const reqHeaders = [
    'Request ID',
    'Event ID',
    'Program ID',
    'College ID',
    'Team Registration ID',
    'Student Name',
    'Registration Number',
    'Status',
    'Created At',
  ];
  const reqRows = (joinRequests || []).map((req: any) => [
    req.id,
    req.event_id,
    req.program_id,
    req.college_id,
    req.team_registration_id,
    req.student_name || '',
    req.registration_number || '',
    req.status || 'PENDING',
    req.created_at,
  ]);
  const s8 = await syncSpreadsheetTab(sheets, spreadsheetId, 'Team Join Requests', reqHeaders, reqRows);
  trackStats(s8);

  return {
    spreadsheetId,
    spreadsheetUrl,
    counts: {
      events: (events || []).length,
      categories: (categories || []).length,
      programs: (programs || []).length,
      eventRegistrations: (eventRegs || []).length,
      programRegistrations: (progRegs || []).length,
      teamMembers: (teamMembers || []).length,
      teamInvitations: (invitations || []).length,
      teamJoinRequests: (joinRequests || []).length,
    },
    stats: {
      recordsExported: totalExported,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
    },
  };
}
