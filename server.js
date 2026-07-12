require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const methodOverride = require('method-override');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB, getSQL } = require('./config/database');
const { setLocals } = require('./middleware/auth');

// ─── Session Secret Guard ─────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: SESSION_SECRET environment variable is not set. Using insecure fallback. Set this in production!');
}

const app = express();

// Trust proxy is required for secure cookies behind Vercel's reverse proxy
app.set('trust proxy', 1);

// ─── Helmet — HTTP Security Headers ──────────────────────────────────────────
// CSP (Content Security Policy) devre dışı — EJS inline script yapısıyla çakışıyor.
// Diğer tüm korumalar aktif: X-Frame-Options, HSTS, XSS, nosniff, Referrer-Policy...
app.use(helmet({
  contentSecurityPolicy:     false,   // CSP kapalı (EJS inline script uyumluluğu için)
  crossOriginEmbedderPolicy: false,   // Vercel Blob CDN görselleri için
  crossOriginResourcePolicy: false,   // Harici görsellerin yüklenmesine izin ver
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 dakika
  max: 20,                    // 15 dakikada en fazla 20 deneme
  message: 'Çok fazla istek gönderildi. Lütfen 15 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET', // Sadece POST isteklerine uygula
});

// ─── View Engine ─────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Method Override ──────────────────────────────────────────────────────────
app.use(methodOverride('_method'));

// ─── Session ──────────────────────────────────────────────────────────────────
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'aiesec-istanbul-fallback-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  },
};

// Use Postgres session store (non-pooling URL avoids pgbouncer issues)
const sessionDbUrl =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (sessionDbUrl) {
  const sessionPool = new Pool({
    connectionString: sessionDbUrl,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });
  sessionConfig.store = new pgSession({
    pool: sessionPool,
    tableName: 'session',
    createTableIfMissing: false,
  });
}

app.use(session(sessionConfig));

// ─── Flash Messages ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (!req.session.flash) req.session.flash = {};
  req.flash = (type, message) => {
    if (!req.session.flash[type]) req.session.flash[type] = [];
    req.session.flash[type].push(message);
  };
  const flash = req.session.flash;
  req.session.flash = {};
  res.locals.success = flash.success || [];
  res.locals.error   = flash.error   || [];
  next();
});

// ─── Global Template Locals ───────────────────────────────────────────────────
app.use(setLocals);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/',         require('./routes/index'));
app.use('/auth',     authLimiter, require('./routes/auth'));  // Rate limit tüm auth rotalarına
app.use('/eb',       require('./routes/eb'));
app.use('/admin',    require('./routes/admin'));
app.use('/admin/eb', require('./routes/admin-eb'));
app.use('/profile',  require('./routes/profile'));
app.use('/alumni',   require('./routes/alumni'));
app.use('/feedback', require('./routes/feedback'));
app.use('/jobs',     require('./routes/jobs'));
app.use('/events',   require('./routes/events'));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Sayfa Bulunamadı',
    statusCode: 404,
    message: 'Aradığınız sayfa bulunamadı.',
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Uygulama hatası:', err);
  res.status(500).render('error', {
    title: '500 - Sunucu Hatası',
    statusCode: 500,
    message: 'Bir şeyler ters gitti. Lütfen daha sonra tekrar deneyin.',
  });
});

// ─── Initialize DB & Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDB();
    if (require.main === module) {
      app.listen(PORT, () => {
        console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('❌ DB başlatma hatası:', err.message);
    // Still start server so static pages/error pages work
    if (require.main === module) {
      app.listen(PORT, () => console.log(`🚀 Sunucu (DB'siz) çalışıyor: http://localhost:${PORT}`));
    }
  }
}

startServer();

// Export for Vercel serverless
module.exports = app;
