const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');

// GET / - Ana sayfa
router.get('/', async (req, res) => {
  try {
    // Get latest 4 EB teams for homepage preview
    const teams = await EBTeam.find().sort({ order: -1, createdAt: -1 }).limit(6);
    res.render('index', {
      title: 'AIESEC İstanbul Alumni Archive',
      teams,
    });
  } catch (err) {
    console.error(err);
    res.render('index', {
      title: 'AIESEC İstanbul Alumni Archive',
      teams: [],
    });
  }
});

module.exports = router;
