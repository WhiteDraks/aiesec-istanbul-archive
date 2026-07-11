const express = require('express');
const router = express.Router();
const { getSQL } = require('../config/database');
const EBTeam = require('../models/EBTeam');

// GET / - Ana sayfa
router.get('/', async (req, res) => {
  try {
    const sql = getSQL();

    // Get recent EB periods from users' roles_history (same logic as routes/eb.js)
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
      LIMIT 6
    `;

    // Merge with admin metadata
    const teamMetas = await EBTeam.findAll();
    const metaByYear = {};
    teamMetas.forEach(t => { metaByYear[t.year] = t; });

    const teams = yearRows.map(row => ({
      year: row.year,
      member_count: parseInt(row.member_count, 10),
      title: metaByYear[row.year]?.title || `${row.year} Executive Board`,
      description: metaByYear[row.year]?.description || null,
      cover_image: metaByYear[row.year]?.cover_image || '/images/default-cover.jpg',
    }));

    res.render('index', {
      title: 'AIESEC İstanbul Alumni Archive',
      teams,
    });
  } catch (err) {
    console.error(err);
    res.render('index', {
      title: 'AIESEC İstanbul Alumni Archive',
      teams: [],
    });
  }
});

module.exports = router;
