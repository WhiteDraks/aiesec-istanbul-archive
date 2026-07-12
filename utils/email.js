const { Resend } = require('resend');

// Sadece ortam değişkeninde key varsa başlat
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * Onay maili gönderir
 * @param {string} email - Kullanıcı e-posta adresi
 * @param {string} name - Kullanıcı adı
 */
async function sendApprovalEmail(email, name) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY tanımlı değil. E-posta gönderimi atlandı.');
    return false;
  }

  try {
    const SiteSetting = require('../models/SiteSetting');
    const settings = await SiteSetting.getAll();
    const fromEmail = settings.email_from || 'AIESEC Alumni <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'AIESEC İstanbul Alumni Archive - Hesabınız Onaylandı! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #037ef3;">Merhaba ${name},</h2>
          <p>AIESEC İstanbul Alumni Archive sistemine yaptığınız kayıt başarıyla onaylanmıştır!</p>
          <p>Artık sisteme giriş yapabilir, geçmiş dönem (EB) takımlarını detaylıca inceleyebilir, diğer mezunların bilgilerine "Alumni Rehberi" üzerinden erişebilir ve kendi profil bilgilerinizi (fotoğraf, iş yeri, sektör vb.) güncelleyebilirsiniz.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="https://aiesec-istanbul-archive.vercel.app/auth/login" style="background-color: #037ef3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Sisteme Giriş Yap</a>
          </p>
          <p>Görüşmek üzere,<br><strong>AIESEC İstanbul</strong></p>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }

    console.log(`Onay maili gönderildi: ${email}`);
    return true;
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    return false;
  }
}

async function sendResetPasswordEmail(email, name, resetLink) {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY tanımlı değil. E-posta gönderimi atlandı.');
    return false;
  }

  try {
    const SiteSetting = require('../models/SiteSetting');
    const settings = await SiteSetting.getAll();
    const fromEmail = settings.email_from || 'AIESEC Alumni <onboarding@resend.dev>';

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: 'AIESEC İstanbul Mezunlar Portalı - Şifre Sıfırlama Talebi 🔑',
      html: `
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
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return false;
    }

    console.log(`Şifre sıfırlama maili gönderildi: ${email}`);
    return true;
  } catch (err) {
    console.error('Mail gönderim hatası:', err);
    return false;
  }
}

module.exports = {
  sendApprovalEmail,
  sendResetPasswordEmail,
};
