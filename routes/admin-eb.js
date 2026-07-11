const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');
const EBMember = require('../models/EBMember');
const upload = require('../middleware/upload');
const { uploadToBlob } = require('../utils/blob');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

router.use(isLoggedIn, isAdmin);

// GET /admin/eb - EB Takımları Listesi
router.get('/', async (req, res) => {
  try {
    const teams = await EBTeam.findAll();
    res.render('admin/eb-list', {
      title: 'EB Yönetimi - Admin',
      teams,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'EB takımları yüklenirken hata oluştu.');
    res.redirect('/admin');
  }
});

// GET /admin/eb/:id/edit - EB Takımı Düzenleme Formu
router.get('/:id/edit', async (req, res) => {
  try {
    const team = await EBTeam.findById(req.params.id);
    if (!team) {
      req.flash('error', 'Takım bulunamadı.');
      return res.redirect('/admin/eb');
    }
    res.render('admin/eb-edit', {
      title: `${team.year} EB Düzenle - Admin`,
      team,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Sayfa yüklenirken hata oluştu.');
    res.redirect('/admin/eb');
  }
});

// POST /admin/eb/:id/edit - EB Takımı Güncelleme (Başarılar)
router.post('/:id/edit', async (req, res) => {
  try {
    const { year, title, description, achievements } = req.body;
    
    // Split achievements by newline and clean up
    let achievementsArray = [];
    if (achievements) {
      achievementsArray = achievements.split('\n').map(a => a.trim()).filter(a => a.length > 0);
    }

    await EBTeam.update(req.params.id, {
      year: year.trim(),
      title: title.trim(),
      description: description.trim(),
      achievements: achievementsArray
    });

    req.flash('success', 'EB Takımı güncellendi.');
    res.redirect(`/admin/eb/${req.params.id}/edit`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Güncelleme sırasında hata oluştu.');
    res.redirect(`/admin/eb/${req.params.id}/edit`);
  }
});

// POST /admin/eb/:id/gallery - Galeriye Fotoğraf Yükleme
router.post('/:id/gallery', upload.array('photos', 5), async (req, res) => {
  try {
    const team = await EBTeam.findById(req.params.id);
    if (!team) return res.redirect('/admin/eb');

    if (!req.files || req.files.length === 0) {
      req.flash('error', 'Lütfen fotoğraf seçin.');
      return res.redirect(`/admin/eb/${req.params.id}/edit`);
    }

    const uploadedUrls = [];
    for (const file of req.files) {
      const url = await uploadToBlob(file.buffer, file.originalname, `gallery/${team.year}/`);
      uploadedUrls.push(url);
    }

    const currentGallery = team.gallery_images || [];
    const newGallery = [...currentGallery, ...uploadedUrls];

    await EBTeam.update(team.id, { gallery_images: newGallery });

    req.flash('success', `${uploadedUrls.length} fotoğraf galeriye eklendi.`);
    res.redirect(`/admin/eb/${req.params.id}/edit`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Fotoğraf yüklenirken hata oluştu.');
    res.redirect(`/admin/eb/${req.params.id}/edit`);
  }
});

module.exports = router;
