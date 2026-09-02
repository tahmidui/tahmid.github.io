/*
  Story by HTML5 UP - Converted to Vanilla JavaScript
  html5up.net | @ajlkn
  Free for personal and commercial use under the CCA 3.0 license (html5up.net/license)
*/

(function() {
  'use strict';

  const body = document.body;
  const wrapper = document.getElementById('wrapper');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Remove preload class on load
  window.addEventListener('load', function() {
    setTimeout(() => {
      body.classList.remove('is-preload');
    }, 100);
  });

  // Smooth scroll for navigation links
  function smoothScroll(target, options = {}) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;

    const offset = options.offset || 0;
    const duration = options.duration || 1000;
    const anchorMiddle = options.anchor === 'middle';

    if (reduceMotion) {
      element.scrollIntoView({
        behavior: 'auto',
        block: anchorMiddle ? 'center' : 'start'
      });
      return;
    }

    const targetRect = element.getBoundingClientRect();
    const targetTop = window.scrollY + targetRect.top - offset;
    const targetPosition = anchorMiddle ? targetTop - window.innerHeight / 2 : targetTop;

    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    let start = null;

    const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    function animation(currentTime) {
      if (start === null) start = currentTime;
      const elapsed = currentTime - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = easeInOutQuad(progress);

      window.scrollTo(0, startPosition + distance * ease);

      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    }

    requestAnimationFrame(animation);
  }

  // Attach smooth scroll to links
  document.querySelectorAll('.smooth-scroll-middle').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      smoothScroll(href, { anchor: 'middle' });
    });
  });

  document.querySelectorAll('.smooth-scroll').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const href = this.getAttribute('href');
      smoothScroll(href);
    });
  });

  // Scroll animations using Intersection Observer
  function initScrollAnimations() {
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.remove('is-inactive');
        } else {
          if (!entry.target.classList.contains('onscroll-bidirectional')) {
            entry.target.classList.add('is-inactive');
          }
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '-30px 0px -30px 0px'
    });

    // Observe wrapper sections
    if (wrapper) {
      wrapper.querySelectorAll('section').forEach(section => {
        section.classList.add('is-inactive');
        observer.observe(section);
      });
    }

    // Observe items
    document.querySelectorAll('.items').forEach(item => {
      item.classList.add('is-inactive');
      observer.observe(item);
    });

    // Observe gallery
    document.querySelectorAll('.gallery').forEach(gallery => {
      gallery.classList.add('is-inactive');
      observer.observe(gallery);
    });
  }

  // Image animations - fade in on load and scroll
  function initImageAnimations() {
    const animatedSections = document.querySelectorAll('[class*="image-fade-in"]');

    if (reduceMotion || !('IntersectionObserver' in window)) {
      animatedSections.forEach(section => {
        const image = section.querySelector('.image img');
        if (!image) return;
        image.style.opacity = '1';
        image.style.transform = 'none';
      });
      return;
    }

    animatedSections.forEach(section => {
      const image = section.querySelector('.image img');
      if (!image) return;

      if (section.classList.contains('onload-image-fade-in')) {
        image.style.opacity = '0';
        image.style.transition = 'opacity 0.6s ease-out';

        image.addEventListener('load', function() {
          setTimeout(() => {
            this.style.opacity = '1';
          }, 100);
        });

        // For cached images
        if (image.complete) {
          setTimeout(() => {
            image.style.opacity = '1';
          }, 100);
        }
      }

      if (section.classList.contains('onscroll-image-fade-in')) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              image.style.opacity = '1';
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1 });

        image.style.opacity = '0';
        image.style.transition = 'opacity 0.6s ease-out';
        observer.observe(section);
      }
    });
  }

  // Initialize gallery
  function initGallery() {
    document.querySelectorAll('.gallery').forEach(gallery => {
      // Wrap inner content
      const inner = document.createElement('div');
      inner.className = 'inner';
      while (gallery.firstChild) {
        inner.appendChild(gallery.firstChild);
      }
      gallery.appendChild(inner);

      // Add navigation buttons if not mobile
      if (!('ontouchstart' in window)) {
        const forward = document.createElement('div');
        forward.className = 'forward';
        const backward = document.createElement('div');
        backward.className = 'backward';
        gallery.insertBefore(backward, gallery.firstChild);
        gallery.insertBefore(forward, gallery.firstChild);
      }

      // Set overflow styles
      inner.style.overflowY = 'hidden';
      inner.style.overflowX = 'scroll';
      inner.scrollLeft = 0;

      // Wheel scroll handler
      inner.addEventListener('wheel', function(event) {
        event.preventDefault();
        let delta = event.deltaX * 10;

        if (delta > 0) delta = Math.min(25, delta);
        else if (delta < 0) delta = Math.max(-25, delta);

        this.scrollLeft += delta;
      });

      // Forward/Backward button handlers
      const forwardBtn = gallery.querySelector('.forward');
      const backwardBtn = gallery.querySelector('.backward');
      let moveIntervalId = null;

      if (forwardBtn) {
        forwardBtn.addEventListener('mouseenter', function() {
          clearInterval(moveIntervalId);
          moveIntervalId = setInterval(() => {
            inner.scrollLeft += 5;
          }, 10);
        });

        forwardBtn.addEventListener('mouseleave', function() {
          clearInterval(moveIntervalId);
        });
      }

      if (backwardBtn) {
        backwardBtn.addEventListener('mouseenter', function() {
          clearInterval(moveIntervalId);
          moveIntervalId = setInterval(() => {
            inner.scrollLeft -= 5;
          }, 10);
        });

        backwardBtn.addEventListener('mouseleave', function() {
          clearInterval(moveIntervalId);
        });
      }
    });

    // Lightbox functionality
    document.querySelectorAll('.gallery.lightbox').forEach(gallery => {
      // Add modal
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.tabIndex = '-1';
      modal.innerHTML = '<div class="inner"><img src="" /></div>';
      gallery.appendChild(modal);

      modal._locked = false;

      // Click on image to open modal
      gallery.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
          const href = this.getAttribute('href');
          
          if (!href.match(/\.(jpg|gif|png|mp4)$/)) return;

          e.preventDefault();
          e.stopPropagation();

          if (modal._locked) return;

          modal._locked = true;
          const modalImg = modal.querySelector('img');
          modalImg.src = href;
          modal.classList.add('visible');
          modal.focus();

          setTimeout(() => {
            modal._locked = false;
          }, 600);
        });
      });

      // Click on modal to close
      modal.addEventListener('click', function(e) {
        if (modal._locked) return;
        if (!modal.classList.contains('visible')) return;

        modal._locked = true;
        modal.classList.remove('loaded');

        setTimeout(() => {
          modal.classList.remove('visible');

          setTimeout(() => {
            const modalImg = modal.querySelector('img');
            modalImg.src = '';
            modal._locked = false;
            body.focus();
          }, 475);
        }, 125);
      });

      // Escape key to close modal
      modal.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          modal.click();
        }
      });

      // Modal image load handler
      const modalImg = modal.querySelector('img');
      modalImg.addEventListener('load', function() {
        setTimeout(() => {
          if (modal.classList.contains('visible')) {
            modal.classList.add('loaded');
          }
        }, 275);
      });
    });
  }

  // Wrap items inner
  document.querySelectorAll('.items').forEach(items => {
    items.querySelectorAll(':scope > *').forEach(child => {
      if (!child.classList.contains('inner')) {
        const inner = document.createElement('div');
        inner.className = 'inner';
        child.parentNode.insertBefore(inner, child);
        inner.appendChild(child);
      }
    });
  });

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initScrollAnimations();
      initImageAnimations();
      initGallery();
    });
  } else {
    initScrollAnimations();
    initImageAnimations();
    initGallery();
  }
})();
