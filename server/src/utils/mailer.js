const nodemailer = require('nodemailer');

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

async function sendEmail({ to, subject, html }) {
  if (!process.env.SMTP_USER) {
    console.log(`[MAIL:MOCK] to=${to} subject=${subject}\n${html}`);
    return { mocked: true };
  }
  const t = getTransporter();
  return t.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
}

module.exports = { sendEmail };
