const { getSQL } = require('../config/database');

const EBTeam = {
  async findAll() {
    const sql = getSQL();
    const { rows } = await sql`
      SELECT * FROM eb_teams ORDER BY sort_order DESC, created_at DESC
    `;
    return rows;
  },

  async findBySlug(slug) {
    const sql = getSQL();
    const { rows } = await sql`
      SELECT * FROM eb_teams WHERE slug = ${slug} LIMIT 1
    `;
    return rows[0] || null;
  },

  async findLatest(limit = 6) {
    const sql = getSQL();
    const { rows } = await sql`
      SELECT * FROM eb_teams ORDER BY sort_order DESC, created_at DESC LIMIT ${limit}
    `;
    return rows;
  },

  async create({ year, title, slug, description, coverImage, isPublic, achievements, order }) {
    const sql = getSQL();
    const { rows } = await sql`
      INSERT INTO eb_teams (year, title, slug, description, cover_image, is_public, achievements, sort_order)
      VALUES (${year}, ${title}, ${slug || year.replace(/\s+/g, '-').toLowerCase()},
              ${description || ''}, ${coverImage || '/images/default-cover.jpg'},
              ${isPublic || false}, ${achievements || []}, ${order || 0})
      RETURNING *
    `;
    return rows[0];
  },
};

module.exports = EBTeam;
