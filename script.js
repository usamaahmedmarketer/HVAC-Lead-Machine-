// ── HVAC Lead Machine — Main Script ─────────────────────────────────────────────
(function () {

  // ── Tracking IDs ──
  // Paste your IDs here to switch tracking on. Empty = nothing loads and nothing is sent.
  const GA4_ID = '';          // e.g. 'G-XXXXXXXXXX'
  const META_PIXEL_ID = '';   // e.g. '1234567890123456'

  (function loadTracking() {
    if (GA4_ID) {
      const g = document.createElement('script');
      g.async = true; g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
      document.head.appendChild(g);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID);
    }
    if (META_PIXEL_ID) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', META_PIXEL_ID);
      window.fbq('track', 'PageView');
    }
  })();

  // track('scorecard_complete', {score: 72}) sends to whichever tools are switched on
  const META_EVENTS = { lead_submit: 'Lead', booking_confirmed: 'Schedule', scorecard_complete: 'CompleteRegistration' };
  function track(name, params) {
    try {
      if (window.gtag) window.gtag('event', name, params || {});
      if (window.fbq) {
        if (META_EVENTS[name]) window.fbq('track', META_EVENTS[name], params || {});
        else window.fbq('trackCustom', name, params || {});
      }
    } catch (err) {}
  }

  // ── Google Sheet endpoint ──
  const SHEET_ENDPOINT = 'YOUR_GOOGLE_SHEET_ENDPOINT';

  // Your Calendly scheduling link
  const CALENDLY_URL = 'YOUR_CALENDLY_URL';

  function sendToSheet(payload) {
    payload.page = location.pathname.replace(/^\//, '') || 'index.html';
    // text/plain avoids a CORS preflight, which Apps Script does not answer. The response is opaque
    // (no-cors), so a resolved promise means "sent", not "stored". Apps Script emails you on every save.
    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  }

  // ── Nav scroll ──
  const nav = document.querySelector('nav.main-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });
  }

  // ── Mobile menu ──
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (hamburger && mobileMenu) {
    const setMenu = (open) => {
      mobileMenu.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    hamburger.addEventListener('click', () => {
      const open = !mobileMenu.classList.contains('open');
      setMenu(open);
      if (open) { const first = mobileMenu.querySelector('a'); if (first) first.focus(); }
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) { setMenu(false); hamburger.focus(); }
    });
  }

  // ── Fade-up observer ──
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-up:not(.visible)').forEach(el => obs.observe(el));


  // ── Inline field validation (messages sit under the field and are announced) ──
  const EMAIL_RE = /^\S+@\S+\.\S+$/;
  function checkField(el, message, re) {
    const err = document.getElementById('err-' + el.id);
    const ok = re ? re.test(el.value.trim()) : !!el.value.trim();
    el.classList.toggle('invalid', !ok);
    el.classList.toggle('valid', ok);
    if (ok) el.removeAttribute('aria-invalid'); else el.setAttribute('aria-invalid', 'true');
    if (err) err.textContent = ok ? '' : message;
    return ok;
  }
  document.querySelectorAll('input[required]').forEach(function (el) {
    el.addEventListener('blur', function () {
      if (el.type === 'email') checkField(el, 'Please enter a valid email address.', EMAIL_RE);
      else checkField(el, 'Please enter your name.');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  SCORECARD QUIZ
  // ══════════════════════════════════════════════════════════════════════════
  const scorecard = document.getElementById('scorecard');
  if (scorecard) {
    const steps      = scorecard.querySelectorAll('.sc-step');
    const progressBar = scorecard.querySelector('.sc-progress-bar');
    const leadForm   = scorecard.querySelector('.sc-lead-form');
    const results    = scorecard.querySelector('.sc-results');
    const totalQ     = steps.length;
    let current      = 0;
    let answers      = {};

    const live = document.getElementById('sc-live');
    const progressWrap = scorecard.querySelector('.sc-progress');
    let startedTracked = false;

    function setProgress(pct) {
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressWrap) progressWrap.setAttribute('aria-valuenow', Math.round(pct));
    }

    function showStep(idx) {
      steps.forEach((s, i) => { s.classList.toggle('active', i === idx); });
      setProgress((idx + 1) / (totalQ + 1) * 100);
      if (live) live.textContent = 'Question ' + (idx + 1) + ' of ' + totalQ;
    }

    // Make each answer a real radio for keyboards and screen readers
    steps.forEach(function (st) {
      const group = st.querySelector('.sc-options');
      const q = st.querySelector('.sc-question');
      if (group) {
        group.setAttribute('role', 'radiogroup');
        if (q) { if (!q.id) q.id = 'q-label-' + st.dataset.q; group.setAttribute('aria-labelledby', q.id); }
      }
      const opts = st.querySelectorAll('.sc-option');
      opts.forEach(function (o, i) {
        o.setAttribute('role', 'radio');
        o.setAttribute('aria-checked', 'false');
        o.tabIndex = i === 0 ? 0 : -1;
      });
    });

    function chooseOption(opt) {
      const step = opt.closest('.sc-step');
      if (!step) return;
      step.querySelectorAll('.sc-option').forEach(function (o) {
        o.classList.remove('selected');
        o.setAttribute('aria-checked', 'false');
        o.tabIndex = -1;
      });
      opt.classList.add('selected');
      opt.setAttribute('aria-checked', 'true');
      opt.tabIndex = 0;
      answers[step.dataset.q] = parseInt(opt.dataset.val, 10);
      if (!startedTracked) { startedTracked = true; track('scorecard_start'); }
    }

    // Option click
    scorecard.addEventListener('click', function (e) {
      const opt = e.target.closest('.sc-option');
      if (opt) chooseOption(opt);
    });

    // Option keyboard: arrows move + select, Space/Enter select
    scorecard.addEventListener('keydown', function (e) {
      const opt = e.target.closest && e.target.closest('.sc-option');
      if (!opt) return;
      const opts = Array.prototype.slice.call(opt.closest('.sc-options').querySelectorAll('.sc-option'));
      let i = opts.indexOf(opt);
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); chooseOption(opt); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') i = (i + 1) % opts.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') i = (i - 1 + opts.length) % opts.length;
      else return;
      e.preventDefault();
      opts[i].focus();
      chooseOption(opts[i]);
    });

    // Next / Back
    scorecard.addEventListener('click', function (e) {
      if (e.target.closest('.sc-next')) {
        const step = steps[current];
        if (!step.querySelector('.sc-option.selected')) {
          step.querySelector('.sc-options').classList.add('sc-needs-answer');
          setTimeout(() => step.querySelector('.sc-options').classList.remove('sc-needs-answer'), 1500);
          if (live) live.textContent = 'Please choose an answer to continue';
          return;
        }
        if (current < totalQ - 1) {
          current++;
          showStep(current);
        } else {
          // Show lead form
          steps.forEach(s => s.classList.remove('active'));
          if (leadForm) {
            leadForm.classList.add('active');
            setProgress(90);
            if (live) live.textContent = 'Last step: enter your details to see your score';
          }
        }
      }
      if (e.target.closest('.sc-back')) {
        if (current > 0) {
          current--;
          showStep(current);
        }
      }
    });

    // Lead form submit → show results
    const scForm = scorecard.querySelector('.sc-lead-submit');
    if (scForm) {
      scForm.addEventListener('click', function (e) {
        e.preventDefault();
        const name  = scorecard.querySelector('[name="sc-name"]');
        const email = scorecard.querySelector('[name="sc-email"]');
        const okName = checkField(name, 'Please enter your name.');
        const okEmail = checkField(email, 'Please enter a valid email address.', EMAIL_RE);
        if (!okName || !okEmail) { (okName ? email : name).focus(); return; }

        // Calculate score from the questions actually answered
        let total = 0;
        let maxScore = Object.keys(answers).length * 3; // each question max 3 points
        if (maxScore === 0) return;
        Object.values(answers).forEach(v => total += v);
        const pct = Math.round((total / maxScore) * 100);

        // Show results
        if (leadForm) leadForm.classList.remove('active');
        if (results) {
          results.classList.add('active');
          const numEl = results.querySelector('.sc-score-num');
          if (numEl) numEl.textContent = pct;
          setProgress(100);
          if (live) live.textContent = 'Your score is ' + pct + ' percent';

          // Score label
          const labelEl = results.querySelector('.sc-score-label');
          if (labelEl) {
            if (pct >= 80) labelEl.textContent = 'Excellent';
            else if (pct >= 60) labelEl.textContent = 'Good — Room to Grow';
            else if (pct >= 40) labelEl.textContent = 'Needs Improvement';
            else labelEl.textContent = 'Critical — Leaving Money on the Table';
          }

          // Dynamic recs
          const recsEl = results.querySelector('.sc-recs');
          if (recsEl) {
            recsEl.innerHTML = '';
            const recs = [];
            if ((answers['q1'] || 0) < 2) recs.push('Your online presence needs work. A conversion-focused landing page or website could dramatically increase your lead volume.');
            if ((answers['q2'] || 0) < 2) recs.push('You\'re missing out on high-intent traffic. PPC and Meta Ads can put your business in front of homeowners actively searching for your services.');
            if ((answers['q3'] || 0) < 2) recs.push('Your social media presence is an untapped channel. Consistent posting builds trust and keeps you top-of-mind with potential customers.');
            if ((answers['q4'] || 0) < 2) recs.push('Your lead follow-up process has gaps. An appointment setting system ensures no lead falls through the cracks.');
            if ((answers['q5'] || 0) < 2) recs.push('You\'re not tracking marketing ROI effectively. Without data, you can\'t optimize spend or scale what works.');
            if ((answers['q6'] || 0) < 2) recs.push('Your reviews and reputation need attention. 90% of consumers check reviews before choosing a local HVAC contractor.');
            if ((answers['q7'] || 0) < 2) recs.push('You don\'t have a system to re-engage past customers. Repeat business is the most profitable kind.');
            if ((answers['q8'] || 0) < 2) recs.push('Your website isn\'t optimized for mobile. Over 70% of local searches happen on phones.');
            if (recs.length === 0) recs.push('Your marketing is in great shape! Let\'s talk about scaling to the next level.');
            recs.forEach(r => {
              const div = document.createElement('div');
              div.className = 'sc-rec';
              div.textContent = r;
              recsEl.appendChild(div);
            });
          }
        }

        // Send every question + the chosen answer text to the Google Sheet
        const qa = [];
        steps.forEach(function (st) {
          const q = st.querySelector('.sc-question');
          const picked = st.querySelector('.sc-option.selected');
          qa.push({
            q: q ? q.textContent.trim() : st.dataset.q,
            a: picked ? picked.textContent.trim() + ' (' + picked.dataset.val + '/3)' : ''
          });
        });
        const labelNow = results && results.querySelector('.sc-score-label');
        // Remember their details so the Book a Call step can skip re-typing them
        track('scorecard_complete', { score: pct });
        try {
          localStorage.setItem('hlm_lead', JSON.stringify({
            ts: Date.now(),
            name: name.value.trim(),
            email: email.value.trim(),
            phone: (scorecard.querySelector('[name="sc-phone"]') || {}).value || '',
            business: (scorecard.querySelector('[name="sc-business"]') || {}).value || '',
            score: pct
          }));
        } catch (err) {}
        sendToSheet({
          type: 'scorecard',
          name: name.value.trim(),
          email: email.value.trim(),
          phone: (scorecard.querySelector('[name="sc-phone"]') || {}).value || '',
          business: (scorecard.querySelector('[name="sc-business"]') || {}).value || '',
          score: pct,
          scoreLabel: labelNow ? labelNow.textContent : '',
          qa: qa
        }).catch(function (err) { console.error('Scorecard lead not saved:', err); });
      });
    }

    showStep(0);
  }



  // ── Step 2: Calendly inline booking, then record the booking in the sheet ──
  // Calendly sends one message when a slot is booked. Registered once; only trusted from calendly.com.
  let bookingWho = null;
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com') return;
    if (!e.data || e.data.event !== 'calendly.event_scheduled' || !bookingWho) return;
    const who = bookingWho;
    bookingWho = null;
    const p = e.data.payload || {};
    sendToSheet({
      type: 'booking',
      email: who.email,
      name: who.name,
      eventUri: (p.event || {}).uri || '',
      inviteeUri: (p.invitee || {}).uri || ''
    }).catch(function (err) { console.error('Booking not saved:', err); });
    track('booking_confirmed');
    try { localStorage.removeItem('hlm_lead'); } catch (err) {}
    const embedEl = document.getElementById('calendly-embed');
    const done = document.getElementById('booking-done');
    if (embedEl) embedEl.hidden = true;
    if (done) done.hidden = false;
  });

  function showBooking(name, email) {
    const step = document.getElementById('booking-step');
    const embed = document.getElementById('calendly-embed');
    const formSection = contactForm ? contactForm.closest('section') : null;
    if (!step || !embed) return;
    if (formSection) formSection.hidden = true;
    step.hidden = false;
    bookingWho = { name: name, email: email };
    window.scrollTo({ top: step.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });

    embed.innerHTML = '<div style="padding:3rem 0;color:var(--muted)">Loading calendar…</div>';
    loadCalendly().then(function () {
      embed.innerHTML = '';
      window.Calendly.initInlineWidget({
        url: CALENDLY_URL + (CALENDLY_URL.indexOf('?') > -1 ? '&' : '?') +
             'hide_gdpr_banner=1&name=' + encodeURIComponent(name) + '&email=' + encodeURIComponent(email),
        parentElement: embed
      });
    }).catch(function () {
      embed.innerHTML = '<a class="btn-main" href="' + CALENDLY_URL + '" target="_blank" rel="noopener">Pick a time →</a>';
    });
  }

  // Load Calendly's widget once, early, so the calendar opens instantly after the form is submitted.
  let calendlyPromise = null;
  function loadCalendly() {
    if (calendlyPromise) return calendlyPromise;
    calendlyPromise = new Promise(function (resolve, reject) {
      if (window.Calendly) return resolve();
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://assets.calendly.com/assets/external/widget.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
    return calendlyPromise;
  }
  if (document.querySelector('.contact-form')) {
    ['https://calendly.com', 'https://assets.calendly.com'].forEach(function (h) {
      const l = document.createElement('link'); l.rel = 'preconnect'; l.href = h; l.crossOrigin = ''; document.head.appendChild(l);
    });
    loadCalendly().catch(function () {});
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  CONTACT FORM
  // ══════════════════════════════════════════════════════════════════════════
  const contactForm = document.querySelector('.contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const nameEl = contactForm.querySelector('[name="name"]');
      const emailEl = contactForm.querySelector('[name="email"]');
      const okName = checkField(nameEl, 'Please enter your name.');
      const okEmail = checkField(emailEl, 'Please enter a valid email address.', EMAIL_RE);
      if (!okName || !okEmail) { (okName ? emailEl : nameEl).focus(); return; }

      // Every field: label text -> value, so each form question gets its own column in the sheet
      const qa = [];
      contactForm.querySelectorAll('.field-wrap').forEach(function (w) {
        const lab = w.querySelector('label');
        const inp = w.querySelector('input,select,textarea');
        if (!lab || !inp) return;
        const clone = lab.cloneNode(true);
        clone.querySelectorAll('span').forEach(function (sp) { sp.remove(); });
        qa.push({ q: clone.textContent.trim(), a: (inp.value || '').trim() });
      });

      if (contactForm.dataset.source) qa.push({ q: 'Source', a: contactForm.dataset.source });
      const payload = {
        type: 'contact',
        name: nameEl.value.trim(),
        email: emailEl.value.trim(),
        phone: (contactForm.querySelector('[name="phone"]') || {}).value || '',
        business: (contactForm.querySelector('[name="business"]') || {}).value || '',
        qa: qa
      };

      // Open the calendar instantly and save the lead in the background.
      // The form is only cleared once the send has gone out; if it fails, say so.
      showBooking(payload.name, payload.email);
      track('lead_submit');
      sendToSheet(payload).then(function () {
        contactForm.reset();
      }).catch(function (err) {
        console.error('Lead not saved:', err);
        const note = document.getElementById('booking-error');
        if (note) note.hidden = false;
      });
    });
  }

  // ── Coming from the scorecard: fill the basics automatically, ask only for the rest ──
  if (contactForm) {
    let lead = null;
    try { lead = JSON.parse(localStorage.getItem('hlm_lead') || 'null'); } catch (err) {}
    // Saved details expire after 7 days so a shared computer never shows someone else's name
    if (lead && (!lead.ts || Date.now() - lead.ts > 7 * 24 * 3600 * 1000)) {
      try { localStorage.removeItem('hlm_lead'); } catch (err) {}
      lead = null;
    }
    if (lead && lead.name && lead.email) {
      [['name', lead.name], ['email', lead.email], ['phone', lead.phone], ['business', lead.business]].forEach(function (p) {
        const el = contactForm.querySelector('[name="' + p[0] + '"]');
        if (el && !el.value && p[1]) el.value = p[1];
      });
      if (/[?&]from=scorecard/.test(location.search)) {
        contactForm.dataset.source = 'Scorecard (score ' + lead.score + '%)';
        const wraps = ['name', 'email', 'phone', 'business'].map(function (n) {
          const el = contactForm.querySelector('[name="' + n + '"]');
          return el ? el.closest('.field-wrap') : null;
        }).filter(Boolean);
        wraps.forEach(function (w) { w.hidden = true; });
        const note = document.createElement('div');
        note.className = 'prefill-note';
        note.innerHTML = '<span>Booking as <strong></strong> · <span class="pf-email"></span></span> <a href="#" class="pf-change">Not you? Edit details</a>';
        note.querySelector('strong').textContent = lead.name;
        note.querySelector('.pf-email').textContent = lead.email;
        note.querySelector('.pf-change').addEventListener('click', function (e) {
          e.preventDefault();
          wraps.forEach(function (w) { w.hidden = false; });
          note.remove();
        });
        contactForm.insertBefore(note, contactForm.firstChild);
      }
    }
  }

})();
