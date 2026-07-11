const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { sendApprovalEmail } = require('../utils/email');

// All admin routes require login + admin role
router.use(isLoggedIn, isAdmin);

// GET /admin - Admin paneli
router.get('/', async (req, res) => {
  try {
    const [pendingUsers, approvedUsers, rejectedUsers, totalUsers] = await Promise.all([
      User.findAllByStatus('pending'),
      User.findAllByStatus('approved'),
      User.findAllByStatus('rejected'),
      User.countByRole('user'),
    ]);

    res.render('admin/panel', {
      title: 'Admin Paneli - AIESEC İstanbul',
      pendingUsers,
      approvedUsers,
      rejectedUsers,
      totalUsers,
      stats: {
        pending: pendingUsers.length,
        approved: approvedUsers.length,
        rejected: rejectedUsers.length,
        total: totalUsers,
      },
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Admin paneli yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

// POST /admin/approve/:id - Kullanıcı onayla
router.post('/approve/:id', async (req, res) => {
  try {
    const user = await User.updateStatus(req.params.id, 'approved', req.session.user.id);
    if (user && user.email) {
      await sendApprovalEmail(user.email, user.name);
    }
    req.flash('success', 'Kullanıcı başarıyla onaylandı.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Kullanıcı onaylanırken bir hata oluştu.');
  }
  res.redirect('/admin');
});

// POST /admin/reject/:id - Kullanıcı reddet
router.post('/reject/:id', async (req, res) => {
  try {
    await User.updateStatus(req.params.id, 'rejected');
    req.flash('success', 'Kullanıcı reddedildi.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'İşlem sırasında bir hata oluştu.');
  }
  res.redirect('/admin');
});

// POST /admin/delete/:id - Kullanıcı sil (opsiyonel)
router.post('/delete/:id', async (req, res) => {
  try {
    await User.delete(req.params.id);
    req.flash('success', 'Kullanıcı silindi.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Silme işleminde bir hata oluştu.');
  }
  res.redirect('/admin');
});

// POST /admin/reset/:id - Rejected → Pending yap (tekrar değerlendirme)
router.post('/reset/:id', async (req, res) => {
  try {
    await User.updateStatus(req.params.id, 'pending');
    req.flash('success', 'Kullanıcı tekrar değerlendirme listesine alındı.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'İşlem sırasında bir hata oluştu.');
  }
  res.redirect('/admin');
});

module.exports = router;
