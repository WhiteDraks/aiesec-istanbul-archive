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
    const { name, school, department, eb_year, linkedin, workplaces, sector, phone, aiesec_journey } = req.body;
    let photoUrl = null;

    // Fotoğraf yüklendiyse Vercel Blob'a gönder
    if (req.file) {
      photoUrl = await uploadToBlob(req.file.buffer, req.file.originalname, 'avatars/');
    }

    // Profil güncelleme objesi
    const updateData = {
      name: name?.trim(),
      school: school?.trim(),
      department: department?.trim(),
      eb_year: eb_year?.trim(),
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

module.exports = router;
