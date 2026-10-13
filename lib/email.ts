import { Resend } from 'resend';

export async function sendEmail({
  to,
  subject,
  htmlContent,
}: {
  to: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY in the server environment.');
  }

  const resend = new Resend(apiKey);
  const devTestEmail = process.env.DEV_TEST_EMAIL;
  const recipients = devTestEmail ? [devTestEmail] : [to];

  try {
    const result = await resend.emails.send({
      from: 'American Credit Union <onboarding@resend.dev>',
      to: recipients,
      subject,
      html: htmlContent,
    });
    if (result.error) {
      throw new Error(`Resend email delivery failed: ${result.error.message}`);
    }
    if (!result.data) {
      throw new Error('Resend did not return an email delivery result.');
    }

    console.log('Email sent successfully via Resend:', result.data);
    return { success: true, data: result.data };
  } catch (error) {
    console.error('[Email Service Error]: Failed to dispatch email');
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to dispatch email');
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export async function sendPasswordResetEmail({
  email,
  resetUrl,
}: {
  email: string;
  resetUrl: string;
}): Promise<void> {
  const safeResetUrl = escapeHtml(resetUrl);
  await sendEmail({
    to: email,
    subject: 'Reset your online banking passcode',
    htmlContent: `<p>We received a request to reset your online banking passcode.</p><p><a href="${safeResetUrl}">Reset your passcode</a></p><p>This link expires in 20 minutes. If you did not request this reset, you can ignore this email.</p>`,
  });
}

export async function sendLoginVerificationEmail({
  email,
  code,
}: {
  email: string;
  code: string;
}): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Your Security Verification Code - American Credit Union',
    htmlContent: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937"><h1 style="font-size:22px;color:#173b70">Security verification code</h1><p>Use this one-time code to complete your sign-in:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#173b70">${code}</p><p>This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.</p></div>`,
  });
}
