import nodemailer from 'nodemailer';

type MailRecipient = {
  email: string;
  name?: string | null;
};

type MailMessage = {
  to: MailRecipient;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

type EmailDeliveryResult = {
  accepted: string[];
  rejected: string[];
  messageId: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required mail environment variable: ${name}`);
  }
  return value;
}

export function isMailConfigured() {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_PORT?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim() &&
      process.env.MAIL_FROM_ADDRESS?.trim()
  );
}

function getMailTransport() {
  const host = getRequiredEnv('SMTP_HOST');
  const port = Number(getRequiredEnv('SMTP_PORT'));
  const user = getRequiredEnv('SMTP_USER');
  const pass = getRequiredEnv('SMTP_PASS');
  const secure = (process.env.SMTP_SECURE ?? '').trim().toLowerCase() === 'true' || port === 465;

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('SMTP_PORT must be a valid positive number.');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  });
}

function getMailFrom() {
  const address = getRequiredEnv('MAIL_FROM_ADDRESS');
  const name = process.env.MAIL_FROM_NAME?.trim() || 'Vertex POS';
  return `${name} <${address}>`;
}

export function buildAppUrl(pathname: string, request?: Request | null) {
  const configuredBaseUrl =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim();

  const baseUrl = configuredBaseUrl || request?.url;
  if (!baseUrl) {
    throw new Error('Unable to resolve application URL. Set APP_URL in the environment.');
  }

  return new URL(pathname, baseUrl).toString();
}

export async function sendTransactionalEmail(message: MailMessage): Promise<EmailDeliveryResult> {
  if (!isMailConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM_ADDRESS.');
  }

  const transporter = getMailTransport();
  const result = await transporter.sendMail({
    from: getMailFrom(),
    to: message.to.name ? `${message.to.name} <${message.to.email}>` : message.to.email,
    replyTo: message.replyTo,
    subject: message.subject,
    html: message.html,
    text: message.text
  });

  return {
    accepted: result.accepted.map((value) => String(value)),
    rejected: result.rejected.map((value) => String(value)),
    messageId: result.messageId
  };
}

function getSupportEmail() {
  return process.env.MAIL_REPLY_TO?.trim() || process.env.MAIL_FROM_ADDRESS?.trim() || 'support@example.com';
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getBrandName() {
  return process.env.MAIL_BRAND_NAME?.trim() || 'Vertex POS';
}

function wrapEmailHtml({ preview, title, bodyHtml, ctaLabel, ctaUrl, footerHtml }: {
  preview: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  footerHtml: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e7e5e4;box-shadow:0 12px 32px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:32px;background:linear-gradient(135deg,#059669,#047857);color:#ffffff;">
                <div style="font-size:28px;font-weight:800;letter-spacing:0.02em;">${escapeHtml(getBrandName())}</div>
                <div style="margin-top:8px;font-size:14px;line-height:22px;color:#d1fae5;">Secure store operations for modern retail teams.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:28px;line-height:34px;color:#111827;">${escapeHtml(title)}</h1>
                <div style="font-size:15px;line-height:26px;color:#44403c;">${bodyHtml}</div>
                <div style="margin-top:28px;">
                  <a href="${ctaUrl}" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:14px;">${escapeHtml(ctaLabel)}</a>
                </div>
                <div style="margin-top:24px;font-size:13px;line-height:22px;color:#78716c;word-break:break-word;">
                  If the button does not work, copy and paste this link into your browser:<br />
                  <a href="${ctaUrl}" style="color:#059669;text-decoration:none;">${ctaUrl}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;font-size:13px;line-height:22px;color:#78716c;">
                ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmailVerificationEmail({
  to,
  verificationUrl,
  expiresAt
}: {
  to: MailRecipient;
  verificationUrl: string;
  expiresAt: Date;
}) {
  const brandName = getBrandName();
  const subject = `Verify your ${brandName} account`;
  const expiresLabel = expiresAt.toUTCString();

  return sendTransactionalEmail({
    to,
    subject,
    replyTo: getSupportEmail(),
    text: [
      `Welcome to ${brandName}.`,
      '',
      'Verify your email address by opening the link below:',
      verificationUrl,
      '',
      `This link expires on ${expiresLabel}.`,
      `If you did not create this account, you can ignore this email or contact ${getSupportEmail()}.`
    ].join('\n'),
    html: wrapEmailHtml({
      preview: `Verify your email address for ${brandName}.`,
      title: 'Verify your email address',
      bodyHtml: `
        <p style="margin:0 0 14px;">Welcome${to.name ? `, ${escapeHtml(to.name)}` : ''}.</p>
        <p style="margin:0 0 14px;">Your account has been created successfully. Confirm your email address to unlock sign-in access for the POS workspace.</p>
        <p style="margin:0;">This verification link expires on <strong>${escapeHtml(expiresLabel)}</strong>.</p>
      `,
      ctaLabel: 'Verify email',
      ctaUrl: verificationUrl,
      footerHtml: `If you did not create this account, you can safely ignore this email or contact <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#059669;text-decoration:none;">${escapeHtml(getSupportEmail())}</a>.`
    })
  });
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  expiresAt,
  issuedByName,
  shopName
}: {
  to: MailRecipient;
  resetUrl: string;
  expiresAt: Date;
  issuedByName?: string | null;
  shopName?: string | null;
}) {
  const brandName = getBrandName();
  const subject = `Reset your ${brandName} password`;
  const expiresLabel = expiresAt.toUTCString();
  const issuerLabel = issuedByName?.trim() || 'your administrator';
  const shopLabel = shopName?.trim() ? ` for ${shopName.trim()}` : '';

  return sendTransactionalEmail({
    to,
    subject,
    replyTo: getSupportEmail(),
    text: [
      `${issuerLabel} requested a password reset${shopLabel}.`,
      '',
      'Use the link below to set a new password:',
      resetUrl,
      '',
      `This link expires on ${expiresLabel}.`,
      `If you were not expecting this email, contact ${getSupportEmail()} immediately.`
    ].join('\n'),
    html: wrapEmailHtml({
      preview: `Reset your ${brandName} password.`,
      title: 'Set a new password',
      bodyHtml: `
        <p style="margin:0 0 14px;">Hello${to.name ? `, ${escapeHtml(to.name)}` : ''}.</p>
        <p style="margin:0 0 14px;">${escapeHtml(issuerLabel)} requested a password reset${escapeHtml(shopLabel)}.</p>
        <p style="margin:0;">Use the button below to set a new password. This link expires on <strong>${escapeHtml(expiresLabel)}</strong>.</p>
      `,
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
      footerHtml: `If you were not expecting this email, contact <a href="mailto:${escapeHtml(getSupportEmail())}" style="color:#059669;text-decoration:none;">${escapeHtml(getSupportEmail())}</a> immediately.`
    })
  });
}
