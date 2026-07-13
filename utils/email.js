const { Resend } = require('resend');
const nodemailer = require('nodemailer');

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
function getEmailTemplate(title, content) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
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
                        <p style="margin: 0; font-size: 14px; font-weight: 700; color: #111827;">AIESEC İstanbul Mezunlar Birliği</p>
                        <p style="margin: 2px 0 10px 0; font-size: 13px; color: #6b7280;">Alumni Relations Team</p>
                        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                          Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.
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
async function sendMailHelper({ to, subject, html }) {
  const SiteSetting = require('../models/SiteSetting');
  const settings = await SiteSetting.getAll();
  const fromEmail = settings.email_from || 'AIESEC Alumni <onboarding@resend.dev>';

  if (transporter) {
    try {
      let fromAddress = fromEmail.includes('<') ? fromEmail : `AIESEC Alumni <${fromEmail}>`;
      await transporter.sendMail({
        from: fromAddress,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
      });
      console.log(`Email successfully sent via SMTP to: ${to}`);
      return true;
    } catch (smtpErr) {
      console.error('SMTP sending failed, trying fallback if available:', smtpErr);
    }
  }

  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      });

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
 * Onay maili gönderir
 */
async function sendApprovalEmail(email, name) {
  const htmlContent = `
    <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Merhaba ${name},</h2>
    <p>AIESEC İstanbul Alumni Archive sistemine yaptığınız kayıt başvurusu <strong>başarıyla onaylanmıştır!</strong></p>
    <p>Artık sisteme giriş yapabilir, geçmiş dönem takımlarını detaylıca inceleyebilir, diğer mezunların bilgilerine "Mezunlar Rehberi" üzerinden erişebilir ve kendi profil bilgilerinizi güncelleyebilirsiniz.</p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="https://aiesec-istanbul-archive.vercel.app/auth/login" style="background-color: #037ef3; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(3,126,243,0.2);">Sisteme Giriş Yap</a>
    </div>
    <p style="margin-bottom: 0;">Aramıza tekrar hoş geldiniz!</p>
  `;
  const html = getEmailTemplate('Hesabınız Onaylandı! 🎉', htmlContent);
  return await sendMailHelper({ to: email, subject: 'AIESEC İstanbul Alumni Archive - Hesabınız Onaylandı! 🎉', html });
}

/**
 * Şifre sıfırlama maili gönderir
 */
async function sendResetPasswordEmail(email, name, resetLink) {
  const htmlContent = `
    <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Merhaba ${name},</h2>
    <p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
    <p>Aşağıdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz. Bu bağlantı güvenlik nedeniyle <strong>1 saat</strong> geçerli kalacaktır:</p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="${resetLink}" style="background-color: #037ef3; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(3,126,243,0.2);">Şifremi Sıfırla</a>
    </div>
    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">Eğer bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
  `;
  const html = getEmailTemplate('Şifre Sıfırlama Talebi 🔑', htmlContent);
  return await sendMailHelper({ to: email, subject: 'AIESEC İstanbul Mezunlar Portalı - Şifre Sıfırlama Talebi 🔑', html });
}

/**
 * Kayıt bilgilendirme maili gönderir
 */
async function sendWelcomePendingEmail(email, name) {
  const htmlContent = `
    <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Merhaba ${name},</h2>
    <p>AIESEC İstanbul Alumni Archive platformuna yaptığınız kayıt talebi <strong>başarıyla alınmıştır.</strong></p>
    <p>Üyeliğinizin doğrulanması ve platformun güvenli kalması amacıyla başvurunuz yöneticilerimiz tarafından incelemeye alınmıştır.</p>
    <p>Hesabınız onaylandığında giriş yapabilmeniz için size yeni bir onay e-postası göndereceğiz.</p>
    <p style="margin-bottom: 0; color: #6b7280; font-size: 14px;">Gösterdiğiniz ilgi için teşekkür ederiz.</p>
  `;
  const html = getEmailTemplate('Kayıt Talebiniz Alındı 📩', htmlContent);
  return await sendMailHelper({ to: email, subject: 'AIESEC İstanbul Mezunlar Portalı - Kayıt Talebiniz Alındı 📩', html });
}

/**
 * Yeni üye adayı başvurduğunda yöneticiye bildirim maili gönderir
 */
async function sendAdminNotificationEmail(candidateName, candidateEmail) {
  const htmlContent = `
    <h2 style="color: #111827; font-size: 20px; margin-top: 0;">Sayın Yönetici,</h2>
    <p>AIESEC İstanbul Alumni Archive sistemine yeni bir üye adayı kayıt başvurusu yapmıştır.</p>
    <p><strong>Aday Detayları:</strong></p>
    <ul>
      <li><strong>Ad Soyad:</strong> ${candidateName}</li>
      <li><strong>E-posta:</strong> ${candidateEmail}</li>
    </ul>
    <p>Başvuruyu değerlendirmek, onaylamak veya reddetmek için lütfen admin paneline giriş yapınız:</p>
    <div style="text-align: center; margin: 35px 0;">
      <a href="https://aiesec-istanbul-archive.vercel.app/admin" style="background-color: #037ef3; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(3,126,243,0.2);">Admin Paneline Git</a>
    </div>
  `;
  const html = getEmailTemplate('Yeni Üye Kayıt Başvurusu 🔔', htmlContent);
  return await sendMailHelper({ to: 'elifkrnz963@gmail.com', subject: 'AIESEC İstanbul Mezunlar Portalı - Yeni Üye Kayıt Başvurusu 🔔', html });
}

module.exports = {
  sendApprovalEmail,
  sendResetPasswordEmail,
  sendWelcomePendingEmail,
  sendAdminNotificationEmail,
  sendMailHelper,
};
