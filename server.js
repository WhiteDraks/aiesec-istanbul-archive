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
// CSP, EJS'nin satır-içi <script> ve onclick="" yapısına izin verecek şekilde ayarlı
// (script-src + script-src-attr: 'unsafe-inline'). Diğer tüm korumalar aktif:
// X-Frame-Options, HSTS, XSS, nosniff, Referrer-Policy...
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
      // script-src-attr, script-src'den AYRI bir CSP3 direktifidir ve helmet
      // useDefaults:true ile bunu açıkça belirtilmezse 'none' yapar — bu da
      // onclick="..." gibi tüm satır-içi olay tetikleyicilerini (tema anahtarı,
      // iş ilanı/etkinlik modalleri vb.) sessizce engelliyordu.
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      "img-src": ["'self'", "data:", "blob:", "https://*.public.blob.vercel-storage.com", "https://aiesec-blob-public.s3.amazonaws.com", "https://www.google-analytics.com", "https://*.google-analytics.com"],
      "connect-src": ["'self'", "https://*.public.blob.vercel-storage.com", "https://www.google-analytics.com", "https://*.google-analytics.com"],
      "object-src": ["'none'"],
      "upgrade-insecure-requests": []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
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
    maxAge: 1000 * 60 * 60 * 24, // 24 hours (1 day)
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
  req.flash = (type, message) => {
    if (!req.session) return;
    if (!req.session.flash) req.session.flash = {};
    if (!req.session.flash[type]) req.session.flash[type] = [];
    req.session.flash[type].push(message);
  };
  const flash = req.session && req.session.flash ? req.session.flash : {};
  if (req.session) req.session.flash = {};
  res.locals.success = flash.success || [];
  res.locals.error   = flash.error   || [];
  next();
});

// ─── Global Template Locals ───────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.csrfToken = "";
  next();
});
app.use(setLocals);

// ─── CSRF Protection via Origin & Referer Verification ────────────────────────
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const origin = req.headers.origin === 'null' ? null : req.headers.origin;
    const referer = req.headers.referer;
    const host = req.headers.host; // E.g. aiesec-istanbul-archive.vercel.app

    let isValid = true;
    const cleanHost = host ? host.replace('www.', '').toLowerCase() : '';

    const checkHost = (targetHost) => {
      if (!targetHost) return false;
      const cleanTarget = targetHost.replace('www.', '').toLowerCase();
      // Exact match or subdomain match or vercel preview URL match
      return cleanTarget === cleanHost ||
             cleanTarget.endsWith('.' + cleanHost) ||
             cleanHost.endsWith('.' + cleanTarget) ||
             cleanTarget.endsWith('.vercel.app') ||
             (req.headers['x-forwarded-host'] && cleanTarget === req.headers['x-forwarded-host'].replace('www.', '').toLowerCase());
    };

    if (origin) {
      try {
        const originUrl = new URL(origin);
        isValid = checkHost(originUrl.host);
      } catch (e) {
        isValid = false;
      }
    } else if (referer) {
      try {
        const refererUrl = new URL(referer);
        isValid = checkHost(refererUrl.host);
      } catch (e) {
        isValid = false;
      }
    }

    if (!isValid) {
      console.warn(`[CSRF Blocked] Request to ${req.path} from external origin. Origin: ${origin}, Referer: ${referer}, Host: ${host}`);
      return res.status(403).render('error', {
        title: '403 - Yetkisiz İstek',
        statusCode: 403,
        message: 'Güvenlik doğrulaması başarısız oldu (CSRF Koruması). Dış kaynaklardan yapılan durum değiştirme istekleri engellenmiştir.',
      });
    }
  }
  next();
});

// ─── Content Creation Rate Limiting (Anti-Spam) ───────────────────────────────
const contentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 dakika
  max: 10,                   // 1 dakikada en fazla 10 içerik isteği
  message: 'Çok hızlı içerik oluşturuyorsunuz. Lütfen 1 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/',         require('./routes/index'));
app.use('/auth',     authLimiter, require('./routes/auth'));  // Rate limit tüm auth rotalarına
app.use('/eb',       require('./routes/eb'));
app.use('/admin',    require('./routes/admin'));
app.use('/admin/eb', require('./routes/admin-eb'));
app.use('/timeline', require('./routes/timeline'));
app.use('/archive',  require('./routes/archive'));
app.use('/ai-assistant', require('./routes/ai'));
app.use('/profile',  require('./routes/profile'));
app.use('/alumni',   require('./routes/alumni'));
app.use('/feedback', contentLimiter, require('./routes/feedback'));
app.use('/jobs',     contentLimiter, require('./routes/jobs'));
app.use('/events',   contentLimiter, require('./routes/events'));

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
