const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { str } = require('../utils/security');
const SiteSetting = require('../models/SiteSetting');
const { TEMPLATES, SIGNATURE, LIMITS, settingKey, getConfig } = require('../utils/mailTemplates');

router.use(isLoggedIn, isAdmin);

const SAMPLE_VARS = { ad: 'Ayşe Yılmaz', email: 'ayse@ornek.com' };

// GET /admin/mail - E-posta taslakları
router.get('/', async (req, res) => {
  try {
    const { templates, sig } = await getConfig();
    res.render('admin/mail', {
      title: 'E-posta Taslakları - Admin Paneli',
      templates, sig, SIGNATURE, LIMITS,
    });
  } catch (err) {
    console.error('Mail taslakları yüklenemedi:', err);
    req.flash('error', 'E-posta taslakları yüklenirken bir hata oluştu.');
    res.redirect('/admin');
  }
});

// GET /admin/mail/preview/:key - Kaydedilmiş taslağın örnek verilerle önizlemesi
router.get('/preview/:key', async (req, res) => {
  if (!Object.prototype.hasOwnProperty.call(TEMPLATES, req.params.key)) return res.redirect('/admin/mail');
  try {
    const { composeMail } = require('../utils/email');
    const { SITE_URL } = require('../utils/escape');
    const mail = await composeMail(req.params.key, SAMPLE_VARS, `${SITE_URL}/ornek-baglanti`);
    res.set('Content-Type', 'text/html; charset=utf-8').send(mail.html);
  } catch (err) {
    console.error('Mail önizleme hatası:', err);
    res.redirect('/admin/mail');
  }
});

// POST /admin/mail - Kaydet (varsayılanla aynı ya da boş değer = varsayılana dön)
router.post('/', async (req, res) => {
  try {
    const save = async (key, value, def, max) => {
      const v = str(value, max).replace(/\r\n/g, '\n');
      await SiteSetting.update(key, v === def ? '' : v);
    };
    for (const [k, t] of Object.entries(TEMPLATES)) {
      await save(settingKey(k, 'subject'), req.body[`${k}__subject`], t.subject, LIMITS.subject);
      await save(settingKey(k, 'body'), req.body[`${k}__body`], t.body, LIMITS.body);
      if (t.button) await save(settingKey(k, 'button'), req.body[`${k}__button`], t.button.label, LIMITS.button);
      if (t.after) await save(settingKey(k, 'after'), req.body[`${k}__after`], t.after, LIMITS.after);
    }
    for (const [k, s] of Object.entries(SIGNATURE)) {
      await save('mail_' + k, req.body[k], s.def, s.max);
    }
    req.flash('success', 'E-posta taslakları kaydedildi.');
  } catch (err) {
    console.error('Mail taslakları kaydedilemedi:', err);
    req.flash('error', 'E-posta taslakları kaydedilirken bir hata oluştu.');
  }
  res.redirect('/admin/mail');
});

// POST /admin/mail/reset - Tüm taslakları ve imzayı varsayılana döndür
router.post('/reset', async (req, res) => {
  try {
    for (const [k, t] of Object.entries(TEMPLATES)) {
      for (const f of ['subject', 'body', 'button', 'after']) await SiteSetting.update(settingKey(k, f), '');
    }
    for (const k of Object.keys(SIGNATURE)) await SiteSetting.update('mail_' + k, '');
    req.flash('success', 'E-posta taslakları varsayılana döndürüldü.');
  } catch (err) {
    console.error('Mail taslakları sıfırlanamadı:', err);
    req.flash('error', 'Sıfırlama sırasında bir hata oluştu.');
  }
  res.redirect('/admin/mail');
});

module.exports = router;
