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

// GET /sitemap.xml - Dynamic XML sitemap for search engines
router.get('/sitemap.xml', async (req, res) => {
  try {
    const domain = 'https://aiesec-istanbul-archive.vercel.app';
    const staticPages = [
      '',
      '/eb',
      '/alumni',
      '/feedback',
      '/auth/login',
      '/auth/register'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Add static pages
    const today = new Date().toISOString().split('T')[0];
    staticPages.forEach(page => {
      xml += `  <url>\n`;
      xml += `    <loc>${domain}${page}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 2. Fetch all EB team years and add dynamic URLs
    const teamMetas = await EBTeam.findAll();
    teamMetas.forEach(team => {
      xml += `  <url>\n`;
      xml += `    <loc>${domain}/eb/${encodeURIComponent(team.year)}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap generation failed:', err);
    res.status(500).end();
  }
});

module.exports = router;
