const nodemailer = require('nodemailer');
const { env } = require('./env');

const transporter =
  env.nodeEnv === 'test'
    ? nodemailer.createTransport({
        jsonTransport: true,
      })
    : nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: false,
        auth: {
          user: env.smtp.user,
          pass: env.smtp.pass,
        },
      });

async function sendVerificationEmail(toEmail, token) {
  const encodedToken = encodeURIComponent(token);
  const encodedEmail = encodeURIComponent(toEmail);
  const verifyUrl = `${env.frontendUrl}/verify-email?token=${encodedToken}&email=${encodedEmail}`;

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

async function sendPasswordResetEmail(toEmail, token) {
  const resetUrl = `${env.frontendUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Neph" <${env.smtp.user}>`,
    to: toEmail,
    subject: 'Reset your password',
    html: `
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
  });
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
