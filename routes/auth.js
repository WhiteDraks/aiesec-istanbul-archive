const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /auth/register - Kayıt formu
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('auth/register', {
    title: 'Kayıt Ol - AIESEC İstanbul',
    formData: {},
  });
});

// POST /auth/register - Kayıt işlemi
router.post('/register', async (req, res) => {
  if (req.session.userId) return res.redirect('/');

  const { name, email, password, passwordConfirm, school, ebYear, ebRole, kvkk } = req.body;

  // Validation
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Ad Soyad en az 2 karakter olmalıdır.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Geçerli bir e-posta adresi giriniz.');
  if (!password || password.length < 8) errors.push('Şifre en az 8 karakter olmalıdır.');
  if (password !== passwordConfirm) errors.push('Şifreler eşleşmiyor.');
  if (!kvkk) errors.push('KVKK Aydınlatma Metnini onaylamanız gerekmektedir.');

  if (errors.length > 0) {
    return res.render('auth/register', {
      title: 'Kayıt Ol - AIESEC İstanbul',
      errors,
      formData: { name, email, school, ebYear, ebRole },
    });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Kayıt Ol - AIESEC İstanbul',
        errors: ['Bu e-posta adresi zaten kayıtlıdır.'],
        formData: { name, email, school, ebYear, ebRole },
      });
    }

    await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      school: school ? school.trim() : '',
      eb_year: ebYear ? ebYear.trim() : '',
      eb_role: ebRole ? ebRole.trim() : '',
      status: 'pending',
      role: 'user',
    });

    // Kullanıcıya kayıt bilgilendirme/bekleme maili gönder
    try {
      const { sendWelcomePendingEmail } = require('../utils/email');
      await sendWelcomePendingEmail(email, name);
    } catch (mailErr) {
      console.error('Welcome pending email failed to send:', mailErr);
    }

    req.flash('success', 'Kaydınız başarıyla alındı! Admin onayı bekleniyor. Onay sonrası giriş yapabilirsiniz.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Kayıt hatası:', err);
    res.render('auth/register', {
      title: 'Kayıt Ol - AIESEC İstanbul',
      errors: ['Bir hata oluştu. Lütfen tekrar deneyin.'],
      formData: { name, email, school, ebYear, ebRole },
    });
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

  const { email, password } = req.body;

  if (!email || !password) {
    req.flash('error', 'E-posta ve şifre gereklidir.');
    return res.redirect('/auth/login');
  }

  try {
    // Find user
    const user = await User.findByEmail(email);

    if (!user) {
      req.flash('error', 'E-posta veya şifre hatalı.');
      return res.redirect('/auth/login');
    }

    const isMatch = await User.comparePassword(password, user.password);
    if (!isMatch) {
      req.flash('error', 'E-posta veya şifre hatalı.');
      return res.redirect('/auth/login');
    }

    // Redirect to originally requested page or home
    // Open Redirect koruması: sadece göreceli (relative) URL'lere izin ver
    const rawRedirect = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

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
    const { email } = req.body;
    if (!email) {
      req.flash('error', 'Lütfen e-posta adresinizi girin.');
      return res.redirect('/auth/forgot-password');
    }

    const user = await User.findByEmail(email);
    if (!user) {
      // Güvenlik amacıyla e-posta bulunmasa bile başarılıymış gibi genel mesaj verilir
      req.flash('success', 'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama bağlantısı gönderilmiştir.');
      return res.redirect('/auth/forgot-password');
    }

    // Generate crypto token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 saat geçerli

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    await sql`
      UPDATE users
      SET reset_token = ${token}, reset_token_expires = ${expires}
      WHERE id = ${user.id}
    `;

    // Send email
    const { sendResetPasswordEmail } = require('../utils/email');
    const resetLink = `https://aiesec-istanbul-archive.vercel.app/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;
    await sendResetPasswordEmail(user.email, user.name, resetLink);

    req.flash('success', 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.');
    res.redirect('/auth/forgot-password');
  } catch (err) {
    console.error('Forgot password error:', err);
    req.flash('error', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    res.redirect('/auth/forgot-password');
  }
});

// GET /auth/reset-password - Şifre sıfırlama formu
router.get('/reset-password', async (req, res) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) {
      req.flash('error', 'Geçersiz şifre sıfırlama talebi.');
      return res.redirect('/auth/login');
    }

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    const rows = await sql`
      SELECT id FROM users
      WHERE email = ${email.toLowerCase().trim()}
        AND reset_token = ${token}
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
    const { token, email, password, passwordConfirm } = req.body;
    
    if (!token || !email || !password || !passwordConfirm) {
      req.flash('error', 'Lütfen tüm alanları doldurun.');
      return res.redirect(`/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
    }

    if (password !== passwordConfirm) {
      req.flash('error', 'Şifreler eşleşmiyor.');
      return res.redirect(`/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
    }

    if (password.length < 6) {
      req.flash('error', 'Şifre en az 6 karakter olmalıdır.');
      return res.redirect(`/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`);
    }

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    const rows = await sql`
      SELECT id FROM users
      WHERE email = ${email.toLowerCase().trim()}
        AND reset_token = ${token}
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

// GET /auth/logout - Geriye dönük uyumluluk (eski linkleri yönlendir)
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy hatası:', err);
    res.redirect('/');
  });
});

module.exports = router;
