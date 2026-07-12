const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');
const EBMember = require('../models/EBMember');
const upload = require('../middleware/upload');
const { uploadToBlob } = require('../utils/blob');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { getSQL } = require('../config/database');

router.use(isLoggedIn, isAdmin);

// GET /admin/eb - EB Takımları Listesi
// Dönemler users.roles_history'den türetilir (bkz. routes/eb.js); eb_teams
// tablosu sadece admin bir dönemi zenginleştirdiyse (açıklama/başarı/galeri) satır içerir.
router.get('/', async (req, res) => {
  try {
    const sql = getSQL();
    const yearRows = await sql`
      SELECT DISTINCT (role_entry->>'year') AS year, COUNT(*) AS member_count
      FROM users,
           LATERAL jsonb_array_elements(
             CASE WHEN roles_history IS NULL OR roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE roles_history END
           ) AS role_entry
      WHERE status = 'approved'
        AND (role_entry->>'year') IS NOT NULL
        AND (role_entry->>'year') <> ''
      GROUP BY (role_entry->>'year')
      ORDER BY (role_entry->>'year') DESC
    `;

    const teamMetas = await EBTeam.findAll();
    const metaByYear = {};
    teamMetas.forEach(t => { metaByYear[t.year] = t; });

    const teams = yearRows.map(row => ({
      year: row.year,
      member_count: parseInt(row.member_count, 10),
      meta: metaByYear[row.year] || null,
    }));

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

// GET /admin/eb/year/:year/edit - Dönem için eb_teams satırı yoksa oluşturup düzenleme formuna yönlendirir
router.get('/year/:year/edit', async (req, res) => {
  try {
    const team = await EBTeam.findOrCreateByYear(req.params.year);
    res.redirect(`/admin/eb/${team.id}/edit`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Dönem oluşturulurken hata oluştu.');
    res.redirect('/admin/eb');
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

// POST /admin/eb/year/:year/delete - EB Dönemini Sil
router.post('/year/:year/delete', async (req, res) => {
  try {
    const { year } = req.params;
    const sql = getSQL();

    // 1. Delete eb_teams metadata
    await sql`DELETE FROM eb_teams WHERE year = ${year}`;

    // 2. Remove this year from all users' roles_history
    await sql`
      UPDATE users
      SET roles_history = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE WHEN roles_history IS NULL OR roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE roles_history END
        ) AS elem
        WHERE elem->>'year' <> ${year}
      )
      WHERE EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN roles_history IS NULL OR roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE roles_history END
        ) AS elem
        WHERE elem->>'year' = ${year}
      )
    `;

    // 3. Clear memories if they are year-bound
    await sql`DELETE FROM eb_memories WHERE team_year = ${year}`;

    req.flash('success', `${year} EB takımı ve bu döneme ait kayıtlar başarıyla silindi.`);
  } catch (err) {
    console.error('Failed to delete EB team:', err);
    req.flash('error', 'Dönem silinirken bir hata oluştu.');
  }
  res.redirect('/admin/eb');
});

module.exports = router;
