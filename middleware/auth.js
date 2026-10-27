/**
 * Auth Middleware
 * Protects routes based on login state, approval status, and role.
 */

/**
 * isLoggedIn - Redirects to login if user is not authenticated.
 * Saves the original URL so the user can be redirected back after login.
 */
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  // Save intended URL for redirect after login
  // Yalnızca GET istekleri için geri dönüş adresi sakla (POST hedefine GET ile dönülemez)
  if (req.method === 'GET') req.session.redirectTo = req.originalUrl;
  req.flash('error', 'Bu sayfayı görüntülemek için giriş yapmanız gerekmektedir.');
  return res.redirect(`/auth/login`);
};

/**
 * isApproved - Ensures user account is approved by admin.
 * Must be used AFTER isLoggedIn.
 */
const isApproved = (req, res, next) => {
  const user = req.session.user;
  if (!user) {
    return res.redirect('/auth/login');
  }

  if (user.role === 'admin' || user.status === 'approved') {
    return next();
  }
  if (user.status === 'pending') {
    return res.render('auth/pending', {
      title: 'Hesap Onayı Bekleniyor',
      user: user,
    });
  }
  if (user.status === 'rejected') {
    req.flash('error', 'Hesabınız reddedilmiştir. Daha fazla bilgi için admin ile iletişime geçin.');
    return res.redirect('/');
  }
  return res.redirect('/auth/login');
};

/**
 * isAdmin - Ensures the current user has admin role.
 */
const isAdmin = (req, res, next) => {
  const user = req.session.user;
  if (user && user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Bu sayfaya erişim yetkiniz bulunmamaktadır.');
  return res.status(403).redirect('/');
};

const SiteSetting = require('../models/SiteSetting');

/**
 * setLocals - Sets res.locals for use in all EJS templates.
 * Must be applied globally in server.js AFTER the flash middleware.
 */
const setLocals = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const User = require('../models/User');
      const dbUser = await User.findById(req.session.userId);
      if (dbUser) {
        req.session.user = {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          // Gerçek rol her istekte veritabanından okunur; "kullanıcı görünümü" yalnızca gerçek adminler için
          // oturumdaki etkin rolü düşürür (yetki yükseltemez).
          role: dbUser.role === 'admin' && req.session.viewAsUser ? 'user' : dbUser.role,
          status: dbUser.status,
          photo: dbUser.photo,
        };
        req.session.realRole = dbUser.role;
        if (dbUser.role !== 'admin') delete req.session.viewAsUser;
      } else {
        // Hesap silinmiş (admin veya kullanıcı tarafından): eski oturum yetkisini kaybeder
        delete req.session.userId;
        delete req.session.user;
      }
    } catch (err) {
      console.error('Failed to sync user details in setLocals:', err);
    }
  }

  res.locals.currentUser = req.session.user || null;
  res.locals.isAdmin = req.session.user?.role === 'admin';
  res.locals.canSwitchRole = req.session.realRole === 'admin';
  res.locals.viewAsUser = !!(req.session.viewAsUser && req.session.realRole === 'admin');
  res.locals.isApproved =
    req.session.user?.status === 'approved' ||
    req.session.user?.role === 'admin';
  
  try {
    res.locals.siteSettings = await SiteSetting.getAll();
  } catch (err) {
    console.error('Failed to load site settings:', err);
    res.locals.siteSettings = {};
  }
  
  res.locals.safeUrl = require('../utils/security').safeUrl;
  res.locals.appVersion = require('../package.json').version;
  next();
};

module.exports = { isLoggedIn, isApproved, isAdmin, setLocals };
