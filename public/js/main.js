// ── Navbar scroll effect ─────────────────────────────────────────────────────
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

// ── Mobile hamburger menu ─────────────────────────────────────────────────────
const hamburger = document.getElementById('nav-hamburger');
const navLinks = document.getElementById('nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen);

    // Animate hamburger → X
    const spans = hamburger.querySelectorAll('span');
    if (isOpen) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      const spans = hamburger.querySelectorAll('span');
      spans.forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
    }
  });
}

// ── Mobile Dropdown Toggle ───────────────────────────────────────────────────
document.querySelectorAll('.nav-item-dropdown > a').forEach(toggle => {
  toggle.addEventListener('click', (e) => {
    if (window.innerWidth <= 991) {
      e.preventDefault();
      const parent = toggle.parentElement;
      
      // Close other mobile active dropdowns
      document.querySelectorAll('.nav-item-dropdown').forEach(item => {
        if (item !== parent) item.classList.remove('active-mobile');
      });
      
      parent.classList.toggle('active-mobile');
    }
  });
});

// ── Admin tabs ───────────────────────────────────────────────────────────────
const adminTabs = document.querySelectorAll('.admin-tab');
if (adminTabs.length) {
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = `tab-${tab.dataset.tab}`;

      // Update tab states
      adminTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Show/hide panels
      document.querySelectorAll('.admin-panel').forEach(panel => {
        panel.hidden = panel.id !== targetId;
      });
    });
  });
}

// ── Member details toggle ─────────────────────────────────────────────────────
function toggleMemberDetails(memberId) {
  const detailsEl = document.getElementById(`details-${memberId}`);
  const btn = document.querySelector(`#member-${memberId} .btn-details:not(.btn-details-close)`);

  if (!detailsEl) return;

  const isHidden = detailsEl.hidden;
  detailsEl.hidden = !isHidden;

  if (btn) {
    btn.textContent = isHidden ? 'Kapat ↑' : 'Detayları Gör ↓';
    btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
  }
}

// ── Password toggle ───────────────────────────────────────────────────────────
function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.type = field.type === 'password' ? 'text' : 'password';
}

// ── Auto-dismiss flash messages ───────────────────────────────────────────────
document.querySelectorAll('.flash').forEach(flash => {
  setTimeout(() => {
    flash.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    flash.style.opacity = '0';
    flash.style.transform = 'translateX(100%)';
    setTimeout(() => flash.remove(), 400);
  }, 5000);
});

// ── Scroll reveal animation ───────────────────────────────────────────────────
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.team-card, .year-card, .member-card, .intro-card').forEach(el => {
    // Only apply to elements not already animated by CSS
    if (!el.style.animationDelay || el.style.animationDelay === '0s') {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      revealObserver.observe(el);
    }
  });
}

// ── Form submit loading state ─────────────────────────────────────────────────
document.querySelectorAll('.auth-form').forEach(form => {
  form.addEventListener('submit', function() {
    const submitBtn = this.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Lütfen bekleyin...';
    }
  });
});
