const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const { SITE_URL } = require('../utils/escape');
const { str, isSafeLocalPath, cleanYear } = require('../utils/security');
const { stripTags } = require('../utils/sanitize');
const { revokeUserSessions } = require('../utils/sessions');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
// Kullanıcı bulunamadığında da bcrypt çalıştırılır; böylece yanıt süresinden e-posta kaydı sızmaz
const DUMMY_HASH = '$2a$12$/bRFwWmKmNp4CmrCBcyMReWpeVmb.E48CwirI63RpiR6jh0Uw.kHK';
const MAX_PASSWORD = 128;

// GET /auth/register - Kayıt formu
router.get('/register', async (req, res) => {
  if (req.session.userId) return res.redirect('/');
  try {
    const EBTeam = require('../models/EBTeam');
    const dbTeams = await EBTeam.findAll();
    res.render('auth/register', {
      title: 'Kayıt Ol - AIESEC İstanbul',
      formData: {},
      dbTeams
    });
  } catch (err) {
    console.error(err);
    res.render('auth/register', {
      title: 'Kayıt Ol - AIESEC İstanbul',
      formData: {},
      dbTeams: []
    });
  }
});

// POST /auth/register - Kayıt işlemi
router.post('/register', async (req, res) => {
  if (req.session.userId) return res.redirect('/');

  let { name, email, password, passwordConfirm, school, ebYear, ebRole, kvkk } = req.body;
  name = str(name, 100); email = str(email, 254).toLowerCase(); school = str(school, 150);
  ebYear = cleanYear(ebYear); ebRole = str(ebRole, 100);
  password = typeof password === 'string' ? password : '';
  passwordConfirm = typeof passwordConfirm === 'string' ? passwordConfirm : '';

  // Validation
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Ad Soyad en az 2 karakter olmalıdır.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Geçerli bir e-posta adresi giriniz.');
  if (!password || password.length < 8) errors.push('Şifre en az 8 karakter olmalıdır.');
  if (password.length > MAX_PASSWORD) errors.push('Şifre en fazla 128 karakter olabilir.');
  if (password !== passwordConfirm) errors.push('Şifreler eşleşmiyor.');
  if (!kvkk) errors.push('KVKK Aydınlatma Metnini onaylamanız gerekmektedir.');

  if (errors.length > 0) {
    try {
      const EBTeam = require('../models/EBTeam');
      const dbTeams = await EBTeam.findAll();
      return res.render('auth/register', {
        title: 'Kayıt Ol - AIESEC İstanbul',
        errors,
        formData: { name, email, school, ebYear, ebRole },
        dbTeams
      });
    } catch (e) {
      return res.render('auth/register', {
        title: 'Kayıt Ol - AIESEC İstanbul',
        errors,
        formData: { name, email, school, ebYear, ebRole },
        dbTeams: []
      });
    }
  }

  try {
    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      // Hesabın var olduğunu ifşa etmemek için yeni kayıtla aynı yanıtı ver (kayıt oluşturma/e-posta yok)
      req.flash('success', 'Kaydınız başarıyla alındı! Admin onayı bekleniyor. Onay sonrası giriş yapabilirsiniz.');
      return res.redirect('/auth/login');
    }

    await User.create({
      name: stripTags(name),
      email,
      password,
      school: stripTags(school),
      eb_year: stripTags(ebYear),
      eb_role: stripTags(ebRole),
      status: 'pending',
      role: 'user',
    });

    // Auto-create EB Team page for the registered year if format matches YYYY-YYYY
    if (ebYear && /^\d{4}-\d{4}$/.test(ebYear.trim())) {
      try {
        const EBTeam = require('../models/EBTeam');
        await EBTeam.findOrCreateByYear(ebYear.trim());
      } catch (err) {
        console.error(`Failed to auto-create EB team for registration year ${ebYear}:`, err);
      }
    }

    // Kullanıcıya kayıt bilgilendirme/bekleme maili gönder ve yöneticiye bildirim yap
    try {
      const { sendWelcomePendingEmail, sendAdminNotificationEmail } = require('../utils/email');
      await Promise.all([
        sendWelcomePendingEmail(email, name),
        sendAdminNotificationEmail(name, email)
      ]);
    } catch (mailErr) {
      console.error('Registration notification emails failed to send:', mailErr);
    }

    req.flash('success', 'Kaydınız başarıyla alındı! Admin onayı bekleniyor. Onay sonrası giriş yapabilirsiniz.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Kayıt hatası:', err);
    try {
      const EBTeam = require('../models/EBTeam');
      const dbTeams = await EBTeam.findAll();
      res.render('auth/register', {
        title: 'Kayıt Ol - AIESEC İstanbul',
        errors: ['Bir hata oluştu. Lütfen tekrar deneyin.'],
        formData: { name, email, school, ebYear, ebRole },
        dbTeams
      });
    } catch (e) {
      res.render('auth/register', {
        title: 'Kayıt Ol - AIESEC İstanbul',
        errors: ['Bir hata oluştu. Lütfen tekrar deneyin.'],
        formData: { name, email, school, ebYear, ebRole },
        dbTeams: []
      });
    }
  }
});

// GET /auth/login - Giriş formu
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/login', {
    title: 'Giriş Yap - AIESEC İstanbul',
  });
});

// POST /auth/login - Giriş işlemi
router.post('/login', async (req, res) => {
  if (req.session.userId) return res.redirect('/');

  const email = str(req.body.email, 254);
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password || password.length > MAX_PASSWORD) {
    req.flash('error', 'E-posta ve şifre gereklidir.');
    return res.redirect('/auth/login');
  }

  try {
    // Find user
    const user = await User.findByEmail(email);

    const isMatch = await User.comparePassword(password, user ? user.password : DUMMY_HASH);
    if (!user || !isMatch) {
      req.flash('error', 'E-posta veya şifre hatalı.');
      return res.redirect('/auth/login');
    }

    // Redirect to originally requested page or home
    // Open Redirect koruması: sadece göreceli (relative) URL'lere izin ver
    const rawRedirect = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    const safeRedirect = isSafeLocalPath(rawRedirect) ? rawRedirect : '/';

    // Session Fixation koruması: giriş sonrası yeni session ID üret
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Session regenerate hatası:', regenErr);
        return res.redirect('/');
      }
      req.session.userId = user.id;
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      };
      req.flash('success', `Hoş geldin, ${user.name}!`);
      res.redirect(safeRedirect);
    });
  } catch (err) {
    console.error('Giriş hatası:', err);
    req.flash('error', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    res.redirect('/auth/login');
  }
});

// GET /auth/forgot-password - Şifremi unuttum sayfası
router.get('/forgot-password', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/forgot-password', {
    title: 'Şifremi Unuttum - AIESEC İstanbul'
  });
});

// POST /auth/forgot-password - Şifre sıfırlama talebi
router.post('/forgot-password', async (req, res) => {
  try {
    const email = str(req.body.email, 254);
    if (!email) {
      req.flash('error', 'Lütfen e-posta adresinizi girin.');
      return res.redirect('/auth/forgot-password');
    }
    // Hesap var/yok bilgisini sızdırmamak için her durumda aynı mesaj gösterilir
    const genericMsg = 'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderilmiştir.';

    const user = await User.findByEmail(email);
    if (!user) {
      // Güvenlik amacıyla e-posta bulunmasa bile başarılıymış gibi genel mesaj verilir
      req.flash('success', genericMsg);
      return res.redirect('/auth/forgot-password');
    }

    // Generate crypto token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 saat geçerli

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    await sql`
      UPDATE users
      SET reset_token = ${sha256(token)}, reset_token_expires = ${expires}
      WHERE id = ${user.id}
    `;

    // Send email
    const { sendResetPasswordEmail } = require('../utils/email');
    const resetLink = `${SITE_URL}/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendResetPasswordEmail(user.email, user.name, resetLink);

    req.flash('success', genericMsg);
    res.redirect('/auth/forgot-password');
  } catch (err) {
    console.error('Forgot password error:', err);
    // Hata durumunda da aynı mesaj: e-postanın kayıtlı olup olmadığı anlaşılmasın
    req.flash('success', 'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderilmiştir.');
    res.redirect('/auth/forgot-password');
  }
});

// GET /auth/reset-password - Şifre sıfırlama formu
router.get('/reset-password', async (req, res) => {
  try {
    const token = str(req.query.token, 200);
    const email = str(req.query.email, 254);
    if (!token || !email) {
      req.flash('error', 'Geçersiz şifre sıfırlama talebi.');
      return res.redirect('/auth/login');
    }

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    const rows = await sql`
      SELECT id FROM users
      WHERE email = ${email.toLowerCase().trim()}
        AND reset_token = ${sha256(token)}
        AND reset_token_expires > NOW()
    `;

    if (rows.length === 0) {
      req.flash('error', 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
      return res.redirect('/auth/login');
    }

    res.render('auth/reset-password', {
      title: 'Şifre Sıfırla - AIESEC İstanbul',
      token,
      email
    });
  } catch (err) {
    console.error('Reset password get error:', err);
    req.flash('error', 'Sistemsel bir hata oluştu.');
    res.redirect('/auth/login');
  }
});

// POST /auth/reset-password - Yeni şifre kaydetme
router.post('/reset-password', async (req, res) => {
  try {
    const token = str(req.body.token, 200);
    const email = str(req.body.email, 254);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const passwordConfirm = typeof req.body.passwordConfirm === 'string' ? req.body.passwordConfirm : '';

    if (!token || !email || !password || !passwordConfirm) {
      req.flash('error', 'Lütfen tüm alanları doldurun.');
      return res.redirect('/auth/login');
    }
    const back = `/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    if (password !== passwordConfirm) {
      req.flash('error', 'Şifreler eşleşmiyor.');
      return res.redirect(back);
    }

    if (password.length < 8 || password.length > MAX_PASSWORD) {
      req.flash('error', 'Şifre 8-128 karakter arasında olmalıdır.');
      return res.redirect(back);
    }

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    const rows = await sql`
      SELECT id FROM users
      WHERE email = ${email.toLowerCase().trim()}
        AND reset_token = ${sha256(token)}
        AND reset_token_expires > NOW()
    `;

    if (rows.length === 0) {
      req.flash('error', 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.');
      return res.redirect('/auth/login');
    }

    const userId = rows[0].id;
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await sql`
      UPDATE users
      SET password = ${hashedPassword},
          reset_token = NULL,
          reset_token_expires = NULL
      WHERE id = ${userId}
    `;
    await revokeUserSessions(userId);

    req.flash('success', 'Şifreniz başarıyla güncellendi! Yeni şifrenizle giriş yapabilirsiniz.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Reset password post error:', err);
    req.flash('error', 'Şifre güncellenirken bir hata oluştu.');
    res.redirect('/auth/login');
  }
});

// POST /auth/logout - Çıkış (GET yerine POST — CSRF koruması için)
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy hatası:', err);
    res.redirect('/');
  });
});

// GET /auth/logout - Eski bağlantılar: oturumu KAPATMAZ (başka bir site <img src> ile zorla çıkış yaptıramasın)
router.get('/logout', (req, res) => res.redirect('/'));

module.exports = router;
