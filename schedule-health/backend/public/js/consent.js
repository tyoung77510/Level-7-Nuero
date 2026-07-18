// consent.js — cookie-consent banner + tracker gating. Self-contained vanilla JS (no framework,
// matching this app's zero-build-step convention), included on every page a visitor might land
// on first (the main app, the blog). Self-styled with an ordo7-consent- prefix rather than the
// host page's CSS custom properties, since the blog and the main app use different theming
// systems and this needs to look right on both without depending on either.
//
// Flow: fetch /api/public/tracking-config to see which trackers are actually configured -> if
// none are, there's nothing optional to ask consent for, so skip the banner entirely (asking a
// visitor to "customize preferences" for zero real options would be UI theater, not compliance).
// If a stored choice exists (ordo7_consent cookie), skip the banner and just apply it. Otherwise
// show Accept all / Reject non-essential / Customize, with only the categories that have a real
// tracker behind them.
(function () {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function setCookie(name, value, maxAgeSeconds) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; Path=/; Max-Age=' + maxAgeSeconds + '; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }

  function injectScript(src, async) {
    const s = document.createElement('script');
    s.src = src;
    if (async) s.async = true;
    document.head.appendChild(s);
    return s;
  }

  function loadGA4(id) {
    injectScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id), true);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id);
  }

  function loadMetaPixel(id) {
    // Standard Meta Pixel bootstrap snippet, unmodified apart from formatting.
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  function loadLinkedInInsight(partnerId) {
    window._linkedin_partner_id = partnerId;
    window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
    window._linkedin_data_partner_ids.push(partnerId);
    if (!window.lintrk) {
      window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
      window.lintrk.q = [];
    }
    injectScript('https://snap.licdn.com/li.lms-analytics/insight.min.js', true);
  }

  function applyConsent(config, consent) {
    if (consent.analytics && config.gaId) loadGA4(config.gaId);
    if (consent.marketing && config.metaPixelId) loadMetaPixel(config.metaPixelId);
    if (consent.marketing && config.linkedinPartnerId) loadLinkedInInsight(config.linkedinPartnerId);
  }

  function saveConsent(consent) {
    setCookie('ordo7_consent', JSON.stringify(consent), 63072000); // 2 years
    fetch('/api/public/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: { analytics: consent.analytics, marketing: consent.marketing } }),
      credentials: 'same-origin'
    }).catch(function () {}); // best-effort audit log — never blocks the visitor's actual choice from applying
  }

  function buildBanner(config, onChoice) {
    const style = document.createElement('style');
    style.textContent =
      '.ordo7-consent-wrap{position:fixed;left:0;right:0;bottom:0;z-index:9999;display:flex;justify-content:center;padding:16px;font-family:-apple-system,"Segoe UI",Roboto,sans-serif;}' +
      '.ordo7-consent-card{max-width:640px;width:100%;background:#0b111c;border:1px solid rgba(148,163,184,0.18);border-radius:14px;padding:20px 22px;box-shadow:0 12px 40px rgba(0,0,0,0.5);color:#e8eef6;}' +
      '.ordo7-consent-text{font-size:13.5px;line-height:1.55;color:#aab6c6;margin:0 0 14px;}' +
      '.ordo7-consent-text a{color:#5eead4;}' +
      '.ordo7-consent-actions{display:flex;gap:10px;flex-wrap:wrap;}' +
      '.ordo7-consent-btn{font-family:inherit;font-size:13px;font-weight:700;border-radius:9px;padding:9px 16px;cursor:pointer;border:1px solid rgba(148,163,184,0.22);background:transparent;color:#cdd7e3;}' +
      '.ordo7-consent-btn:hover{border-color:rgba(94,234,212,0.4);}' +
      '.ordo7-consent-btn-primary{background:linear-gradient(135deg,#5eead4,#22d3b0);color:#06231f;border:none;}' +
      '.ordo7-consent-panel{margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,0.14);display:none;}' +
      '.ordo7-consent-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px;color:#cdd7e3;}' +
      '.ordo7-consent-row small{display:block;color:#8695a8;font-size:11.5px;margin-top:2px;}' +
      '.ordo7-consent-panel.open{display:block;}';
    document.head.appendChild(style);

    const hasAnalytics = Boolean(config.gaId);
    const hasMarketing = Boolean(config.metaPixelId || config.linkedinPartnerId);

    let panelRows = '<div class="ordo7-consent-row"><span>Necessary<small>Keeps you logged in and remembers this choice. Always on.</small></span><input type="checkbox" checked disabled></div>';
    if (hasAnalytics) panelRows += '<div class="ordo7-consent-row"><span>Analytics<small>Helps us see which pages are useful.</small></span><input type="checkbox" id="ordo7ConsentAnalytics" checked></div>';
    if (hasMarketing) panelRows += '<div class="ordo7-consent-row"><span>Marketing<small>Measures ad performance across our campaigns.</small></span><input type="checkbox" id="ordo7ConsentMarketing" checked></div>';

    const wrap = document.createElement('div');
    wrap.className = 'ordo7-consent-wrap';
    wrap.innerHTML =
      '<div class="ordo7-consent-card">' +
        '<p class="ordo7-consent-text">We use cookies to keep you signed in and, if you allow it, to understand site usage and measure ad performance. See our <a href="/privacy">privacy policy</a>.</p>' +
        '<div class="ordo7-consent-actions">' +
          '<button type="button" class="ordo7-consent-btn ordo7-consent-btn-primary" id="ordo7ConsentAcceptAll">Accept all</button>' +
          '<button type="button" class="ordo7-consent-btn" id="ordo7ConsentRejectAll">Reject non-essential</button>' +
          (hasAnalytics || hasMarketing ? '<button type="button" class="ordo7-consent-btn" id="ordo7ConsentCustomizeToggle">Customize</button>' : '') +
        '</div>' +
        '<div class="ordo7-consent-panel" id="ordo7ConsentPanel">' + panelRows +
          '<div class="ordo7-consent-actions" style="margin-top:10px;"><button type="button" class="ordo7-consent-btn ordo7-consent-btn-primary" id="ordo7ConsentSave">Save preferences</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    function finish(consent) {
      wrap.remove();
      onChoice(consent);
    }

    document.getElementById('ordo7ConsentAcceptAll').addEventListener('click', function () {
      finish({ necessary: true, analytics: hasAnalytics, marketing: hasMarketing });
    });
    document.getElementById('ordo7ConsentRejectAll').addEventListener('click', function () {
      finish({ necessary: true, analytics: false, marketing: false });
    });
    const customizeBtn = document.getElementById('ordo7ConsentCustomizeToggle');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', function () {
        document.getElementById('ordo7ConsentPanel').classList.toggle('open');
      });
      document.getElementById('ordo7ConsentSave').addEventListener('click', function () {
        const analyticsEl = document.getElementById('ordo7ConsentAnalytics');
        const marketingEl = document.getElementById('ordo7ConsentMarketing');
        finish({
          necessary: true,
          analytics: analyticsEl ? analyticsEl.checked : false,
          marketing: marketingEl ? marketingEl.checked : false
        });
      });
    }
  }

  fetch('/api/public/tracking-config').then(function (r) { return r.json(); }).then(function (config) {
    const noTrackersConfigured = !config.gaId && !config.metaPixelId && !config.linkedinPartnerId;
    if (noTrackersConfigured) return; // nothing optional to consent to yet

    const stored = getCookie('ordo7_consent');
    if (stored) {
      try { applyConsent(config, JSON.parse(stored)); } catch (e) {}
      return;
    }
    buildBanner(config, function (consent) {
      saveConsent(consent);
      applyConsent(config, consent);
    });
  }).catch(function () {}); // if tracking-config itself is unreachable, fail silently -- no banner, no trackers, same as "nothing configured"
})();
