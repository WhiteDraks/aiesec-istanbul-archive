const { neon } = require('@neondatabase/serverless');

// Neon serverless connection
// POSTGRES_URL or DATABASE_URL env var is used automatically
let _sql = null;

function getSQL() {
  if (!_sql) {
    const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('POSTGRES_URL veya DATABASE_URL environment variable bulunamadı.');
    }
    _sql = neon(dbUrl);
  }
  return _sql;
}

/**
 * Initialize all tables if they don't exist.
 * Called once on server startup.
 */
async function initDB() {
  const sql = getSQL();

  // Enable UUID extension
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100)  NOT NULL,
      email       VARCHAR(255)  UNIQUE NOT NULL,
      password    VARCHAR(255)  NOT NULL,
      role        VARCHAR(20)   NOT NULL DEFAULT 'user',
      status      VARCHAR(20)   NOT NULL DEFAULT 'pending',
      school      VARCHAR(255),
      eb_year     VARCHAR(50),
      approved_at TIMESTAMPTZ,
      approved_by UUID REFERENCES users(id),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // EB Teams table
  await sql`
    CREATE TABLE IF NOT EXISTS eb_teams (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      year        VARCHAR(20)   UNIQUE NOT NULL,
      title       VARCHAR(255)  NOT NULL,
      slug        VARCHAR(100)  UNIQUE NOT NULL,
      description TEXT,
      cover_image VARCHAR(500)  DEFAULT '/images/default-cover.jpg',
      group_photo VARCHAR(500),
      is_public   BOOLEAN       NOT NULL DEFAULT FALSE,
      achievements TEXT[]       DEFAULT '{}',
      sort_order  INTEGER       NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // EB Members table
  await sql`
    CREATE TABLE IF NOT EXISTS eb_members (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_id          UUID REFERENCES eb_teams(id) ON DELETE CASCADE,
      name             VARCHAR(100)  NOT NULL,
      role             VARCHAR(255)  NOT NULL,
      department       VARCHAR(255),
      school           VARCHAR(255),
      email            VARCHAR(255),
      linkedin         VARCHAR(500),
      aiesec_journey   TEXT,
      bio              TEXT,
      photo            VARCHAR(500)  DEFAULT '/images/default-avatar.svg',
      is_pin_to_bottom BOOLEAN       NOT NULL DEFAULT FALSE,
      sort_order       INTEGER       NOT NULL DEFAULT 100,
      created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // Sessions table (for connect-pg-simple)
  await sql`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    VARCHAR NOT NULL COLLATE "default",
      "sess"   JSON    NOT NULL,
      "expire" TIMESTAMP(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
  `;

  // Profile fields migrations
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo VARCHAR(500) DEFAULT '/images/default-avatar.svg'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(255)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin VARCHAR(500)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS workplaces TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS sector VARCHAR(100)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS aiesec_journey TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS roles_history JSONB DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_mentee BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mentorship_details TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ`;

  // Gallery images for EB teams
  await sql`ALTER TABLE eb_teams ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT '{}'`;

  // Jobs (Kariyer İlanları) table
  await sql`
    CREATE TABLE IF NOT EXISTS jobs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      title       VARCHAR(255)  NOT NULL,
      company     VARCHAR(255)  NOT NULL,
      location    VARCHAR(255),
      type        VARCHAR(100)  NOT NULL,
      description TEXT          NOT NULL,
      link        VARCHAR(500),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // Events (Etkinlikler) table
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(255)  NOT NULL,
      description TEXT          NOT NULL,
      event_date  TIMESTAMPTZ   NOT NULL,
      location    VARCHAR(255)  NOT NULL,
      link        VARCHAR(500),
      created_by  UUID REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // Event attendees junction table
  await sql`
    CREATE TABLE IF NOT EXISTS event_attendees (
      event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
      user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (event_id, user_id)
    )
  `;

  // EB Memories table (added by users)
  await sql`
    CREATE TABLE IF NOT EXISTS eb_memories (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_year   VARCHAR(20)   NOT NULL,
      user_id     UUID          REFERENCES users(id) ON DELETE CASCADE,
      photo_url   VARCHAR(500)  NOT NULL,
      caption     VARCHAR(255),
      created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // Site settings table
  await sql`
    CREATE TABLE IF NOT EXISTS site_settings (
      key         VARCHAR(100) PRIMARY KEY,
      value       TEXT NOT NULL,
      updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  // Feedback table
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      name        VARCHAR(255),
      email       VARCHAR(255),
      message     TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Interactive Timeline Milestones table
  await sql`
    CREATE TABLE IF NOT EXISTS timeline_milestones (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      year        INT NOT NULL,
      title       VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      image_url   TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Heritage Documents / Archives table
  await sql`
    CREATE TABLE IF NOT EXISTS heritage_documents (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      category    VARCHAR(50) NOT NULL,
      year        VARCHAR(50),
      file_url    TEXT NOT NULL,
      file_type   VARCHAR(20) NOT NULL,
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed default settings if empty
  const countRes = await sql`SELECT COUNT(*) FROM site_settings`;
  if (parseInt(countRes[0].count, 10) === 0) {
    const defaults = [
      { key: 'theme_primary', value: '#037ef3' },
      { key: 'theme_secondary', value: '#0a2540' },
      { key: 'theme_background', value: '#090d16' },
      { key: 'theme_surface', value: '#111827' },
      { key: 'site_title', value: 'AIESEC İstanbul Alumni Archive' },
      { key: 'site_logo_emblem', value: 'A' },
      { key: 'site_logo_text', value: 'AIESEC' },
      { key: 'site_logo_sub', value: 'İstanbul' },
      { key: 'footer_credit', value: 'Geçmiş liderlik deneyimlerini onurlandırmak için 26.27 LCVP F&L Elif Kurnaz tarafından yapıldı.' },
      { key: 'footer_credit_color', value: '#ffffff' },
      { key: 'footer_credit_effect', value: 'none' },
      { key: 'email_from', value: 'AIESEC Alumni <onboarding@resend.dev>' },
      { key: 'hero_title', value: 'Alumni' },
      { key: 'hero_title_gradient', value: 'Executive Board' },
      { key: 'hero_subtitle', value: 'AIESEC İstanbul\'un geçmiş Executive Board dönemlerini, liderlik hikayelerini ve başarılarını keşfedin. Her dönem, bir neslin izlerini taşıyor.' },
      { key: 'hero_cta_text', value: 'EB Takımlarını Keşfet' }
    ];
    for (const d of defaults) {
      await sql`INSERT INTO site_settings (key, value) VALUES (${d.key}, ${d.value})`;
    }
  }

  console.log('✅ Veritabanı tabloları hazır.');
}

module.exports = { getSQL, initDB };
