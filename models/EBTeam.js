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

  async update(id, { year, title, description, isPublic, achievements, order, gallery_images, cover_image, group_photo }) {
    const sql = getSQL();
    const existing = await this.findById(id);
    if (!existing) return null;

    const finalYear = year !== undefined ? year : existing.year;
    const finalTitle = title !== undefined ? title : existing.title;
    const finalDescription = description !== undefined ? description : existing.description;
    const finalIsPublic = isPublic !== undefined ? isPublic : existing.is_public;
    const finalAchievements = achievements !== undefined ? achievements : existing.achievements;
    const finalOrder = order !== undefined ? order : existing.sort_order;
    const finalGalleryImages = gallery_images !== undefined ? gallery_images : existing.gallery_images;
    const finalCoverImage = cover_image !== undefined ? cover_image : existing.cover_image;
    const finalGroupPhoto = group_photo !== undefined ? group_photo : existing.group_photo;

    const rows = await sql`
      UPDATE eb_teams
      SET
        year           = ${finalYear},
        title          = ${finalTitle},
        description    = ${finalDescription},
        is_public      = ${finalIsPublic},
        achievements   = ${finalAchievements},
        sort_order     = ${finalOrder},
        gallery_images = ${finalGalleryImages},
        cover_image    = ${finalCoverImage},
        group_photo    = ${finalGroupPhoto}
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0];
  },
};

module.exports = EBTeam;
