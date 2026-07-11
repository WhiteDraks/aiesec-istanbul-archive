const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');
const Memory = require('../models/Memory');
const upload = require('../middleware/upload');
const { uploadToBlob } = require('../utils/blob');
const { getSQL } = require('../config/database');
const { isLoggedIn, isApproved } = require('../middleware/auth');

/**
 * GET /eb
 * Lists all EB periods derived from users' roles_history.
 * Admin can optionally enrich a period with description/achievements/gallery via /admin/eb.
 * Everyone can see the list, but details require login + approval.
 */
router.get('/', async (req, res) => {
  try {
    const sql = getSQL();

    // Get all unique years that at least one approved user has listed in roles_history
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

    // Get any admin-created team metadata (description, achievements, gallery)
    const teamMetas = await EBTeam.findAll();
    const metaByYear = {};
    teamMetas.forEach(t => { metaByYear[t.year] = t; });

    // Merge: periods from user data, enriched with admin metadata where available
    const periods = yearRows.map(row => ({
      year: row.year,
      member_count: parseInt(row.member_count, 10),
      meta: metaByYear[row.year] || null,
      title: metaByYear[row.year]?.title || `${row.year} Executive Board`,
      description: metaByYear[row.year]?.description || null,
      cover_image: metaByYear[row.year]?.cover_image || '/images/default-cover.jpg',
    }));

    res.render('eb/index', {
      title: 'EB Takımları - AIESEC İstanbul',
      teams: periods,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'EB takımları yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

/**
 * GET /eb/:year
 * Shows all approved users who listed this year in their roles_history.
 * Also shows memories uploaded by approved members.
 * Requires login + approval.
 */
router.get('/:year', isLoggedIn, isApproved, async (req, res) => {
  try {
    const sql = getSQL();
    const year = req.params.year;

    // Find all approved users that have this year in their roles_history
    const members = await sql`
      SELECT
        u.id,
        u.name,
        u.photo,
        u.department,
        u.school,
        u.email,
        u.linkedin,
        u.sector,
        u.aiesec_journey,
        u.roles_history,
        -- Extract the specific role for this year
        (
          SELECT role_entry->>'role'
          FROM jsonb_array_elements(
            CASE WHEN u.roles_history IS NULL OR u.roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE u.roles_history END
          ) AS role_entry
          WHERE role_entry->>'year' = ${year}
          LIMIT 1
        ) AS current_role
      FROM users u
      WHERE u.status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE WHEN u.roles_history IS NULL OR u.roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE u.roles_history END
          ) AS role_entry
          WHERE role_entry->>'year' = ${year}
        )
      ORDER BY u.name ASC
    `;

    // Get admin-provided metadata for this period (if any)
    const teamMetas = await EBTeam.findAll();
    const meta = teamMetas.find(t => t.year === year) || null;

    // Get memories for this period
    const memories = await Memory.findByYear(year);

    const team = {
      year,
      title: meta?.title || `${year} Executive Board`,
      description: meta?.description || null,
      cover_image: meta?.cover_image || '/images/default-cover.jpg',
      group_photo: meta?.group_photo || null,
      achievements: meta?.achievements || [],
      gallery_images: meta?.gallery_images || [],
      id: meta?.id || null,
    };

    if (members.length === 0 && !meta) {
      req.flash('error', 'Bu döneme ait veri bulunamadı.');
      return res.redirect('/eb');
    }

    const canEditTeam = req.session.user && (
      req.session.user.role === 'admin' ||
      members.some(m => m.id === req.session.userId)
    );

    res.render('eb/detail', {
      title: `${team.title} - AIESEC İstanbul`,
      team,
      members,
      memories,
      canEditTeam,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Sayfa yüklenirken bir hata oluştu.');
    res.redirect('/eb');
  }
});

/**
 * POST /eb/:year/memories
 * Uploads a memory photo for the given EB year.
 * Requires login + approval.
 */
router.post('/:year/memories', isLoggedIn, isApproved, upload.single('photo'), async (req, res) => {
  try {
    const { year } = req.params;
    const { caption } = req.body;

    if (!req.file) {
      req.flash('error', 'Lütfen bir fotoğraf seçin.');
      return res.redirect(`/eb/${encodeURIComponent(year)}`);
    }

    // Upload to Vercel Blob
    const photoUrl = await uploadToBlob(req.file.buffer, req.file.originalname, `memories/${year}/`);

    // Create memory entry
    await Memory.create({
      team_year: year,
      user_id: req.session.userId,
      photo_url: photoUrl,
      caption: caption ? caption.trim() : '',
    });

    req.flash('success', 'Anınız başarıyla eklendi!');
    res.redirect(`/eb/${encodeURIComponent(year)}`);
  } catch (err) {
    console.error('Failed to upload memory:', err);
    req.flash('error', 'Anı eklenirken bir hata oluştu.');
    res.redirect(`/eb/${encodeURIComponent(req.params.year)}`);
  }
});

/**
 * POST /eb/:year/memories/:id/delete
 * Deletes a memory. Only the owner or an admin can delete.
 */
router.post('/:year/memories/:id/delete', isLoggedIn, isApproved, async (req, res) => {
  try {
    const { year, id } = req.params;
    const is_admin = req.session.user?.role === 'admin';

    await Memory.delete(id, req.session.userId, is_admin);

    req.flash('success', 'Anı başarıyla silindi.');
    res.redirect(`/eb/${encodeURIComponent(year)}`);
  } catch (err) {
    console.error('Failed to delete memory:', err);
    req.flash('error', 'Anı silinirken bir hata oluştu.');
    res.redirect(`/eb/${encodeURIComponent(req.params.year)}`);
  }
});

/**
 * POST /eb/:year/achievements
 * Updates the achievements for a specific EB period.
 * Only the period's EB team members or admin can perform this action.
 */
router.post('/:year/achievements', isLoggedIn, isApproved, async (req, res) => {
  try {
    const { year } = req.params;
    const { achievements } = req.body;

    // Check if user is member of this EB year
    const sql = getSQL();
    const isMember = await sql`
      SELECT 1 FROM users
      WHERE id = ${req.session.userId}
        AND status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE WHEN roles_history IS NULL OR roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE roles_history END
          ) AS role_entry
          WHERE role_entry->>'year' = ${year}
        )
    `;

    const canEdit = req.session.user?.role === 'admin' || isMember.length > 0;

    if (!canEdit) {
      req.flash('error', 'Bu dönemin başarılarını düzenleme yetkiniz bulunmamaktadır.');
      return res.redirect(`/eb/${encodeURIComponent(year)}`);
    }

    // Clean up achievements list from text input
    let achievementsArray = [];
    if (achievements) {
      achievementsArray = achievements.split('\n').map(a => a.trim()).filter(a => a.length > 0);
    }

    // Find or create EBTeam meta entry
    const teamMeta = await EBTeam.findOrCreateByYear(year);
    await EBTeam.update(teamMeta.id, { achievements: achievementsArray });

    req.flash('success', 'Dönem başarıları başarıyla güncellendi.');
    res.redirect(`/eb/${encodeURIComponent(year)}`);
  } catch (err) {
    console.error('Failed to update achievements:', err);
    req.flash('error', 'Başarılar güncellenirken bir hata oluştu.');
    res.redirect(`/eb/${encodeURIComponent(req.params.year)}`);
  }
});

/**
 * POST /eb/:year/cover
 * Uploads a banner cover image for the EB period.
 * Only the period's EB team members or admin can upload.
 */
router.post('/:year/cover', isLoggedIn, isApproved, upload.single('cover_image'), async (req, res) => {
  try {
    const { year } = req.params;

    if (!req.file) {
      req.flash('error', 'Lütfen bir görsel seçin.');
      return res.redirect(`/eb/${encodeURIComponent(year)}`);
    }

    // Check authorization (admin or team member)
    const sql = getSQL();
    const isMember = await sql`
      SELECT 1 FROM users
      WHERE id = ${req.session.userId}
        AND status = 'approved'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE WHEN roles_history IS NULL OR roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE roles_history END
          ) AS role_entry
          WHERE role_entry->>'year' = ${year}
        )
    `;

    const canEdit = req.session.user?.role === 'admin' || isMember.length > 0;
    if (!canEdit) {
      req.flash('error', 'Bu dönemin kapak görselini değiştirme yetkiniz bulunmamaktadır.');
      return res.redirect(`/eb/${encodeURIComponent(year)}`);
    }

    // Upload cover to Vercel Blob
    const coverUrl = await uploadToBlob(req.file.buffer, req.file.originalname, `eb-covers/${year}/`);

    // Find or create EBTeam meta record and update cover_image
    const teamMeta = await EBTeam.findOrCreateByYear(year);
    await EBTeam.update(teamMeta.id, { cover_image: coverUrl });

    req.flash('success', 'Dönem kapak fotoğrafı başarıyla güncellendi!');
    res.redirect(`/eb/${encodeURIComponent(year)}`);
  } catch (err) {
    console.error('Failed to update EB cover image:', err);
    req.flash('error', 'Kapak fotoğrafı güncellenirken bir hata oluştu.');
    res.redirect(`/eb/${encodeURIComponent(req.params.year)}`);
  }
});

module.exports = router;
