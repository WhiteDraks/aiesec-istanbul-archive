const express = require('express');
const router = express.Router();
const TimelineMilestone = require('../models/TimelineMilestone');
const { isLoggedIn, isApproved } = require('../middleware/auth');

// GET /timeline - View interactive timeline
router.get('/', isLoggedIn, isApproved, async (req, res) => {
  try {
    const milestones = await TimelineMilestone.findAll();
    res.render('timeline/index', {
      title: 'İnteraktif Tarih Şeridi - AIESEC İstanbul',
      currentPage: 'timeline',
      milestones
    });
  } catch (err) {
    console.error('Error fetching timeline milestones:', err);
    req.flash('error', 'Zaman tüneli yüklenirken bir hata oluştu.');
    res.redirect('/');
  }
});

module.exports = router;
