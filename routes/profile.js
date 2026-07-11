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
    const { name, school, department, linkedin, workplaces, sector, phone, aiesec_journey, role_years, role_titles, remove_photo } = req.body;
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
          roles_history.push({ year: years[i].trim(), role: titles[i].trim() });
        }
      }
    }

    // Ana dönemi belirle (ilk eklenen rolü kabul edebiliriz)
    const eb_year = roles_history.length > 0 ? roles_history[0].year : null;

    // Profil güncelleme objesi
    const updateData = {
      name: name?.trim(),
      school: school?.trim(),
      department: department?.trim(),
      eb_year: eb_year, // geriye dönük uyumluluk
      roles_history,
      linkedin: linkedin?.trim(),
      workplaces: workplaces?.trim(),
      sector: sector?.trim(),
      phone: phone?.trim(),
      aiesec_journey: aiesec_journey?.trim(),
      photo: photoUrl,
    };

    const updatedUser = await User.updateProfile(req.session.userId, updateData);

    // Session'daki ismi de güncelle (header'da vs gözüken)
    req.session.user.name = updatedUser.name;

    req.flash('success', 'Profiliniz başarıyla güncellendi.');
    res.redirect('/profile');
  } catch (err) {
    console.error('Profile update error:', err);
    req.flash('error', 'Profil güncellenirken bir hata oluştu.');
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
