# CampusFlow Google Apps Script Connector

**Runner Account**: `iambestadi@gmail.com`  
**Platform**: CampusFlow  
**Developer**: Aditya Kumar Sah (under the guidance of Dr. Avinav)

---

## What This Connector Does

1. **Native Form → Sheet Binding**: Uses `FormApp.setDestination(FormApp.DestinationType.SPREADSHEET, sheetId)` to pipe responses directly into Google Sheets.
2. **Official Post-Submission Confirmation Screen**: Replaces Google Forms' plain default message with the branded CampusFlow confirmation receipt and direct navigation buttons.
3. **Multi-Response Support**: Automatically enables `FormApp.setShowLinkToRespondAgain(true)`.
4. **Retroactive 1-Click Update**: Provides standalone functions (`updateActiveFormConfirmation`, `manualUpdateSingleForm`, `updateAllFeedbackFormsInDrive`) to retroactively fix existing Google Forms (e.g. Dr. Abha Kumari's Chemistry Form or previous Semester feedback forms).

---

## 3-Minute Deployment as Web App (Under `iambestadi@gmail.com`)

1. Go to [https://script.google.com](https://script.google.com) signed in as **`iambestadi@gmail.com`**.
2. Click **+ New project** and name it `CampusFlow Connector`.
3. Replace the contents of `Code.gs` with the code in `google-apps-script/Code.gs`.
4. Click **Deploy** > **New deployment**.
5. Select type: **Web app** (gear icon > Web app).
6. Fill in the deployment settings:
   - **Description**: `CampusFlow Connector v2.0`
   - **Execute as**: `Me (iambestadi@gmail.com)`
   - **Who has access**: `Anyone`
7. Click **Deploy** and complete the authorization prompt.
8. Copy the generated **Web app URL** (starts with `https://script.google.com/macros/s/.../exec`).
9. Add to your local `.env.local` and Vercel Project Environment Variables:
   ```env
   GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/.../exec"
   GOOGLE_APPS_SCRIPT_RUNNER_EMAIL="iambestadi@gmail.com"
   ```

---

## How to Immediately Update Existing Google Forms (e.g. Dr. Abha Kumari's Form)

### Method 1: Inside the Google Form (Fastest)
1. Open the Google Form in Edit mode in your browser.
2. Click the three dots (More) menu in the top right > **Script editor**.
3. Paste the contents of `google-apps-script/Code.gs` into the editor and click Save (`Ctrl + S`).
4. In the toolbar function dropdown, select **`updateActiveFormConfirmation`**.
5. Click **Run**. When Google asks for authorization, grant it.
6. Done! Test the form — submitting will now show the CampusFlow confirmation message with direct receipt link!

### Method 2: Update All Forms in Your Google Drive at Once
1. In [https://script.google.com](https://script.google.com) with `Code.gs` pasted:
2. Select **`updateAllFeedbackFormsInDrive`** from the function dropdown.
3. Click **Run**.
4. The execution log will print each form name and confirmation update. All feedback forms in your Drive will be updated!

### Method 3: By Form ID or URL
1. In `Code.gs`, scroll to `manualUpdateSingleForm()` at the bottom.
2. Put the Google Form URL or ID in `TARGET_FORM_ID_OR_URL`.
3. Select `manualUpdateSingleForm` and click **Run**.
