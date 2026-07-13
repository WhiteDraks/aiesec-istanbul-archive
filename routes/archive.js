const express = require('express');
const router = express.Router();
const HeritageDocument = require('../models/HeritageDocument');
const { isLoggedIn, isApproved } = require('../middleware/auth');

// GET /archive - View heritage documents and search/filter them
router.get('/', isLoggedIn, isApproved, async (req, res) => {
  try {
    const { category, search, year } = req.query;

    // Fetch documents matching filters
    const documents = await HeritageDocument.findAll({ category, search, year });

    // Fetch available years for dropdown options
    const availableYears = await HeritageDocument.getAvailableYears();

    // Map categories in Turkish for UI
    const categoriesMap = {
      'magazine': 'Bülten / Dergi 📰',
      'booklet': 'Kongre Kitapçığı 📘',
      'photo': 'Nostaljik Fotoğraf 🖼️',
      'document': 'Resmi Belge / Tüzük 📄',
      'other': 'Diğer 📁'
    };

    res.render('archive/index', {
      title: 'Tarihi Arşiv & Yayınlar - AIESEC İstanbul',
      currentPage: 'archive',
      documents,
      availableYears,
      categoriesMap,
      activeCategory: category || '',
      activeSearch: search || '',
      activeYear: year || ''
    });
  } catch (err) {
    console.error('Error fetching archive documents:', err);
    req.flash('error', 'Tarihi arşiv yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

module.exports = router;
