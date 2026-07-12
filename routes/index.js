const express = require('express');
const router = express.Router();
const { getSQL } = require('../config/database');
const EBTeam = require('../models/EBTeam');

// GET / - Ana sayfa
router.get('/', async (req, res) => {
  try {
    const sql = getSQL();

    const teamMetas = await EBTeam.findAll();
    const activeTeams = teamMetas.slice(0, 6);

    const teams = await Promise.all(activeTeams.map(async (team) => {
      const countRes = await sql`
        SELECT COUNT(*)::integer AS count
        FROM users,
             LATERAL jsonb_array_elements(
               CASE WHEN roles_history IS NULL OR roles_history = 'null'::jsonb THEN '[]'::jsonb ELSE roles_history END
             ) AS role_entry
        WHERE status = 'approved'
          AND role_entry->>'year' = ${team.year}
      `;
      return {
        year: team.year,
        member_count: countRes[0]?.count || 0,
        title: team.title,
        description: team.description,
        cover_image: team.cover_image || '/images/default-cover.jpg',
      };
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
