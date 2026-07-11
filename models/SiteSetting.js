const { getSQL } = require('../config/database');

let cachedSettings = null;

const SiteSetting = {
  async getAll() {
    if (cachedSettings) return cachedSettings;

    const sql = getSQL();
    const rows = await sql`SELECT key, value FROM site_settings`;
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    cachedSettings = settings;
    return settings;
  },

  async update(key, value) {
    const sql = getSQL();
    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    cachedSettings = null; // Clear cache
  }
};

module.exports = SiteSetting;
