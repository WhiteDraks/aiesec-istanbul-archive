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

  const { name, email, password, passwordConfirm, school, ebYear } = req.body;

  // Validation
  const errors = [];
  if (!name || name.trim().length < 2) errors.push('Ad Soyad en az 2 karakter olmalıdır.');
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.push('Geçerli bir e-posta adresi giriniz.');
  if (!password || password.length < 6) errors.push('Şifre en az 6 karakter olmalıdır.');
  if (password !== passwordConfirm) errors.push('Şifreler eşleşmiyor.');

  if (errors.length > 0) {
    return res.render('auth/register', {
      title: 'Kayıt Ol - AIESEC İstanbul',
      errors,
      formData: { name, email, school, ebYear },
    });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Kayıt Ol - AIESEC İstanbul',
        errors: ['Bu e-posta adresi zaten kayıtlıdır.'],
        formData: { name, email, school, ebYear },
      });
    }

    await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      school: school ? school.trim() : '',
      eb_year: ebYear ? ebYear.trim() : '',
      status: 'pending',
      role: 'user',
    });

    req.flash('success', 'Kaydınız başarıyla alındı! Admin onayı bekleniyor. Onay sonrası giriş yapabilirsiniz.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Kayıt hatası:', err);
    res.render('auth/register', {
      title: 'Kayıt Ol - AIESEC İstanbul',
      errors: ['Bir hata oluştu. Lütfen tekrar deneyin.'],
      formData: { name, email, school, ebYear },
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

    // Store user info in session (exclude password)
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    req.flash('success', `Hoş geldin, ${user.name}!`);

    // Redirect to originally requested page or home
    const redirectTo = req.session.redirectTo || '/';
    delete req.session.redirectTo;
    res.redirect(redirectTo);
  } catch (err) {
    console.error('Giriş hatası:', err);
    req.flash('error', 'Bir hata oluştu. Lütfen tekrar deneyin.');
    res.redirect('/auth/login');
  }
});

// GET /auth/logout - Çıkış
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy hatası:', err);
    res.redirect('/');
  });
});

module.exports = router;
