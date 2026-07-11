const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isLoggedIn, isApproved } = require('../middleware/auth');

// Sadece giriş yapmış VE admin tarafından onaylanmış kullanıcılar görebilir
router.use(isLoggedIn, isApproved);

// GET /alumni - Mezunlar dizini
router.get('/', async (req, res) => {
  try {
    const { sector } = req.query;
    
    // Sektöre göre veya tüm onaylı mezunları getir
    const alumni = await User.findAllApprovedWithSector(sector);

    // Mevcut sektörleri belirle (dropdown veya butonlar için)
    const sectors = [
      'Teknoloji/Bilişim', 'Finans/Bankacılık', 'Pazarlama/Reklam', 
      'FMCG', 'Üretim/Sanayi', 'Danışmanlık', 'Eğitim', 'Sağlık', 
      'E-ticaret', 'Girişimcilik', 'Diğer'
    ];

    res.render('alumni/index', {
      title: 'Mezunlar Rehberi - AIESEC İstanbul',
      alumni,
      sectors,
      activeSector: sector || ''
    });
  } catch (err) {
    console.error('Alumni dizini yüklenirken hata:', err);
    req.flash('error', 'Mezunlar rehberi yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

module.exports = router;
