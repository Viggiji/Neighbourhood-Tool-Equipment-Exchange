const nodemailer = require('nodemailer');

/**
 * Creates a Nodemailer transporter.
 * In development, uses Ethereal (fake SMTP) so no real emails are sent.
 * In production, swap to your real SMTP provider.
 */
async function createTransporter() {
  // If SMTP credentials aren't set, generate an Ethereal test account
  if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your-ethereal')) {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
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
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Hey ${fullName} 👋</h2>
        <p style="color: #444; line-height: 1.6;">
          Welcome to the <strong>Neighborhood Tool & Equipment Exchange</strong>!
          We're glad you're joining your neighbors in sharing tools and building community.
        </p>
        <p style="color: #444; line-height: 1.6;">
          Click the button below to verify your email and finish setting up your account:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; display: inline-block;">
            Verify My Email
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">
          If you didn't sign up for NTEE, just ignore this email—no action needed.
        </p>
      </div>
    `,
  });

  // In dev, log the preview URL so you can actually see the email
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('📧 Email preview:', previewUrl);
  }

  return { messageId: info.messageId, previewUrl };
}

module.exports = { sendVerificationEmail };
