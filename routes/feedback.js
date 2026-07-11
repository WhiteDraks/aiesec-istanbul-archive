const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { sendApprovalEmail } = require('../utils/email'); // We can reuse email helper or construct one

// GET /feedback - Geri bildirim formu sayfası
router.get('/', (req, res) => {
  res.render('feedback', {
    title: 'Geri Bildirim Gönder - AIESEC İstanbul',
  });
});

// POST /feedback - Geri bildirimi kaydetme
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const user_id = req.session.userId || null;

    if (!message || message.trim() === '') {
      req.flash('error', 'Lütfen bir mesaj yazın.');
      return res.redirect('/feedback');
    }

    // Save to database
    await Feedback.create({
      user_id,
      name: name ? name.trim() : null,
      email: email ? email.trim() : null,
      message: message.trim(),
    });

    req.flash('success', 'Geri bildiriminiz başarıyla iletildi. Teşekkür ederiz!');
    res.redirect('/feedback');
  } catch (err) {
    console.error('Feedback submission error:', err);
    req.flash('error', 'Geri bildirim gönderilirken bir hata oluştu.');
    res.redirect('/feedback');
  }
});

module.exports = router;
