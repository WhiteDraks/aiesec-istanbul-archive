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

  async findByYear(year) {
    const sql = getSQL();
    const rows = await sql`SELECT * FROM eb_teams WHERE year = ${year} LIMIT 1`;
    return rows[0] || null;
  },

  /**
   * EB dönemleri esasen users.roles_history'den türetiliyor; eb_teams satırı
   * sadece admin bir dönemi (açıklama/başarı/galeri) zenginleştirdiğinde var olur.
   * Admin bir döneme ilk kez girdiğinde satırı burada oluşturuyoruz.
   */
  async findOrCreateByYear(year) {
    const existing = await this.findByYear(year);
    if (existing) return existing;
    return this.create({ year, title: `${year} Executive Board` });
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
    // Use a single flat query - Neon driver does not support dynamic template composition
    const rows = await sql`
      UPDATE eb_teams
      SET
        year        = COALESCE(${year ?? null}, year),
        title       = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        is_public   = COALESCE(${isPublic ?? null}, is_public),
        achievements = COALESCE(${achievements ?? null}, achievements),
        sort_order  = COALESCE(${order ?? null}, sort_order),
        gallery_images = COALESCE(${gallery_images ?? null}, gallery_images)
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0];
  },
};

module.exports = EBTeam;
