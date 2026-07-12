const express = require('express');
const router = express.Router();
const User = require('../models/User');
const upload = require('../middleware/upload');
const { uploadToBlob } = require('../utils/blob');
const { isLoggedIn } = require('../middleware/auth');

// Bütün profile rotaları için giriş yapılmış olması zorunlu
router.use(isLoggedIn);

// GET /profile - Profil görüntüleme/düzenleme formu
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.flash('error', 'Kullanıcı bulunamadı.');
      return res.redirect('/');
    }

    res.render('profile/index', {
      title: 'Profilim - AIESEC İstanbul',
      user,
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    req.flash('error', 'Profil yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

// POST /profile - Profili güncelleme
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const sanitizeHtml = require('sanitize-html');
    const { name, school, department, linkedin, workplaces, sector, phone, show_phone, aiesec_journey, role_years, role_titles, remove_photo, city, city_custom, country, country_custom, is_mentor, is_mentee, mentorship_details } = req.body;
    let photoUrl = null;

    // Fotoğraf temizlendiyse veya yüklendiyse
    if (remove_photo === 'true') {
      photoUrl = '/images/default-avatar.svg';
    } else if (req.file) {
      photoUrl = await uploadToBlob(req.file.buffer, req.file.originalname, 'avatars/');
    }

    // Rolleri JSON objesine dönüştür
    let roles_history = [];
    if (role_years && role_titles) {
      const years = Array.isArray(role_years) ? role_years : [role_years];
      const titles = Array.isArray(role_titles) ? role_titles : [role_titles];
      for (let i = 0; i < years.length; i++) {
        if (years[i].trim() || titles[i].trim()) {
          // XSS koruması: Rol başlığını temizle
          const cleanYear = sanitizeHtml(years[i].trim(), { allowedTags: [], allowedAttributes: {} });
          const cleanTitle = sanitizeHtml(titles[i].trim(), { allowedTags: [], allowedAttributes: {} });
          roles_history.push({ year: cleanYear, role: cleanTitle });
        }
      }
    }

    // Ana dönemi belirle (ilk eklenen rolü kabul edebiliriz)
    const eb_year = roles_history.length > 0 ? roles_history[0].year : null;

    // XSS Koruması: Tüm girdileri HTML etiketlerinden arındır (Düz Metin)
    const cleanString = (val) => {
      if (!val) return null;
      return sanitizeHtml(val.trim(), { allowedTags: [], allowedAttributes: {} });
    };

    // Profil güncelleme objesi
    const updateData = {
      name: cleanString(name) || 'Mezun',
      school: cleanString(school),
      department: cleanString(department),
      eb_year: eb_year, // geriye dönük uyumluluk
      roles_history,
      linkedin: cleanString(linkedin),
      workplaces: cleanString(workplaces),
      sector: cleanString(sector),
      phone: cleanString(phone),
      show_phone: show_phone === 'true', // gizlilik tercihi
      aiesec_journey: cleanString(aiesec_journey),
      photo: photoUrl,
      city: city === 'other' ? cleanString(city_custom) : cleanString(city),
      country: country === 'other' ? cleanString(country_custom) : cleanString(country),
      is_mentor: is_mentor === 'true',
      is_mentee: is_mentee === 'true',
      mentorship_details: cleanString(mentorship_details),
    };

    const updatedUser = await User.updateProfile(req.session.userId, updateData);

    // Session'daki ismi de güncelle (header'da vs gözüken)
    req.session.user.name = updatedUser.name;

    req.flash('success', 'Profiliniz başarıyla güncellendi.');
    res.redirect('/profile');
  } catch (err) {
    console.error('Profile update error:', err.message); // Hassas hata detaylarını logdan gizle
    req.flash('error', 'Profil güncellenirken bir hata oluştu.');
    res.redirect('/profile');
  }
});

// POST /profile/change-password - Şifre Değiştirme
router.post('/change-password', async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    
    if (!current_password || !new_password || !confirm_password) {
      req.flash('error', 'Lütfen tüm şifre alanlarını doldurun.');
      return res.redirect('/profile');
    }

    if (new_password !== confirm_password) {
      req.flash('error', 'Yeni şifreler eşleşmiyor.');
      return res.redirect('/profile');
    }

    if (new_password.length < 6) {
      req.flash('error', 'Yeni şifre en az 6 karakter olmalıdır.');
      return res.redirect('/profile');
    }

    const user = await User.findByEmail(req.session.user.email);
    if (!user) {
      req.flash('error', 'Kullanıcı bulunamadı.');
      return res.redirect('/profile');
    }

    const isMatch = await User.comparePassword(current_password, user.password);
    if (!isMatch) {
      req.flash('error', 'Mevcut şifreniz yanlış.');
      return res.redirect('/profile');
    }

    // Hash and update password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    const { getSQL } = require('../config/database');
    const sql = getSQL();
    await sql`UPDATE users SET password = ${hashedPassword} WHERE id = ${user.id}`;

    req.flash('success', 'Şifreniz başarıyla güncellendi.');
    res.redirect('/profile');
  } catch (err) {
    console.error('Password change error:', err);
    req.flash('error', 'Şifre değiştirilirken bir hata oluştu.');
    res.redirect('/profile');
  }
});

// POST /profile/delete - Kendi hesabını sil
router.post('/delete', async (req, res) => {
  try {
    await User.delete(req.session.userId);
    req.session.destroy((err) => {
      if (err) console.error('Session destroy hatası:', err);
      res.redirect('/');
    });
  } catch (err) {
    console.error('Hesap silme hatası:', err);
    req.flash('error', 'Hesabınız silinirken bir hata oluştu.');
    res.redirect('/profile');
  }
});

module.exports = router;
