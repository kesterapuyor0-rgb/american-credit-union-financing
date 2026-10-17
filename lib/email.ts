import { Resend } from 'resend';

function getResendFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim()
    || 'American Credit Union <notifications@americancreditunionfinancing.app>';
}

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
  const from = getResendFromAddress();
  const supportEmail = process.env.SUPPORT_EMAIL?.trim()
    || 'americancreditunion.financing@gmail.com';
  const safeSupportEmail = escapeHtml(supportEmail);
  const emailHtml = `${htmlContent}<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280">Need help? <a href="mailto:${safeSupportEmail}" style="color:#173b70">Contact Support</a></p>`;

  try {
    const result = await resend.emails.send({
      from,
      to: [to],
      replyTo: supportEmail,
      subject,
      html: emailHtml,
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

export async function sendBroadcastEmail({
  to,
  subject,
  message,
  recipientName,
}: {
  to: string;
  subject: string;
  message: string;
  recipientName?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY in the server environment.');
  }

  const greeting = recipientName?.trim()
    ? `<p>Hello ${escapeHtml(recipientName.trim())},</p>`
    : '';
  const body = escapeHtml(message).replace(/\r\n|\r|\n/g, '<br>');
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937"><h1 style="font-size:22px;color:#173b70">${escapeHtml(subject)}</h1>${greeting}<p>${body}</p><hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#6b7280">Need help? <a href="mailto:american-credit-union.financing@gmail.com" style="color:#173b70">Contact Support</a></p></div>`;
  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: getResendFromAddress(),
    to: [to],
    subject,
    html,
  });

  if (result.error) {
    throw new Error(`Resend email delivery failed: ${result.error.message}`);
  }
  if (!result.data) {
    throw new Error('Resend did not return an email delivery result.');
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

export async function sendOtpEmail({
  toEmail,
  otpCode,
}: {
  toEmail: string;
  otpCode: string;
}): Promise<void> {
  const recipient = toEmail.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('A valid recipient email address is required.');
  }
  if (!/^\d{6}$/.test(otpCode)) {
    throw new Error('The verification code must contain exactly six digits.');
  }

  await sendEmail({
    to: recipient,
    subject: 'Your Security Verification Code - American Credit Union',
    htmlContent: `<div role="article" aria-label="Security verification code" style="margin:0;padding:24px 12px;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#172033">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e9ef;border-radius:12px;overflow:hidden">
        <div style="padding:26px 24px;background:#0c2340;text-align:center">
          <div style="font-size:20px;line-height:1.3;font-weight:700;color:#ffffff">American Credit Union</div>
          <div style="margin-top:6px;font-size:13px;color:#d9e2ef">Account security verification</div>
        </div>
        <div style="padding:32px 28px;text-align:center">
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.35;color:#0c2340">Your verification code</h1>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#4b5563">Enter this one-time code to continue:</p>
          <div style="display:inline-block;padding:15px 24px;border-radius:8px;background:#d9232a;color:#ffffff;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:8px">${escapeHtml(otpCode)}</div>
          <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#4b5563"><strong>This code expires in 10 minutes.</strong> Never share it with anyone, including someone claiming to represent American Credit Union.</p>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280">If you did not request this code, you can safely ignore this email.</p>
        </div>
        <div style="padding:18px 24px;border-top:1px solid #e5e9ef;text-align:center;color:#6b7280;font-size:12px;line-height:1.6">
          &copy; ${new Date().getFullYear()} American Credit Union. All rights reserved.
        </div>
      </div>
    </div>`,
  });
}
