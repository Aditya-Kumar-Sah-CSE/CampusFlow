import { getOrCreateSpreadsheetInFolder, syncSpreadsheetTab, type SpreadsheetSyncStats } from './sheet-utils';

export interface BillingSystemBackupResult {
  billingSpreadsheetId: string;
  billingSpreadsheetUrl: string;
  systemSpreadsheetId: string;
  systemSpreadsheetUrl: string;
  counts: {
    billingAccounts: number;
    paymentRequests: number;
    trialEntitlements: number;
    auditLogs: number;
  };
  stats: {
    recordsExported: number;
    recordsCreated: number;
    recordsUpdated: number;
  };
}

/**
 * Backs up Billing records and Audit Logs.
 * Strictly excludes secrets, tokens, passwords, and private media bytes.
 */
export async function backupBillingAndSystemData(params: {
  supabase: any;
  drive: any;
  sheets: any;
  collegeId: string;
  billingFolderId: string;
  systemFolderId: string;
}): Promise<BillingSystemBackupResult> {
  const { supabase, drive, sheets, collegeId, billingFolderId, systemFolderId } = params;

  // 1. Fetch Billing and Audit data
  const [
    { data: billingAccounts },
    { data: paymentReqs },
    { data: trials },
    { data: auditLogs },
  ] = await Promise.all([
    supabase.from('college_billing_accounts').select('*').eq('college_id', collegeId),
    supabase.from('college_payment_requests').select(`
      id,
      college_id,
      plan_type,
      amount,
      payment_method,
      payment_reference,
      status,
      submitted_by,
      reviewed_at,
      rejection_reason,
      created_at,
      updated_at
    `).eq('college_id', collegeId).order('created_at', { ascending: false }),
    supabase.from('college_trial_entitlements').select('*').eq('college_id', collegeId).order('created_at', { ascending: false }),
    supabase.from('audit_logs').select(`
      id,
      college_id,
      actor_email,
      action,
      entity_type,
      entity_id,
      details,
      created_at
    `).eq('college_id', collegeId).order('created_at', { ascending: false }).limit(500),
  ]);

  let totalExported = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  function trackStats(st: SpreadsheetSyncStats) {
    totalExported += st.total;
    totalCreated += st.created;
    totalUpdated += st.updated;
  }

  // 2. Billing Spreadsheet in Billing Folder
  const { spreadsheetId: billingSpreadsheetId, spreadsheetUrl: billingSpreadsheetUrl } =
    await getOrCreateSpreadsheetInFolder(
      drive,
      sheets,
      billingFolderId,
      'CampusFlow - Billing Backup',
      'Billing Accounts'
    );

  // Tab 1: Billing Accounts
  const accountHeaders = [
    'Account ID',
    'College ID',
    'Plan Type',
    'Access Status',
    'Subscription Status',
    'Started At',
    'Expires At',
    'Created At',
    'Updated At',
  ];
  const accountRows = (billingAccounts || []).map((b: any) => [
    b.id,
    b.college_id,
    b.plan_type,
    b.access_status,
    b.subscription_status,
    b.started_at || '',
    b.expires_at || '',
    b.created_at,
    b.updated_at,
  ]);
  const s1 = await syncSpreadsheetTab(sheets, billingSpreadsheetId, 'Billing Accounts', accountHeaders, accountRows);
  trackStats(s1);

  // Tab 2: Payment Requests
  const payHeaders = [
    'Request ID',
    'College ID',
    'Plan Type',
    'Amount (INR)',
    'Payment Method',
    'Payment Reference',
    'Status',
    'Submitted By User ID',
    'Reviewed At',
    'Rejection Reason',
    'Created At',
    'Updated At',
  ];
  const payRows = (paymentReqs || []).map((p: any) => [
    p.id,
    p.college_id,
    p.plan_type,
    p.amount,
    p.payment_method,
    p.payment_reference,
    p.status,
    p.submitted_by,
    p.reviewed_at || '',
    p.rejection_reason || '',
    p.created_at,
    p.updated_at,
  ]);
  const s2 = await syncSpreadsheetTab(sheets, billingSpreadsheetId, 'Payment Requests', payHeaders, payRows);
  trackStats(s2);

  // Tab 3: Trial Entitlements
  const trialHeaders = [
    'Trial ID',
    'College ID',
    'Status',
    'Starts At',
    'Expires At',
    'Features',
    'Note',
    'Created At',
    'Updated At',
  ];
  const trialRows = (trials || []).map((t: any) => [
    t.id,
    t.college_id,
    t.status,
    t.starts_at,
    t.expires_at,
    Array.isArray(t.features) ? t.features.join(', ') : '',
    t.note || '',
    t.created_at,
    t.updated_at,
  ]);
  const s3 = await syncSpreadsheetTab(sheets, billingSpreadsheetId, 'Trial Entitlements', trialHeaders, trialRows);
  trackStats(s3);

  // 3. System Spreadsheet in System Folder
  const { spreadsheetId: systemSpreadsheetId, spreadsheetUrl: systemSpreadsheetUrl } =
    await getOrCreateSpreadsheetInFolder(
      drive,
      sheets,
      systemFolderId,
      'CampusFlow - Audit Logs Backup',
      'Audit Logs'
    );

  const auditHeaders = [
    'Log ID',
    'College ID',
    'Actor Email',
    'Action',
    'Entity Type',
    'Entity ID',
    'Details',
    'Created At',
  ];
  const auditRows = (auditLogs || []).map((a: any) => [
    a.id,
    a.college_id,
    a.actor_email || '',
    a.action,
    a.entity_type || '',
    a.entity_id || '',
    a.details || '',
    a.created_at,
  ]);
  const s4 = await syncSpreadsheetTab(sheets, systemSpreadsheetId, 'Audit Logs', auditHeaders, auditRows);
  trackStats(s4);

  return {
    billingSpreadsheetId,
    billingSpreadsheetUrl,
    systemSpreadsheetId,
    systemSpreadsheetUrl,
    counts: {
      billingAccounts: (billingAccounts || []).length,
      paymentRequests: (paymentReqs || []).length,
      trialEntitlements: (trials || []).length,
      auditLogs: (auditLogs || []).length,
    },
    stats: {
      recordsExported: totalExported,
      recordsCreated: totalCreated,
      recordsUpdated: totalUpdated,
    },
  };
}
