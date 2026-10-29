const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const { esc, SITE_URL } = require('./escape');

// Resend ve SMTP istemcilerini ortam değişkenlerine göre başlat
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// SMTP Taşıyıcısını oluştur
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Premium Email Wrapper HTML Template
 */
function getEmailTemplate(title, content, sig = {}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${esc(title)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f9; padding: 20px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
              <!-- Blue Top Accent Bar -->
              <tr>
                <td style="background-color: #037ef3; height: 6px;"></td>
              </tr>
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 30px 40px 20px 40px; border-bottom: 1px solid #f0f0f0;">
                  <h1 style="margin: 0; color: #037ef3; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">AIESEC İSTANBUL</h1>
                  <span style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; display: block; margin-top: 4px;">Alumni Archive & Portal</span>
                </td>
              </tr>
              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 40px 30px 40px; color: #374151; font-size: 16px; line-height: 1.6;">
                  ${content}
                </td>
              </tr>
              <!-- Footer / Signature -->
              <tr>
                <td style="padding: 0 40px 40px 40px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #f0f0f0; padding-top: 30px;">
                    <tr>
                      <td style="vertical-align: top;">
                        <p style="margin: 0; font-size: 14px; font-weight: 700; color: #111827; white-space: nowrap;">${esc(sig.sig_name || '26-27 LCVP F&L Elif Kurnaz')}</p>
                        <p style="margin: 2px 0 10px 0; font-size: 13px; color: #6b7280;">${esc(sig.sig_org || 'AIESEC İstanbul')}</p>
                        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                          ${esc(sig.sig_note || 'Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.')}
                        </p>
                      </td>
                      <td align="right" style="vertical-align: top; width: 80px;">
                        <!-- Small Yellow Dot Accent -->
                        <span style="display: inline-block; width: 12px; height: 12px; background-color: #ffc80a; border-radius: 50%;"></span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Genel e-posta gönderme yardımcısı
 */
async function sendMailHelper({ to, subject, html, attachments = [] }) {
  const SiteSetting = require('../models/SiteSetting');
  const settings = await SiteSetting.getAll();
  const fromEmail = settings.email_from || 'Alumni Archive <onboarding@resend.dev>';

  if (transporter) {
    try {
      let fromAddress = fromEmail.includes('<') ? fromEmail : `Alumni Archive <${fromEmail}>`;
      const mailOptions = {
        from: fromAddress,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
      };
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }
      await transporter.sendMail(mailOptions);
      console.log(`Email successfully sent via SMTP to: ${to}`);
      return true;
    } catch (smtpErr) {
      console.error('SMTP sending failed, trying fallback if available:', smtpErr);
    }
  }

  if (resend) {
    try {
      const payload = {
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      };
      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }
      const { data, error } = await resend.emails.send(payload);

      if (error) {
        console.error('Resend API Error:', error);
        return false;
      }
      console.log(`Email successfully sent via Resend API to: ${to}`);
      return true;
    } catch (resendErr) {
      console.error('Resend API sending failed:', resendErr);
      return false;
    }
  }

  console.warn('⚠️ No mail sending provider (SMTP or Resend) is configured. Skipping email.');
  return false;
}

/**
 * Admin panelinden düzenlenebilen taslaktan { subject, html } üretir (bkz. utils/mailTemplates.js)
 */
async function composeMail(key, vars, buttonUrl) {
  const { buildMail } = require('./mailTemplates');
  const { subject, content, sig } = await buildMail(key, vars, buttonUrl);
  return { subject, html: getEmailTemplate(subject, content, sig) };
}

/** Onay maili gönderir */
async function sendApprovalEmail(email, name) {
  const mail = await composeMail('approved', { ad: name }, `${SITE_URL}/auth/login`);
  return await sendMailHelper({ to: email, ...mail });
}

/** Şifre sıfırlama maili gönderir */
async function sendResetPasswordEmail(email, name, resetLink) {
  const mail = await composeMail('reset', { ad: name }, resetLink);
  return await sendMailHelper({ to: email, ...mail });
}

/** Kayıt bilgilendirme maili gönderir */
async function sendWelcomePendingEmail(email, name) {
  const mail = await composeMail('welcome_pending', { ad: name });
  return await sendMailHelper({ to: email, ...mail });
}

/**
 * Yeni üye adayı başvurduğunda admin rolündeki tüm hesaplara bildirim maili gönderir
 */
async function sendAdminNotificationEmail(candidateName, candidateEmail) {
  const mail = await composeMail('admin_new', { ad: candidateName, email: candidateEmail }, `${SITE_URL}/admin`);
  // Herkese ayrı mail gider (kimse diğerlerinin adresini görmesin).
  // Admin bulunamazsa ya da sorgu hata verirse eski sabit adrese düşer.
  let recipients = [];
  try {
    const { getSQL } = require('../config/database');
    const rows = await getSQL()`SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL`;
    recipients = [...new Set(rows.map((r) => String(r.email).trim().toLowerCase()).filter(Boolean))];
  } catch (err) {
    console.error('Admin e-postaları okunamadı:', err.message);
  }
  if (recipients.length === 0) recipients = ['lcpist@gmail.com'];
  return await Promise.allSettled(recipients.map((to) => sendMailHelper({ to, ...mail })));
}

function sendApprovedListNotification(...args) {
  const notifier = require('./approvedListNotifier');
  return notifier.sendApprovedListNotification(...args);
}

module.exports = {
  sendApprovalEmail,
  sendResetPasswordEmail,
  sendWelcomePendingEmail,
  sendAdminNotificationEmail,
  sendApprovedListNotification,
  sendMailHelper,
  composeMail,
};
