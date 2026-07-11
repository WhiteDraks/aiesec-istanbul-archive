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
  const redirectUrl = req.originalUrl;
  req.session.redirectTo = redirectUrl;
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
  if (user.status === 'approved' || user.role === 'admin') {
    return next();
  }
  if (user.status === 'pending') {
    return res.render('auth/pending', {
      title: 'Hesap Onayı Bekleniyor',
      user: req.session.user,
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

/**
 * setLocals - Sets res.locals for use in all EJS templates.
 * Must be applied globally in server.js AFTER the flash middleware.
 */
const setLocals = (req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.isAdmin = req.session.user?.role === 'admin';
  res.locals.isApproved =
    req.session.user?.status === 'approved' ||
    req.session.user?.role === 'admin';
  // Note: flash messages (res.locals.success / res.locals.error)
  // are set by the flash middleware in server.js
  next();
};

module.exports = { isLoggedIn, isApproved, isAdmin, setLocals };
