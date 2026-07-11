require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');
const connectDB = require('./config/database');
const { setLocals } = require('./middleware/auth');

const app = express();

// ─── Database Connection ──────────────────────────────────────────────────────
connectDB();

// ─── View Engine ─────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Method Override (for PUT/DELETE from forms) ──────────────────────────────
app.use(methodOverride('_method'));

// ─── Session ──────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'aiesec-istanbul-secret-fallback-change-this',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // Only update session once per day unless data changes
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
    },
  })
);

// ─── Flash Messages (simple implementation without connect-flash) ─────────────
app.use((req, res, next) => {
  if (!req.session.flash) req.session.flash = {};

  req.flash = (type, message) => {
    if (!req.session.flash[type]) req.session.flash[type] = [];
    req.session.flash[type].push(message);
  };

  // Make flash available to templates and clear it
  const flash = req.session.flash;
  req.session.flash = {};

  res.locals.success = flash.success || [];
  res.locals.error = flash.error || [];

  next();
});

// ─── Global Template Locals ───────────────────────────────────────────────────
app.use(setLocals);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/eb', require('./routes/eb'));
app.use('/admin', require('./routes/admin'));

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

// ─── Start Server (Local Dev) ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Sunucu çalışıyor: http://localhost:${PORT}`);
    console.log(`📁 Ortam: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export for Vercel serverless
module.exports = app;
