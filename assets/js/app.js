// Vanilla JavaScript for interactivity

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
  const siteNav = document.getElementById('site-nav');
  const siteNavToggle = document.getElementById('site-nav-toggle');
  const siteNavLinks = siteNav?.querySelectorAll('a');
  const sectionLinks = siteNav?.querySelectorAll('a[data-section]');
  const sections = Array.from(sectionLinks || [])
    .map(function(link) {
      return document.getElementById(link.dataset.section);
    })
    .filter(Boolean);

  const closeSiteNav = function() {
    if (!siteNav || !siteNavToggle) return;
    siteNav.classList.remove('is-open');
    siteNavToggle.setAttribute('aria-expanded', 'false');
    siteNavToggle.querySelector('.site-nav-toggle-symbol').textContent = '+';
  };

  siteNavToggle?.addEventListener('click', function() {
    const isOpen = !siteNav.classList.contains('is-open');
    siteNav.classList.toggle('is-open', isOpen);
    siteNavToggle.setAttribute('aria-expanded', String(isOpen));
    siteNavToggle.querySelector('.site-nav-toggle-symbol').textContent = isOpen ? '×' : '+';
  });

  siteNavLinks?.forEach(function(link) {
    link.addEventListener('click', closeSiteNav);
  });

  document.addEventListener('click', function(event) {
    if (siteNav?.classList.contains('is-open') && !siteNav.contains(event.target)) {
      closeSiteNav();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && siteNav?.classList.contains('is-open')) {
      closeSiteNav();
      siteNavToggle?.focus();
    }
  });

  const updateSiteNav = function() {
    if (!siteNav) return;

    siteNav.classList.toggle('is-scrolled', window.scrollY > 0);

    const activeLine = window.innerHeight * 0.35;
    let activeSection = null;

    sections.forEach(function(section) {
      if (section.getBoundingClientRect().top <= activeLine) activeSection = section;
    });

    sectionLinks?.forEach(function(link) {
      if (link.dataset.section === activeSection?.id) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const navBounds = siteNav.getBoundingClientRect();
    const sampleX = Math.min(navBounds.left + 8, window.innerWidth - 1);
    const sampleY = Math.min(navBounds.top + 8, window.innerHeight - 1);
    const backgroundElement = document.elementsFromPoint(sampleX, sampleY).find(function(element) {
      return !siteNav.contains(element);
    });
    const isDark = Boolean(
      backgroundElement?.closest('#skills, footer.wrapper, img, .image')
    );
    siteNav.classList.toggle('nav-on-dark', isDark);
  };

  let navUpdateQueued = false;
  const queueSiteNavUpdate = function() {
    if (navUpdateQueued) return;
    navUpdateQueued = true;
    window.requestAnimationFrame(function() {
      updateSiteNav();
      navUpdateQueued = false;
    });
  };

  window.addEventListener('scroll', queueSiteNavUpdate, { passive: true });
  window.addEventListener('resize', function() {
    if (window.innerWidth > 1100) closeSiteNav();
    queueSiteNavUpdate();
  });
  updateSiteNav();

  const cvModal = document.getElementById('cv-modal');
  const openButton = document.getElementById('cv-modal-open');
  const closeButton = document.getElementById('cv-modal-close');
  let returnFocus = null;

  if (!cvModal || !openButton || !closeButton) return;

  openButton.addEventListener('click', function() {
    returnFocus = document.activeElement;
    cvModal.showModal();
  });

  closeButton.addEventListener('click', function() {
    cvModal.close();
  });

  cvModal.addEventListener('click', function(event) {
    if (event.target === cvModal) cvModal.close();
  });

  cvModal.addEventListener('close', function() {
    if (returnFocus instanceof HTMLElement) returnFocus.focus();
    returnFocus = null;
  });

  const galleryStrip = document.querySelector('.gallery-strip');
  const galleryLightbox = document.getElementById('gallery-lightbox');
  const galleryImage = galleryLightbox?.querySelector('.gallery-lightbox-image');
  const galleryClose = galleryLightbox?.querySelector('.gallery-lightbox-close');
  const galleryTriggers = document.querySelectorAll('.gallery-trigger');
  let lastGalleryTrigger = null;

  galleryTriggers.forEach(function(trigger) {
    trigger.addEventListener('click', function() {
      if (!galleryLightbox || !galleryImage || !galleryClose) return;

      const thumbnail = trigger.querySelector('img');
      lastGalleryTrigger = trigger;
      galleryImage.src = trigger.dataset.full;
      galleryImage.alt = thumbnail?.alt || 'Selected moment';
      document.body.classList.add('gallery-lightbox-open');
      galleryLightbox.showModal();
      galleryClose.focus();
    });
  });

  galleryClose?.addEventListener('click', function() {
    galleryLightbox.close();
  });

  galleryLightbox?.addEventListener('click', function(event) {
    if (
      event.target === galleryLightbox ||
      event.target.classList.contains('gallery-lightbox-panel')
    ) {
      galleryLightbox.close();
    }
  });

  galleryLightbox?.addEventListener('close', function() {
    document.body.classList.remove('gallery-lightbox-open');
    galleryImage?.removeAttribute('src');
    if (lastGalleryTrigger instanceof HTMLElement) lastGalleryTrigger.focus();
    lastGalleryTrigger = null;
  });

  galleryStrip?.addEventListener('wheel', function(event) {
    const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
    if (!delta) return;

    const movingForward = delta > 0;
    const canMoveForward = galleryStrip.scrollLeft + galleryStrip.clientWidth < galleryStrip.scrollWidth - 1;
    const canMoveBackward = galleryStrip.scrollLeft > 1;

    if ((movingForward && canMoveForward) || (!movingForward && canMoveBackward)) {
      event.preventDefault();
      galleryStrip.scrollLeft += delta;
    }
  }, { passive: false });

  const contactForm = document.getElementById('contact-form');
  const contactSubmit = document.getElementById('submit');
  const contactStatus = document.getElementById('contact-form-status');

  contactForm?.addEventListener('submit', async function(event) {
    event.preventDefault();

    if (!(contactSubmit instanceof HTMLButtonElement) || !contactStatus) return;

    contactSubmit.disabled = true;
    contactSubmit.textContent = 'Sending...';
    contactStatus.hidden = true;
    contactStatus.textContent = '';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: {
          Accept: 'application/json'
        }
      });

      if (!response.ok) throw new Error('Form submission failed');

      contactForm.reset();
      contactStatus.textContent = 'Thanks! Your message has been sent.';
    } catch (error) {
      contactStatus.textContent = 'Something went wrong. Please try again.';
    } finally {
      contactStatus.hidden = false;
      contactSubmit.disabled = false;
      contactSubmit.textContent = 'Send Message';
    }
  });
});

// Utility: Show modal by ID
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.showModal();
  }
}

// Utility: Close modal by ID
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.close();
  }
}
