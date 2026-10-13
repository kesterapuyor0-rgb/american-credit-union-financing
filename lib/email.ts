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
  const result = await resend.emails.send({
    from: 'American Credit Union <onboarding@resend.dev>',
    to: [to],
    subject,
    html: htmlContent,
  });
  if (result.error) {
    console.error('Error sending email via Resend:', result.error);
    throw new Error(`Resend email delivery failed: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error('Resend did not return an email delivery result.');
  }

  console.log('Email sent successfully via Resend:', result.data);
  return { success: true, data: result.data };
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
