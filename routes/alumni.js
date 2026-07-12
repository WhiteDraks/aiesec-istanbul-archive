const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { isLoggedIn, isApproved } = require('../middleware/auth');

// Sadece giriş yapmış VE admin tarafından onaylanmış kullanıcılar görebilir
router.use(isLoggedIn, isApproved);

// GET /alumni - Mezunlar dizini
router.get('/', async (req, res) => {
  try {
    const { query, sector, city, country, is_mentor, start_year, end_year } = req.query;
    const { getSQL } = require('../config/database');
    const sql = getSQL();

    // Fetch alumni using search helper
    const alumni = await User.searchApproved({ query, sector, city, country, is_mentor });

    // Fetch all available EB team years for the range dropdown options
    const EBTeam = require('../models/EBTeam');
    const teamMetas = await EBTeam.findAll();
    const availableYears = teamMetas.map(t => t.year).sort((a, b) => b.localeCompare(a));

    // Filter alumni by year range (checks both primary eb_year and roles_history)
    let filteredAlumni = alumni;
    if (start_year || end_year) {
      const getYearStart = (y) => parseInt(y.split('-')[0], 10);
      const startVal = start_year ? getYearStart(start_year) : null;
      const endVal = end_year ? getYearStart(end_year) : null;

      filteredAlumni = alumni.filter(person => {
        const personYears = new Set();
        if (person.eb_year && /^\d{4}-\d{4}$/.test(person.eb_year)) {
          personYears.add(person.eb_year);
        }
        if (person.roles_history && Array.isArray(person.roles_history)) {
          person.roles_history.forEach(role => {
            if (role.year && /^\d{4}-\d{4}$/.test(role.year)) {
              personYears.add(role.year);
            }
          });
        }

        if (personYears.size === 0) return false;

        return Array.from(personYears).some(py => {
          const yVal = getYearStart(py);
          if (startVal && yVal < startVal) return false;
          if (endVal && yVal > endVal) return false;
          return true;
        });
      });
    }

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
      alumni: filteredAlumni,
      sectors,
      cities,
      countries,
      availableYears,
      start_year: start_year || '',
      end_year: end_year || '',
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

// GET /alumni/:id - Mezun detay sayfası
router.get('/:id', async (req, res) => {
  try {
    const person = await User.findById(req.params.id);
    if (!person || person.status !== 'approved') {
      req.flash('error', 'Bu mezun kaydı bulunamadı.');
      return res.redirect('/alumni');
    }

    res.render('alumni/detail', {
      title: `${person.name} - AIESEC İstanbul`,
      person,
    });
  } catch (err) {
    console.error('Mezun detayı yüklenirken hata:', err);
    req.flash('error', 'Mezun detayı yüklenirken bir hata oluştu.');
    res.redirect('/alumni');
  }
});

module.exports = router;
