const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');

// GET / - Ana sayfa
router.get('/', async (req, res) => {
  try {
    // Get latest 6 EB teams for homepage preview using SQL model
    const teams = await EBTeam.findLatest(6);
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
