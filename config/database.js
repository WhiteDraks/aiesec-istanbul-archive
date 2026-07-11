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

  // Gallery images for EB teams
  await sql`ALTER TABLE eb_teams ADD COLUMN IF NOT EXISTS gallery_images TEXT[] DEFAULT '{}'`;

  console.log('✅ Veritabanı tabloları hazır.');
}

module.exports = { getSQL, initDB };
