const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isLoggedIn, isApproved } = require('../middleware/auth');

// Sadece giriş yapmış VE admin tarafından onaylanmış kullanıcılar görebilir
router.use(isLoggedIn, isApproved);

// GET /alumni - Mezunlar dizini
router.get('/', async (req, res) => {
  try {
    const { query, sector, city, country, is_mentor } = req.query;
    const { getSQL } = require('../config/database');
    const sql = getSQL();

    // Fetch alumni using search helper
    const alumni = await User.searchApproved({ query, sector, city, country, is_mentor });

    // Distinct cities and countries from DB for filters
    const citiesRows = await sql`SELECT DISTINCT city FROM users WHERE status = 'approved' AND city IS NOT NULL AND city <> '' ORDER BY city ASC`;
    const countriesRows = await sql`SELECT DISTINCT country FROM users WHERE status = 'approved' AND country IS NOT NULL AND country <> '' ORDER BY country ASC`;
    const cities = citiesRows.map(r => r.city);
    const countries = countriesRows.map(r => r.country);

    // Existing sectors list
    const sectors = [
      'Teknoloji/Bilişim', 'Finans/Bankacılık', 'Pazarlama/Reklam', 
      'FMCG', 'Üretim/Sanayi', 'Danışmanlık', 'Eğitim', 'Sağlık', 
      'E-ticaret', 'Girişimcilik', 'Diğer'
    ];

    res.render('alumni/index', {
      title: 'Mezunlar Rehberi - AIESEC İstanbul',
      alumni,
      sectors,
      cities,
      countries,
      activeSector: sector || '',
      activeCity: city || '',
      activeCountry: country || '',
      activeQuery: query || '',
      isMentorOnly: is_mentor === 'true'
    });
  } catch (err) {
    console.error('Alumni dizini yüklenirken hata:', err);
    req.flash('error', 'Mezunlar rehberi yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

module.exports = router;
