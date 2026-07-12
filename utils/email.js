const { Resend } = require('resend');
const nodemailer = require('nodemailer');

// Resend ve SMTP istemcilerini ortam değişkenlerine göre başlat
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// SMTP Taşıyıcısını oluştur (Eğer değişkenler tanımlıysa)
let transporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Genel e-posta gönderme yardımcısı
 */
async function sendMailHelper({ to, subject, html }) {
  const SiteSetting = require('../models/SiteSetting');
  const settings = await SiteSetting.getAll();
  const fromEmail = settings.email_from || 'AIESEC Alumni <onboarding@resend.dev>';

  // 1. Önce SMTP (Nodemailer) kurulu mu kontrol et
  if (transporter) {
    try {
      // E-posta göndericisini parse et ("İsim <email@domain.com>" formatı için)
      let fromAddress = fromEmail;
      if (fromEmail.includes('<') && fromEmail.includes('>')) {
        fromAddress = fromEmail;
      } else {
        fromAddress = `AIESEC Alumni <${fromEmail}>`;
      }

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

  // 2. SMTP yoksa veya hata verdiyse Resend kullan
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
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #037ef3;">Merhaba ${name},</h2>
      <p>AIESEC İstanbul Alumni Archive sistemine yaptığınız kayıt başarıyla onaylanmıştır!</p>
      <p>Artık sisteme giriş yapabilir, geçmiş dönem (EB) takımlarını detaylıca inceleyebilir, diğer mezunların bilgilerine "Alumni Rehberi" üzerinden erişebilir ve kendi profil bilgilerinizi (fotoğraf, iş yeri, sektör vb.) güncelleyebilirsiniz.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="https://aiesec-istanbul-archive.vercel.app/auth/login" style="background-color: #037ef3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sisteme Giriş Yap</a>
      </p>
      <p>Görüşmek üzere,<br><strong>AIESEC İstanbul</strong></p>
    </div>
  `;
  return await sendMailHelper({ to: email, subject: 'AIESEC İstanbul Alumni Archive - Hesabınız Onaylandı! 🎉', html });
}

/**
 * Şifre sıfırlama maili gönderir
 */
async function sendResetPasswordEmail(email, name, resetLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #037ef3;">Merhaba ${name},</h2>
      <p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
      <p>Aşağıdaki bağlantıya tıklayarak yeni şifrenizi belirleyebilirsiniz. Bu bağlantı güvenlik nedeniyle 1 saat geçerli kalacaktır:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #037ef3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Şifremi Sıfırla</a>
      </p>
      <p>Eğer bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
      <p>Görüşmek üzere,<br><strong>AIESEC İstanbul</strong></p>
    </div>
  `;
  return await sendMailHelper({ to: email, subject: 'AIESEC İstanbul Mezunlar Portalı - Şifre Sıfırlama Talebi 🔑', html });
}

/**
 * Kayıt bilgilendirme maili gönderir
 */
async function sendWelcomePendingEmail(email, name) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
      <h2 style="color: #037ef3;">Merhaba ${name},</h2>
      <p>AIESEC İstanbul Alumni Archive platformuna yaptığınız kayıt talebi başarıyla alınmıştır.</p>
      <p>Üyeliğinizin doğrulanması ve platformun güvenli kalması amacıyla başvurunuz admin ekibimiz tarafından incelemeye alınmıştır.</p>
      <p>Hesabınız onaylandığında giriş yapabilmeniz için size yeni bir onay e-postası göndereceğiz.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 0.9rem; color: #666;">Görüşmek üzere,<br><strong>AIESEC İstanbul</strong></p>
    </div>
  `;
  return await sendMailHelper({ to: email, subject: 'AIESEC İstanbul Mezunlar Portalı - Kayıt Talebiniz Alındı 📩', html });
}

module.exports = {
  sendApprovalEmail,
  sendResetPasswordEmail,
  sendWelcomePendingEmail,
  sendMailHelper,
};
