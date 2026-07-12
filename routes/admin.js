const express = require('express');
const router = express.Router();
const User = require('../models/User');
const upload = require('../middleware/upload');
const { uploadToBlob } = require('../utils/blob');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { sendApprovalEmail } = require('../utils/email');

// All admin routes require login + admin role
router.use(isLoggedIn, isAdmin);

const Feedback = require('../models/Feedback');

// GET /admin - Admin paneli
router.get('/', async (req, res) => {
  try {
    const [pendingUsers, approvedUsers, rejectedUsers, totalUsers, feedbacks] = await Promise.all([
      User.findAllByStatus('pending'),
      User.findAllByStatus('approved'),
      User.findAllByStatus('rejected'),
      User.countByRole('user'),
      Feedback.findAll(),
    ]);

    res.render('admin/panel', {
      title: 'Admin Paneli - AIESEC İstanbul',
      pendingUsers,
      approvedUsers,
      rejectedUsers,
      totalUsers,
      feedbacks,
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

// POST /admin/feedback/delete/:id - Geri bildirimi sil
router.post('/feedback/delete/:id', async (req, res) => {
  try {
    await Feedback.delete(req.params.id);
    req.flash('success', 'Geri bildirim silindi.');
  } catch (err) {
    console.error('Failed to delete feedback:', err);
    req.flash('error', 'Geri bildirim silinirken bir hata oluştu.');
  }
  res.redirect('/admin');
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

// GET /admin/user/:id/edit - Kullanıcı bilgilerini düzenleme formu
router.get('/user/:id/edit', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      req.flash('error', 'Kullanıcı bulunamadı.');
      return res.redirect('/admin');
    }
    res.render('admin/user-edit', {
      title: `${user.name} - Düzenle - AIESEC İstanbul`,
      user,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Kullanıcı yüklenirken bir hata oluştu.');
    res.redirect('/admin');
  }
});

// POST /admin/user/:id/edit - Kullanıcı bilgilerini güncelle
router.post('/user/:id/edit', upload.single('photo'), async (req, res) => {
  try {
    const { name, school, department, linkedin, workplaces, sector, phone, aiesec_journey, role_years, role_titles } = req.body;
    let photoUrl = null;

    if (req.file) {
      photoUrl = await uploadToBlob(req.file.buffer, req.file.originalname, 'avatars/');
    }

    let roles_history = [];
    if (role_years && role_titles) {
      const years = Array.isArray(role_years) ? role_years : [role_years];
      const titles = Array.isArray(role_titles) ? role_titles : [role_titles];
      for (let i = 0; i < years.length; i++) {
        if (years[i].trim() || titles[i].trim()) {
          roles_history.push({ year: years[i].trim(), role: titles[i].trim() });
        }
      }
    }
    const eb_year = roles_history.length > 0 ? roles_history[0].year : null;

    await User.updateProfile(req.params.id, {
      name: name?.trim(),
      school: school?.trim(),
      department: department?.trim(),
      eb_year,
      roles_history,
      linkedin: linkedin?.trim(),
      workplaces: workplaces?.trim(),
      sector: sector?.trim(),
      phone: phone?.trim(),
      aiesec_journey: aiesec_journey?.trim(),
      photo: photoUrl,
    });

    req.flash('success', 'Kullanıcı bilgileri güncellendi.');
    res.redirect('/admin');
  } catch (err) {
    console.error('Admin kullanıcı düzenleme hatası:', err);
    req.flash('error', 'Kullanıcı güncellenirken bir hata oluştu.');
    res.redirect(`/admin/user/${req.params.id}/edit`);
  }
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

// GET /admin/settings - Site Ayarları Düzenleme Paneli
const SiteSetting = require('../models/SiteSetting');
router.get('/settings', async (req, res) => {
  try {
    const settings = await SiteSetting.getAll();
    res.render('admin/settings', {
      title: 'Site Ayarları - Admin Paneli',
      settings,
    });
  } catch (err) {
    console.error('Failed to load settings view:', err);
    req.flash('error', 'Ayarlar yüklenirken bir hata oluştu.');
    res.redirect('/admin');
  }
});

// POST /admin/settings - Site Ayarları Kaydetme
router.post('/settings', upload.fields([
  { name: 'hero_bg_image', maxCount: 1 },
  { name: 'site_logo_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const fields = [
      'theme_primary', 'theme_secondary', 'theme_background', 'theme_surface',
      'site_title', 'site_logo_emblem', 'site_logo_text', 'site_logo_sub', 'footer_credit',
      'footer_credit_color', 'footer_credit_effect', 'email_from',
      'hero_title', 'hero_title_gradient', 'hero_subtitle', 'hero_cta_text'
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        await SiteSetting.update(field, req.body[field].trim());
      }
    }

    // Handle background image upload
    if (req.files && req.files['hero_bg_image'] && req.files['hero_bg_image'][0]) {
      const file = req.files['hero_bg_image'][0];
      const url = await uploadToBlob(file.buffer, file.originalname, 'branding/');
      await SiteSetting.update('hero_bg_image', url);
    } else if (req.body.remove_hero_bg === 'true') {
      await SiteSetting.update('hero_bg_image', '');
    }

    // Handle site logo image upload
    if (req.files && req.files['site_logo_image'] && req.files['site_logo_image'][0]) {
      const file = req.files['site_logo_image'][0];
      const url = await uploadToBlob(file.buffer, file.originalname, 'branding/');
      await SiteSetting.update('site_logo_image', url);
    } else if (req.body.remove_site_logo === 'true') {
      await SiteSetting.update('site_logo_image', '');
    }

    req.flash('success', 'Site ayarları başarıyla güncellendi.');
    res.redirect('/admin/settings');
  } catch (err) {
    console.error('Failed to save settings:', err);
    req.flash('error', 'Ayarlar kaydedilirken bir hata oluştu.');
    res.redirect('/admin/settings');
  }
});

// POST /admin/settings/reset - Site Ayarlarını Varsayılana Döndürme
router.post('/settings/reset', async (req, res) => {
  try {
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
      { key: 'hero_bg_image', value: '' },
      { key: 'site_logo_image', value: '' },
      { key: 'email_from', value: 'AIESEC Alumni <onboarding@resend.dev>' },
      { key: 'hero_title', value: 'Alumni' },
      { key: 'hero_title_gradient', value: 'Executive Board' },
      { key: 'hero_subtitle', value: 'AIESEC İstanbul\'un geçmiş Executive Board dönemlerini, liderlik hikayelerini ve başarılarını keşfedin. Her dönem, bir neslin izlerini taşıyor.' },
      { key: 'hero_cta_text', value: 'EB Takımlarını Keşfet' }
    ];

    for (const d of defaults) {
      await SiteSetting.update(d.key, d.value);
    }

    req.flash('success', 'Tüm ayarlar başarıyla varsayılan değerlere döndürüldü.');
    res.redirect('/admin/settings');
  } catch (err) {
    console.error('Failed to reset settings:', err);
    req.flash('error', 'Ayarlar sıfırlanırken bir hata oluştu.');
    res.redirect('/admin/settings');
  }
});

// POST /admin/digest/trigger - Haftalık Özet Bültenini Manüel Tetikleme
router.post('/digest/trigger', async (req, res) => {
  try {
    const { digest_subject, digest_message, digest_extra_title, digest_extra_content } = req.body;
    const { sendWeeklyDigest } = require('../utils/digest');
    const result = await sendWeeklyDigest(digest_subject, digest_message, digest_extra_title, digest_extra_content);
    if (result.success) {
      if (result.sent > 0) {
        req.flash('success', `Haftalık özet bülteni başarıyla gönderildi. Toplam Gönderim: ${result.sent} üye.`);
      } else {
        req.flash('info', `Bülten gönderimi tetiklendi: Gönderilecek içerik/mesaj bulunamadı (${result.reason}).`);
      }
    } else {
      req.flash('error', `Bülten gönderimi başarısız oldu: ${result.reason || 'Bilinmeyen hata'}`);
    }
  } catch (err) {
    console.error('Digest manual trigger error:', err);
    req.flash('error', 'Bülten gönderilirken sistemsel bir hata oluştu.');
  }
  res.redirect('/admin');
});

module.exports = router;
