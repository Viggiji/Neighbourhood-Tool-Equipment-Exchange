const nodemailer = require('nodemailer');

let cachedTestTransporter = null;

/**
 * Creates a Nodemailer transporter.
 * In development, uses Ethereal (fake SMTP) so no real emails are sent.
 * In production, uses configured SMTP credentials.
 */
async function createTransporter() {
  if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your-ethereal')) {
    if (!cachedTestTransporter) {
      const testAccount = await nodemailer.createTestAccount();
      cachedTestTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }
    return cachedTestTransporter;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Sends a verification email to a newly registered resident.
 * Returns the Ethereal preview URL in development.
 */
async function sendVerificationEmail(toEmail, fullName, verifyToken) {
  const transporter = await createTransporter();
  const verifyUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify?token=${verifyToken}`;

  const info = await transporter.sendMail({
    from: '"Neighborhood Tool Exchange" <noreply@ntee.community>',
    to: toEmail,
    subject: `Welcome to the neighborhood, ${fullName}! Please verify your email`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #1a1917; color: #ede9e3; border-radius: 16px;">
        <h2 style="color: #ede9e3; margin-bottom: 8px;">Hey ${fullName} 👋</h2>
        <p style="color: #a8a49c; line-height: 1.6;">
          Welcome to the <strong style="color: #ede9e3;">Neighborhood Tool &amp; Equipment Exchange</strong>!
          We're glad you're joining your neighbors in sharing tools and building community.
        </p>
        <p style="color: #a8a49c; line-height: 1.6;">
          Click the button below to verify your email and finish setting up your account:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="background: #d05a38; color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block;">
            Verify My Email
          </a>
        </div>
        <p style="color: #7d7a73; font-size: 13px;">
          If you didn't sign up for NTEE, just ignore this email—no action needed.
        </p>
      </div>
    `,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('📧 Email preview:', previewUrl);
  }

  return { messageId: info.messageId, previewUrl };
}

/**
 * Sends a transactional notification email for Sprint 2 rental events.
 * Fails softly (logs warning) so email outages never interrupt bookings.
 */
async function sendNotificationEmail({ toEmail, toName, subject, heading, body, ctaText, ctaPath }) {
  if (!toEmail) return null;

  try {
    const transporter = await createTransporter();
    const baseUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const targetUrl = ctaPath ? `${baseUrl}${ctaPath}` : baseUrl;

    const info = await transporter.sendMail({
      from: '"Neighborhood Tool Exchange" <noreply@ntee.community>',
      to: toEmail,
      subject,
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #1a1917; color: #ede9e3; border-radius: 16px; border: 1px solid #2f2d2a;">
          <p style="color: #d05a38; font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin: 0 0 8px;">NTEE · ToolShare</p>
          <h2 style="color: #ede9e3; margin: 0 0 12px;">${heading}</h2>
          <p style="color: #a8a49c; line-height: 1.6; margin: 0 0 24px;">
            Hi ${toName || 'neighbor'},<br/><br/>
            ${body}
          </p>
          ${ctaText ? `
            <div style="margin: 24px 0;">
              <a href="${targetUrl}" style="background: #d05a38; color: #fff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block;">
                ${ctaText}
              </a>
            </div>
          ` : ''}
          <p style="color: #5a5751; font-size: 12px; margin-top: 24px; border-top: 1px solid #2f2d2a; padding-top: 16px;">
            Neighborhood Tool &amp; Equipment Exchange
          </p>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`📧 [Email Alert] ${subject} → ${previewUrl}`);
    }
    return { messageId: info.messageId, previewUrl };
  } catch (err) {
    console.warn(`[Email] Could not send "${subject}" to ${toEmail}:`, err.message);
    return null;
  }
}

module.exports = { sendVerificationEmail, sendNotificationEmail };
