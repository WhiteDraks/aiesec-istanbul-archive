const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');
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

    res.render('eb/detail', {
      title: `${team.title} - AIESEC İstanbul`,
      team,
      members,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Sayfa yüklenirken bir hata oluştu.');
    res.redirect('/eb');
  }
});

module.exports = router;
