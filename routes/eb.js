const express = require('express');
const router = express.Router();
const EBTeam = require('../models/EBTeam');
const EBMember = require('../models/EBMember');
const { isLoggedIn, isApproved } = require('../middleware/auth');

// GET /eb - Tüm EB takımları (herkes görebilir)
router.get('/', async (req, res) => {
  try {
    const teams = await EBTeam.findAll();
    res.render('eb/index', {
      title: 'EB Takımları - AIESEC İstanbul',
      teams,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Takımlar yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

// GET /eb/:slug - Belirli bir EB detay sayfası (sadece onaylı kullanıcılar)
router.get('/:slug', isLoggedIn, isApproved, async (req, res) => {
  try {
    const team = await EBTeam.findBySlug(req.params.slug);
    if (!team) {
      req.flash('error', 'EB takımı bulunamadı.');
      return res.redirect('/eb');
    }

    // Fetch members: EBMember.findByTeamId sorts normal members first, pinned-to-bottom last
    const members = await EBMember.findByTeamId(team.id);

    res.render('eb/detail', {
      title: `${team.title} - AIESEC İstanbul`,
      team,
      members,
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Sayfa yüklenirken bir hata oluştu.');
    res.redirect('/eb');
  }
});

module.exports = router;
