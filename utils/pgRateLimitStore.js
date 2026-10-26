const { getSQL } = require('../config/database');

/**
 * express-rate-limit için Postgres tabanlı sayaç deposu.
 * Vercel gibi sunucusuz ortamlarda her örneğin kendi belleği olduğundan, bellek içi
 * sayaçlar saldırganın istekleri örnekler arasında dağıtmasıyla aşılabilir; sayaçları
 * ortak veritabanında tutmak limitleri gerçekten bağlayıcı yapar.
 * Veritabanı erişilemezse istekler engellenmez (fail-open) ve hata loglanır.
 */
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    const sql = getSQL();
    tableReady = sql`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key       TEXT PRIMARY KEY,
        hits      INTEGER     NOT NULL,
        reset_at  TIMESTAMPTZ NOT NULL
      )
    `.catch((err) => { tableReady = null; throw err; });
  }
  return tableReady;
}

class PgRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60 * 1000;
  }

  init(options) { this.windowMs = options.windowMs; }

  k(key) { return `${this.prefix}:${key}`; }

  async increment(key) {
    try {
      await ensureTable();
      const sql = getSQL();
      const seconds = Math.ceil(this.windowMs / 1000);
      const rows = await sql`
        INSERT INTO rate_limits (key, hits, reset_at)
        VALUES (${this.k(key)}, 1, NOW() + (${seconds} * INTERVAL '1 second'))
        ON CONFLICT (key) DO UPDATE SET
          hits = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
          reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN NOW() + (${seconds} * INTERVAL '1 second') ELSE rate_limits.reset_at END
        RETURNING hits, reset_at
      `;
      if (Math.random() < 0.01) {
        sql`DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'`.catch(() => {});
      }
      return { totalHits: rows[0].hits, resetTime: new Date(rows[0].reset_at) };
    } catch (err) {
      console.error('Rate limit deposu hatası (fail-open):', err.message);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key) {
    try {
      const sql = getSQL();
      await sql`UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = ${this.k(key)}`;
    } catch (err) { console.error('Rate limit decrement hatası:', err.message); }
  }

  async resetKey(key) {
    try {
      const sql = getSQL();
      await sql`DELETE FROM rate_limits WHERE key = ${this.k(key)}`;
    } catch (err) { console.error('Rate limit reset hatası:', err.message); }
  }
}

module.exports = PgRateLimitStore;
