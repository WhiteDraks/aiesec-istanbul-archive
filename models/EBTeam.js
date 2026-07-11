const { getSQL } = require('../config/database');

const EBTeam = {
  async findAll() {
    const sql = getSQL();
    return await sql`
      SELECT * FROM eb_teams ORDER BY sort_order DESC, created_at DESC
    `;
  },

  async findBySlug(slug) {
    const sql = getSQL();
    const rows = await sql`
      SELECT * FROM eb_teams WHERE slug = ${slug} LIMIT 1
    `;
    return rows[0] || null;
  },

  async findLatest(limit = 6) {
    const sql = getSQL();
    return await sql`
      SELECT * FROM eb_teams ORDER BY sort_order DESC, created_at DESC LIMIT ${limit}
    `;
  },

  async findById(id) {
    const sql = getSQL();
    const rows = await sql`SELECT * FROM eb_teams WHERE id = ${id} LIMIT 1`;
    return rows[0] || null;
  },

  async create({ year, title, slug, description, coverImage, isPublic, achievements, order }) {
    const sql = getSQL();
    const rows = await sql`
      INSERT INTO eb_teams (year, title, slug, description, cover_image, is_public, achievements, sort_order)
      VALUES (
        ${year},
        ${title},
        ${slug || year.replace(/\s+/g, '-').toLowerCase()},
        ${description || null},
        ${coverImage || '/images/default-cover.jpg'},
        ${isPublic || false},
        ${achievements || []},
        ${order || 0}
      )
      RETURNING *
    `;
    return rows[0];
  },

  async update(id, { year, title, description, isPublic, achievements, order, gallery_images }) {
    const sql = getSQL();
    
    let query = sql`
      UPDATE eb_teams
      SET 
        year = COALESCE(${year}, year),
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        is_public = COALESCE(${isPublic}, is_public),
        achievements = COALESCE(${achievements}, achievements),
        sort_order = COALESCE(${order}, sort_order)
    `;

    if (gallery_images !== undefined) {
      query = sql`${query}, gallery_images = ${gallery_images}`;
    }

    query = sql`${query} WHERE id = ${id} RETURNING *`;
    
    const rows = await query;
    return rows[0];
  },
};

module.exports = EBTeam;
