/**
 * CAMPUSFLOW — GOOGLE APPS SCRIPT CONNECTOR
 * 
 * Account Runner: iambestadi@gmail.com
 * Platform: CampusFlow
 * Developer: Aditya Kumar Sah (under the guidance of Dr. Avinav)
 * 
 * Purpose:
 * 1. Provides native Form → Sheet destination linking (FormApp.setDestination).
 * 2. Sets official branded CampusFlow post-submission confirmation message.
 * 3. Enables "Submit another response" on all generated forms.
 * 4. Provides standalone 1-click functions to update active or existing Google Forms.
 * 
 * ============================================================================
 * HOW TO DEPLOY AS A WEB APP (UNDER iambestadi@gmail.com):
 * ============================================================================
 * 1. Open https://script.google.com with iambestadi@gmail.com.
 * 2. Create a New Project named "CampusFlow Connector".
 * 3. Paste this entire file into Code.gs and save (Ctrl+S).
 * 4. Click Deploy > New deployment.
 * 5. Select type: "Web app".
 *    - Description: "CampusFlow Connector v2.0"
 *    - Execute as: "Me (iambestadi@gmail.com)"
 *    - Who has access: "Anyone"
 * 6. Click "Deploy", review and grant permissions.
 * 7. Copy the Web App URL (starts with https://script.google.com/macros/s/.../exec).
 * 8. Set in CampusFlow .env.local and Vercel Environment Variables:
 *    GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
 *    GOOGLE_APPS_SCRIPT_RUNNER_EMAIL="iambestadi@gmail.com"
 * 
 * ============================================================================
 * HOW TO RETROACTIVELY FIX EXISTING GOOGLE FORMS (1-CLICK IN APPS SCRIPT):
 * ============================================================================
 * OPTION A — Inside the Google Form itself:
 *   1. Open your Google Form in edit mode (e.g., Dr. Abha Kumari's Chemistry Form).
 *   2. Click the three dots (More) in the top-right corner > "Script editor".
 *   3. Paste this code and save.
 *   4. In the function dropdown at the top, select "updateActiveFormConfirmation".
 *   5. Click "Run". Authorize when prompted. Done!
 * 
 * OPTION B — By Form ID or URL:
 *   1. In script.google.com, open "manualUpdateSingleForm" at the bottom of this file.
 *   2. Paste your Google Form ID or full edit URL in TARGET_FORM_ID_OR_URL.
 *   3. Select "manualUpdateSingleForm" and click "Run".
 * 
 * OPTION C — Update ALL Forms in your Google Drive at once:
 *   1. Select "updateAllFeedbackFormsInDrive" from the function dropdown.
 *   2. Click "Run". It will scan your Drive and update every feedback form automatically!
 */

var CANONICAL_DEFAULT_CONFIRMATION_MESSAGE = [
  'Your response has been recorded.',
  '',
  '==============================================',
  'VIEW YOUR OFFICIAL SUBMISSION RECEIPT & MORE FORMS:',
  'https://143campusflow.vercel.app/feedback/confirmation',
  '==============================================',
  '',
  'Access More Feedback Forms for Your Institution:',
  'https://143campusflow.vercel.app/feedback',
  '',
  'CampusFlow',
  'Designed and developed by Aditya Kumar Sah under the guidance of Dr. Avinav'
].join('\n');

/**
 * Web App POST endpoint — called programmatically by CampusFlow Next.js server.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10s timeout
    
    var data = {};
    if (e && e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }
    
    // Optional secret check
    var scriptSecret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (scriptSecret && data.secret !== scriptSecret) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Invalid or missing secret' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    var action = data.action;
    var formId = data.formId;
    var sheetId = data.sheetId;
    var confirmationMessage = data.confirmationMessage || CANONICAL_DEFAULT_CONFIRMATION_MESSAGE;

    if (action === 'configureFormConfirmation' || action === 'configureForm') {
      if (!formId) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: 'formId is required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      var configResult = configureFormConfirmation(formId, confirmationMessage);
      return ContentService.createTextOutput(
        JSON.stringify(configResult)
      ).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'linkFormToSheet' || !action) {
      if (!formId || !sheetId) {
        return ContentService.createTextOutput(
          JSON.stringify({ success: false, error: 'formId and sheetId are required' })
        ).setMimeType(ContentService.MimeType.JSON);
      }
      
      var linkResult = linkFormToSheet(formId, sheetId, confirmationMessage);
      return ContentService.createTextOutput(
        JSON.stringify(linkResult)
      ).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: 'Unknown action: ' + action })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Web App GET endpoint — diagnostic and status check.
 */
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({
      status: 'active',
      service: 'CampusFlow Google Apps Script Connector',
      version: '2.0.0',
      runnerEmail: 'iambestadi@gmail.com',
      attribution: 'Designed and developed by Aditya Kumar Sah under the guidance of Dr. Avinav'
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Links a Google Form directly to a Google Spreadsheet natively
 * and configures the post-submission confirmation message.
 */
function linkFormToSheet(formId, sheetId, confirmationMessage) {
  var form = FormApp.openById(formId);
  if (sheetId) {
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId);
  }
  
  var msg = confirmationMessage || CANONICAL_DEFAULT_CONFIRMATION_MESSAGE;
  form.setConfirmationMessage(msg);
  form.setShowLinkToRespondAgain(true);
  
  return {
    success: true,
    formId: formId,
    sheetId: sheetId,
    destinationType: 'NATIVE_SHEET',
    confirmationConfigured: true,
    message: 'Google Form response destination successfully connected to Google Sheet and confirmation message configured.'
  };
}

/**
 * Configures the Google Form post-submission confirmation message
 * and ensures "Submit another response" link is visible.
 */
function configureFormConfirmation(formId, confirmationMessage) {
  var form = FormApp.openById(formId);
  var msg = confirmationMessage || CANONICAL_DEFAULT_CONFIRMATION_MESSAGE;
  form.setConfirmationMessage(msg);
  form.setShowLinkToRespondAgain(true);

  return {
    success: true,
    formId: formId,
    confirmationConfigured: true,
    message: 'Google Form confirmation message and respond-again link successfully configured.'
  };
}

// ============================================================================
// DIRECT / STANDALONE UTILITIES (RUN DIRECTLY IN APPS SCRIPT CONSOLE)
// ============================================================================

/**
 * RUN THIS from inside a Google Form (Extensions > Apps Script)
 * to instantly update the currently open form!
 */
function updateActiveFormConfirmation() {
  try {
    var form = FormApp.getActiveForm();
    if (!form) {
      Logger.log('ERROR: No active form found. If running as standalone script, use updateFormConfirmationById().');
      return;
    }
    
    var formId = form.getId();
    var formTitle = form.getTitle();
    
    // Dynamic URL with form ID
    var customMsg = [
      'Your response has been recorded.',
      '',
      '==============================================',
      'VIEW YOUR OFFICIAL SUBMISSION RECEIPT & MORE FORMS:',
      'https://143campusflow.vercel.app/feedback/confirmation?formId=' + formId,
      '==============================================',
      '',
      'Access More Feedback Forms for Your Institution:',
      'https://143campusflow.vercel.app/feedback',
      '',
      'CampusFlow',
      'Designed and developed by Aditya Kumar Sah under the guidance of Dr. Avinav'
    ].join('\n');
    
    form.setConfirmationMessage(customMsg);
    form.setShowLinkToRespondAgain(true);
    
    Logger.log('SUCCESS! Form "' + formTitle + '" (ID: ' + formId + ') has been configured with the CampusFlow confirmation message.');
  } catch (err) {
    Logger.log('ERROR in updateActiveFormConfirmation: ' + err.toString());
  }
}

/**
 * Updates a form by Form ID or Form URL.
 */
function updateFormConfirmationByIdOrUrl(idOrUrl, customMessage) {
  var formId = idOrUrl;
  
  // Extract ID if a full URL was provided
  if (idOrUrl.indexOf('http') === 0) {
    var match = idOrUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      formId = match[1];
    }
  }
  
  var form = FormApp.openById(formId);
  var formTitle = form.getTitle();
  
  var msg = customMessage;
  if (!msg) {
    msg = [
      'Your response has been recorded.',
      '',
      '==============================================',
      'VIEW YOUR OFFICIAL SUBMISSION RECEIPT & MORE FORMS:',
      'https://143campusflow.vercel.app/feedback/confirmation?formId=' + formId,
      '==============================================',
      '',
      'Access More Feedback Forms for Your Institution:',
      'https://143campusflow.vercel.app/feedback',
      '',
      'CampusFlow',
      'Designed and developed by Aditya Kumar Sah under the guidance of Dr. Avinav'
    ].join('\n');
  }
  
  form.setConfirmationMessage(msg);
  form.setShowLinkToRespondAgain(true);
  
  Logger.log('SUCCESS! Updated Form "' + formTitle + '" [ID: ' + formId + ']');
  return { formId: formId, title: formTitle, success: true };
}

/**
 * Manual runner helper — change the string below and click Run!
 */
function manualUpdateSingleForm() {
  // PASTE YOUR FORM ID OR FULL URL HERE (e.g. Dr. Abha Kumari's Chemistry Form):
  var TARGET_FORM_ID_OR_URL = 'PASTE_YOUR_FORM_ID_OR_URL_HERE';
  
  if (TARGET_FORM_ID_OR_URL === 'PASTE_YOUR_FORM_ID_OR_URL_HERE') {
    Logger.log('Please replace TARGET_FORM_ID_OR_URL with your actual Google Form ID or edit URL.');
    return;
  }
  
  updateFormConfirmationByIdOrUrl(TARGET_FORM_ID_OR_URL);
}

/**
 * Scans Google Drive for ALL feedback forms and updates their confirmation messages in bulk!
 */
function updateAllFeedbackFormsInDrive() {
  var files = DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.form'");
  var count = 0;
  var updated = [];

  Logger.log('Starting scan of Google Forms in Google Drive...');

  while (files.hasNext()) {
    var file = files.next();
    var title = file.getName();
    var id = file.getId();

    try {
      var form = FormApp.openById(id);
      
      var customMsg = [
        'Your response has been recorded.',
        '',
        '==============================================',
        'VIEW YOUR OFFICIAL SUBMISSION RECEIPT & MORE FORMS:',
        'https://143campusflow.vercel.app/feedback/confirmation?formId=' + id,
        '==============================================',
        '',
        'Access More Feedback Forms for Your Institution:',
        'https://143campusflow.vercel.app/feedback',
        '',
        'CampusFlow',
        'Designed and developed by Aditya Kumar Sah under the guidance of Dr. Avinav'
      ].join('\n');

      form.setConfirmationMessage(customMsg);
      form.setShowLinkToRespondAgain(true);

      count++;
      updated.push(title + ' (' + id + ')');
      Logger.log('[' + count + '] Updated: ' + title);
    } catch (e) {
      Logger.log('Skipping ' + title + ' (' + id + '): ' + e.message);
    }
  }

  Logger.log('COMPLETED! Successfully updated ' + count + ' Google Forms.');
}
