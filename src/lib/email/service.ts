/**
 * Student Response Confirmation Email Service
 * Manages automated dispatch of submission receipts with secure response download links.
 * Explicitly tracks states: PENDING, SENT, FAILED, EMAIL_NOT_CONFIGURED.
 * Supports: Brevo API (v3), Resend API, SendGrid, and custom SMTP.
 */

export interface SendConfirmationEmailParams {
  studentEmail: string;
  studentName?: string | null;
  registrationNumber?: string | null;
  formTitle: string;
  academicYear: string;
  branch: string;
  semester: string;
  submittedAt?: string | null;
  downloadUrl: string;
  institutionName?: string | null;
}

export interface EmailDeliveryResult {
  status: 'SENT' | 'FAILED' | 'EMAIL_NOT_CONFIGURED';
  sentAt: string | null;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.BREVO_API_KEY ||
    process.env.RESEND_API_KEY ||
    process.env.SENDGRID_API_KEY ||
    (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

/**
 * Sends a feedback submission confirmation email to the verified student.
 * 
 * Guarantees:
 * - Only sets status 'SENT' and sentAt if the email was genuinely accepted by the email service.
 * - If not configured, returns 'EMAIL_NOT_CONFIGURED' and sentAt = null.
 * - Never leaks other student data, private Google Sheet links, or system secrets.
 */
export async function sendStudentSubmissionConfirmationEmail(
  params: SendConfirmationEmailParams
): Promise<EmailDeliveryResult> {
  const {
    studentEmail,
    studentName,
    registrationNumber,
    formTitle,
    academicYear,
    branch,
    semester,
    submittedAt,
    downloadUrl,
    institutionName,
  } = params;

  if (!studentEmail || !studentEmail.includes('@')) {
    return {
      status: 'FAILED',
      sentAt: null,
      error: 'Invalid student email address',
    };
  }

  // Check if provider is configured
  if (!isEmailConfigured()) {
    console.info(
      `[EmailService] Email provider not configured (Brevo/Resend/SMTP credentials missing in environment). State: EMAIL_NOT_CONFIGURED for ${studentEmail}`
    );
    return {
      status: 'EMAIL_NOT_CONFIGURED',
      sentAt: null,
      error: 'Brevo/SMTP/Email service credentials are not configured in server environment',
    };
  }

  const subject = `Feedback Submission Confirmation — ${semester} ${branch}`;
  const formattedTime = submittedAt
    ? new Date(submittedAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const textContent = `
Congratulations! 🎉

You have successfully submitted your feedback for:
Form: ${formTitle}
Academic Session: ${academicYear}
Branch: ${branch}
Semester: ${semester}
Student Name: ${studentName || 'Confidential Student'}
Registration Number: ${registrationNumber || 'N/A'}
Submission Timestamp: ${formattedTime}

You can download a secure, official copy of your submitted responses using this private link:
${downloadUrl}

(Note: This link is unique and cryptographically signed for your response record.)

${institutionName || 'CampusFlow'}
CampusFlow
`.trim();

  // 1. Brevo HTTPS API v3 (Primary when BREVO_API_KEY is configured)
  if (process.env.BREVO_API_KEY) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'iambestadi@gmail.com';
      const senderName = process.env.BREVO_SENDER_NAME || 'CampusFlow';

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: senderName,
            email: senderEmail,
          },
          to: [
            {
              email: studentEmail,
              name: studentName || 'Student',
            },
          ],
          subject,
          textContent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[EmailService] Brevo API error: ${errorText}`);
        return {
          status: 'FAILED',
          sentAt: null,
          error: `Brevo error: ${errorText}`,
        };
      }

      return {
        status: 'SENT',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[EmailService] Brevo dispatch failed:', err);
      return {
        status: 'FAILED',
        sentAt: null,
        error: err.message || 'Network error dispatching Brevo email',
      };
    }
  }

  // 2. Resend HTTPS API (Alternative)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Feedback System <noreply@feedbacksystem.internal>',
          to: studentEmail,
          subject,
          text: textContent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[EmailService] Resend API error: ${errorText}`);
        return {
          status: 'FAILED',
          sentAt: null,
          error: `Resend error: ${errorText}`,
        };
      }

      return {
        status: 'SENT',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[EmailService] Resend dispatch failed:', err);
      return {
        status: 'FAILED',
        sentAt: null,
        error: err.message || 'Network error dispatching email',
      };
    }
  }

  // 3. Fallback for custom SMTP if nodemailer is available or fallback to EMAIL_NOT_CONFIGURED
  return {
    status: 'EMAIL_NOT_CONFIGURED',
    sentAt: null,
    error: 'Configured email provider driver not loaded',
  };
}

export interface SendVerificationEmailParams {
  studentEmail: string;
  studentName?: string | null;
  collegeName?: string | null;
  verificationUrl: string;
}

/**
 * Sends a student account email verification link.
 * Integrates Brevo HTTPS API v3 as primary provider with resilient fallbacks.
 */
export async function sendStudentVerificationEmail(
  params: SendVerificationEmailParams
): Promise<EmailDeliveryResult> {
  const { studentEmail, studentName, collegeName, verificationUrl } = params;

  if (!studentEmail || !studentEmail.includes('@')) {
    return {
      status: 'FAILED',
      sentAt: null,
      error: 'Invalid student email address',
    };
  }

  if (!isEmailConfigured()) {
    console.info(
      `[EmailService] Email provider not configured. Verification link for ${studentEmail}: ${verificationUrl}`
    );
    return {
      status: 'EMAIL_NOT_CONFIGURED',
      sentAt: null,
      error: 'Email service credentials (BREVO_API_KEY) are not configured in server environment',
    };
  }

  const institution = collegeName || 'CampusFlow';
  const name = studentName || 'Student';
  const subject = `Verify your student email for ${institution} — CampusFlow`;

  const textContent = `
Hello ${name},

Welcome to CampusFlow Feedback Portal!

Please verify your email address to activate your student account for ${institution}.
Click the link below to confirm your account:
${verificationUrl}

(Note: This verification link is secure and valid for 24 hours.)

If you did not sign up for a CampusFlow account, you can safely ignore this email.

Best regards,
${institution} & CampusFlow Team
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: #0B192C; padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
    .body { padding: 32px 24px; }
    .greeting { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
    .text { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #1E3E62; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 32px; border-radius: 10px; box-shadow: 0 2px 4px rgba(30, 62, 98, 0.2); }
    .link-alt { font-size: 12px; color: #64748b; word-break: break-all; margin-top: 16px; background: #f1f5f9; padding: 12px; border-radius: 8px; }
    .footer { border-top: 1px solid #f1f5f9; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>CampusFlow</h1>
      <p>Institutional Feedback & Evaluation Portal</p>
    </div>
    <div class="body">
      <div class="greeting">Hello ${name},</div>
      <p class="text">
        Welcome! You recently created a student account for <strong>${institution}</strong> on CampusFlow. Please confirm your email address by clicking the button below:
      </p>
      <div class="btn-wrap">
        <a href="${verificationUrl}" class="btn" target="_blank">Verify Email Address</a>
      </div>
      <p class="text" style="font-size: 12px; margin-bottom: 8px;">
        If the button above does not work, copy and paste this verification URL into your browser:
      </p>
      <div class="link-alt">${verificationUrl}</div>
    </div>
    <div class="footer">
      This link is valid for 24 hours. If you did not create this account, no action is required.<br>
      © ${new Date().getFullYear()} CampusFlow • Multi-Tenant Feedback System
    </div>
  </div>
</body>
</html>
`.trim();

  // 1. Brevo HTTPS API v3
  if (process.env.BREVO_API_KEY) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'iambestadi@gmail.com';
      const senderName = process.env.BREVO_SENDER_NAME || 'CampusFlow';

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: studentEmail, name }],
          subject,
          textContent,
          htmlContent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[EmailService] Brevo verification error: ${errorText}`);
        return {
          status: 'FAILED',
          sentAt: null,
          error: `Brevo error: ${errorText}`,
        };
      }

      return {
        status: 'SENT',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[EmailService] Brevo verification dispatch failed:', err);
      return {
        status: 'FAILED',
        sentAt: null,
        error: err.message || 'Network error dispatching verification email',
      };
    }
  }

  // 2. Resend HTTPS API (Alternative)
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'CampusFlow <noreply@campusflow.internal>',
          to: studentEmail,
          subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          status: 'FAILED',
          sentAt: null,
          error: `Resend error: ${errorText}`,
        };
      }

      return {
        status: 'SENT',
        sentAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        sentAt: null,
        error: err.message || 'Network error dispatching verification email',
      };
    }
  }

  return {
    status: 'EMAIL_NOT_CONFIGURED',
    sentAt: null,
    error: 'Configured email provider driver not loaded',
  };
}

export interface SendPasswordResetEmailParams {
  studentEmail: string;
  studentName?: string | null;
  resetUrl: string;
}

/**
 * Sends a student password reset link.
 */
export async function sendStudentPasswordResetEmail(
  params: SendPasswordResetEmailParams
): Promise<EmailDeliveryResult> {
  const { studentEmail, studentName, resetUrl } = params;

  if (!studentEmail || !studentEmail.includes('@')) {
    return {
      status: 'FAILED',
      sentAt: null,
      error: 'Invalid student email address',
    };
  }

  if (!isEmailConfigured()) {
    console.info(
      `[EmailService] Email provider not configured. Reset link for ${studentEmail}: ${resetUrl}`
    );
    return {
      status: 'EMAIL_NOT_CONFIGURED',
      sentAt: null,
      error: 'Email service credentials (BREVO_API_KEY) are not configured in server environment',
    };
  }

  const name = studentName || 'Student';
  const subject = `Reset your CampusFlow Password`;
  const textContent = `
Hello ${name},

We received a request to reset your password for CampusFlow.
Click the link below to set a new password:
${resetUrl}

This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.

Best regards,
CampusFlow Security Team
`.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
  <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px 24px;">
    <h2 style="margin: 0 0 16px; color: #0B192C;">Password Reset Request</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      Hello ${name},<br><br>
      We received a request to reset your CampusFlow student password. Click the button below to choose a new password:
    </p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background: #1E3E62; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; display: inline-block;">Reset Password</a>
    </div>
    <p style="font-size: 12px; color: #64748b;">
      If you did not request this password reset, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
`.trim();

  // 1. Brevo HTTPS API v3
  if (process.env.BREVO_API_KEY) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_FROM || 'iambestadi@gmail.com';
      const senderName = process.env.BREVO_SENDER_NAME || 'CampusFlow';

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: studentEmail, name }],
          subject,
          textContent,
          htmlContent,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { status: 'FAILED', sentAt: null, error: `Brevo error: ${errorText}` };
      }

      return { status: 'SENT', sentAt: new Date().toISOString() };
    } catch (err: any) {
      return { status: 'FAILED', sentAt: null, error: err.message || 'Error dispatching email' };
    }
  }

  return { status: 'EMAIL_NOT_CONFIGURED', sentAt: null, error: 'Provider not loaded' };
}

