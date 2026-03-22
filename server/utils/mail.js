const crypto = require('crypto');
const nodemailer = require('nodemailer');

/** Gmail App Password: bỏ mọi khoảng trắng và dấu nháy thừa trong .env */
function getSmtpPassword() {
  const raw = process.env.SMTP_PASS;
  if (!raw) return '';
  return String(raw).replace(/\s+/g, '').replace(/^["']|["']$/g, '');
}

function createMailTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = getSmtpPassword();
  if (!host || !user || !pass) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port === 587,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
}

async function sendMail({ to, subject, text, html }) {
  const transport = createMailTransport();
  let from = process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || 'SportMate';
  from = from.replace(/^["']|["']$/g, '');

  if (!transport) {
    console.log('\n========== [SMTP chưa cấu hình — chỉ dùng dev] ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('========================================================\n');
    return;
  }

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, '<br/>'),
  });
}

function generateResetCode() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = {
  sendMail,
  createMailTransport,
  getSmtpPassword,
  generateResetCode,
};
