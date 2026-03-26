const nodemailer = require('nodemailer');
const { env } = require('./env');

const transporter = nodemailer.createTransport({
  host: env.smtp.host,
  port: env.smtp.port,
  secure: false,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

async function sendVerificationEmail(toEmail, token) {
  const verifyUrl = `${env.appUrl}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Neph" <${env.smtp.user}>`,
    to: toEmail,
    subject: 'Verify your email',
    html: `
      <p>Thanks for signing up! Click the link below to verify your email:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

module.exports = { sendVerificationEmail };