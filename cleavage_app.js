/* ========================================================================
   Civitas Helvetica Publica — Cleavage-Tour
   Single-Prompt-Demo: Kapitalfreundlichkeit aller Schweizer Gemeinden
   im Zeitvergleich (Pilotversuch 1.2 · Mai 2026)
   ======================================================================== */
(function () {
  'use strict';

  const STORAGE_KEY = 'civitaschat-state-v22-cleavage';
  const BUNDLE_URL  = 'data/cleavage_bundle_v1.json';

  // ---- Plug-in registry. Future analyses can register more renderers. ----
  const PLUGINS = {};
  function registerPlugin(name, fn) { PLUGINS[name] = fn; }

  // =========================================================================
  // Streaming HTML typer with stable cursor
  // =========================================================================
  function typeHtml(target, html, baseSpeed = 6) {
    return new Promise(resolve => {
      target.innerHTML = '';
      const cursor = document.createElement('span');
      cursor.className = 'type-cursor';
      target.appendChild(cursor);

      let i = 0;
      let open = target;
      const stack = [target];
      const tagBuf = [];
      let inTag = false;

      function step() {
        if (i >= html.length) {
          cursor.remove();
          resolve();
          return;
        }
        const c = html[i];
        if (c === '<') {
          inTag = true;
          tagBuf.length = 0;
          tagBuf.push(c);
          i++;
          step();
          return;
        }
        if (inTag) {
          tagBuf.push(c);
          if (c === '>') {
            const tag = tagBuf.join('');
            inTag = false;
            // Parse tag
            const m = tag.match(/^<\/?\s*([a-zA-Z0-9]+)([^>]*)\/?>$/);
            if (m) {
              const name = m[1].toLowerCase();
              const isClose = tag.startsWith('</');
              const isSelfClose = /\/\s*>$/.test(tag) || ['br','hr','img'].includes(name);
              if (isClose) {
                stack.pop();
                open = stack[stack.length - 1] || target;
                cursor.remove();
                open.appendChild(cursor);
              } else {
                const el = document.createElement(name);
                // crude attribute parser
                const attrRe = /([a-zA-Z\-]+)(?:="([^"]*)")?/g;
                let am;
                while ((am = attrRe.exec(m[2]))) {
                  if (['type','name','href','class','id','style','src','alt','data-cluster','data-phase','data-vid'].indexOf(am[1]) >= 0
                      || am[1].startsWith('data-')
                      || am[1] === 'aria-label') {
                    el.setAttribute(am[1], am[2] || '');
                  }
                }
                cursor.before(el);
                if (!isSelfClose) {
                  stack.push(el);
                  open = el;
                  cursor.remove();
                  open.appendChild(cursor);
                }
              }
            }
            i++;
            scheduleStep();
            return;
          }
          i++;
          step();
          return;
        }
        // text char (with HTML entity decode)
        if (c === '&') {
          // capture up to ; (max 8 chars)
          let end = html.indexOf(';', i);
          if (end !== -1 && end - i <= 8) {
            const ent = html.slice(i, end + 1);
            const map = {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':'\u00a0','&ndash;':'–','&mdash;':'—','&minus;':'−','&uuml;':'ü','&ouml;':'ö','&auml;':'ä','&szlig;':'ß'};
            const decoded = map[ent] || ent;
            const txt = document.createTextNode(decoded);
            cursor.before(txt);
            i = end + 1;
            scheduleStep();
            return;
          }
        }
        const txt = document.createTextNode(c);
        cursor.before(txt);
        i++;
        scheduleStep();
      }
      function scheduleStep() {
        const speed = baseSpeed + Math.random() * baseSpeed;
        setTimeout(step, speed);
      }
      step();
    });
  }

  // =========================================================================
  // Chat-stream primitives
  // =========================================================================
  const streamEl = () => document.getElementById('chatStream');

  function appendUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-user';
    el.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
    streamEl().appendChild(el);
    return el;
  }

  function appendAssistantBubble() {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-assistant';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble msg-bubble-assistant';
    el.appendChild(bubble);
    streamEl().appendChild(el);
    return bubble;
  }

  function appendThinkingBubble() {
    const el = document.createElement('div');
    el.className = 'chat-msg chat-msg-assistant';
    el.innerHTML = `<div class="msg-bubble msg-bubble-thinking">
      <span class="dot-pulse"></span>
      <span class="thinking-text"></span>
    </div>`;
    streamEl().appendChild(el);
    return el;
  }

  async function cycleThinking(bubble, stages, perStageMs = 850) {
    const txt = bubble.querySelector('.thinking-text');
    for (const s of stages) {
      txt.textContent = s;
      await sleep(perStageMs);
    }
    bubble.remove();
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // =========================================================================
  // Trust-card updater
  // =========================================================================
  let _trustNoteToken = 0;
  async function updateTrust(value, sources, note) {
    const card = document.getElementById('trustCard');
    card.classList.remove('collapsed');
    const fill = document.getElementById('trustBarFill');
    const val  = document.getElementById('trustValue');
    const noteEl = document.getElementById('trustNote');
    const cntEl = document.getElementById('sourcesCount');
    if (cntEl) cntEl.textContent = sources;

    fill.style.width = value + '%';
    const startVal = parseInt(val.textContent) || 0;
    const endVal   = value;
    const steps = 30;
    for (let i = 0; i < steps; i++) {
      val.textContent = Math.round(startVal + (endVal - startVal) * (i + 1) / steps) + ' %';
      await sleep(18);
    }
    val.textContent = endVal + ' %';

    const myToken = ++_trustNoteToken;
    noteEl.style.opacity = '0';
    await sleep(220);
    if (myToken !== _trustNoteToken) return;
    noteEl.textContent = '';
    noteEl.style.opacity = '1';
    for (const ch of note) {
      if (myToken !== _trustNoteToken) return;
      noteEl.textContent += ch;
      await sleep(8 + Math.random() * 6);
    }
  }

  function revealContextCards() {
    document.querySelectorAll('.chat-context .ctx-card.collapsed').forEach(c => c.classList.remove('collapsed'));
  }

  // =========================================================================
  // Auto-scroll that follows generated content
  // =========================================================================
  let userScrolledUp = false;
  let lastAutoScrollY = 0;
  const streamWrap = () => document.querySelector('.chat-stream');
  if (streamWrap()) {
    streamWrap().addEventListener('scroll', () => {
      const sw = streamWrap();
      const nearBottom = (sw.scrollTop + sw.clientHeight) >= (sw.scrollHeight - 80);
      if (nearBottom) userScrolledUp = false;
      else if (Math.abs(sw.scrollTop - lastAutoScrollY) > 30) userScrolledUp = true;
    });
  }
  function scrollStream() {
    if (userScrolledUp) return;
    const sw = streamWrap();
    if (!sw) return;
    sw.scrollTop = sw.scrollHeight;
    lastAutoScrollY = sw.scrollTop;
  }
  // Re-scroll periodically while typing
  setInterval(scrollStream, 200);

  // =========================================================================
  // COLOR SCALE for divergent index (kapitalfeindlich .. kapitalfreundlich)
  // Skala: ±8 pp für kumulierten Index, ±15 pp für frühe Phasen
  // =========================================================================
  function divergingColor(val, scale = 8) {
    // -scale → rot, 0 → neutral, +scale → mint
    const stops = [
      { v: -1.00, c: [126, 46, 34] },   // #7e2e22
      { v: -0.50, c: [187, 110, 92] },  // #bb6e5c
      { v: -0.20, c: [212, 157, 140] }, // #d49d8c
      { v:  0.00, c: [202, 197, 188] }, // neutral beige-grey
      { v:  0.20, c: [165, 215, 210] }, // #a5d7d2
      { v:  0.50, c: [90, 157, 150] },  // #5a9d96
      { v:  1.00, c: [53, 119, 112] }   // #357770
    ];
    const t = Math.max(-1, Math.min(1, val / scale));
    let lo = stops[0], hi = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].v && t <= stops[i + 1].v) { lo = stops[i]; hi = stops[i + 1]; break; }
    }
    const f = (t - lo.v) / Math.max(1e-9, (hi.v - lo.v));
    const c = lo.c.map((x, i) => Math.round(x + (hi.c[i] - x) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // =========================================================================
  // BUNDLE LOADER
  // =========================================================================
  let BUNDLE = null;
  async function loadBundle() {
    if (BUNDLE) return BUNDLE;
    // Prefer the inline-loaded bundle (works under file://); fall back to fetch.
    if (typeof window !== 'undefined' && window.CLEAVAGE_BUNDLE) {
      BUNDLE = window.CLEAVAGE_BUNDLE;
      return BUNDLE;
    }
    try {
      const res = await fetch(BUNDLE_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      BUNDLE = await res.json();
      return BUNDLE;
    } catch (e) {
      throw new Error('Datenbasis nicht geladen. Wenn du chat.html lokal öffnest, brauchen wir entweder data/cleavage_bundle_v1.js (inline-Variante) oder einen lokalen HTTP-Server. Original-Fehler: ' + e.message);
    }
  }

  // =========================================================================
  // MAIN MAP RENDERER (oben rechts) — kumulierter Index
  // =========================================================================
  function renderMainMap() {
    const wrap = document.getElementById('swissMap');
    if (!wrap) return;
    const svg = wrap.querySelector('svg');
    const tooltip = document.getElementById('mapTooltip');
    const lookup = BUNDLE.lookup;
    const data = BUNDLE.data;

    svg.querySelectorAll('.commune').forEach(p => {
      const name = p.dataset.name;
      const ktkz = p.dataset.ktkz;
      const mid  = lookup[`${ktkz}|${name}`];
      const rec  = mid && data[mid];
      if (!rec || rec.idx_kum == null) {
        p.setAttribute('fill', '#1e242a');
        p.setAttribute('stroke', '#1e242a');
        return;
      }
      const idx = rec.idx_kum;
      const c = divergingColor(idx, 6);
      p.setAttribute('fill', c);
      p.setAttribute('stroke', c);
      p.dataset.idx = idx;
      p.dataset.cluster = rec.cluster != null ? rec.cluster : '';
      p.addEventListener('mouseenter', () => {
        const sign = idx >= 0 ? '+' : '';
        tooltip.innerHTML = `<strong>${name} (${ktkz})</strong>Kapitalfreundlichkeits-Index: ${sign}${idx.toFixed(2)} pp<br/>Cluster: ${BUNDLE.clusters[rec.cluster] ? BUNDLE.clusters[rec.cluster].label : '—'}`;
        tooltip.style.opacity = '1';
      });
      p.addEventListener('mousemove', e => {
        const r = wrap.getBoundingClientRect();
        tooltip.style.left = (e.clientX - r.left) + 'px';
        tooltip.style.top  = (e.clientY - r.top - 8) + 'px';
      });
      p.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
    });
  }

  // =========================================================================
  // PLUGIN 1: Cluster-Übersicht
  // =========================================================================
  registerPlugin('clusters', () => {
    const cs = BUNDLE.clusters;
    const phaseLabels = BUNDLE.phases.map(p => p.code);
    let html = '<div class="viz-cluster-grid">';
    cs.forEach(c => {
      const sparkline = miniTrajectory(c.centroid_pp, c.color);
      html += `
        <div class="cluster-card" data-cluster="${c.id}" style="border-left: 4px solid ${c.color}">
          <div class="cluster-head">
            <span class="cluster-name">${c.label}</span>
            <span class="cluster-n">${c.n} Gemeinden</span>
          </div>
          <div class="cluster-spark">${sparkline}</div>
          <div class="cluster-summary">${c.summary}</div>
        </div>`;
    });
    html += '</div>';
    return html;
  });

  function miniTrajectory(vals, color) {
    const W = 220, H = 60, pad = 8;
    const min = -15, max = 18;
    const xs = vals.map((_, i) => pad + i * (W - 2 * pad) / (vals.length - 1));
    const ys = vals.map(v => H - pad - ((v - min) / (max - min)) * (H - 2 * pad));
    const zeroY = H - pad - ((0 - min) / (max - min)) * (H - 2 * pad);
    const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join('');
    const dots = xs.map((x, i) => `<circle cx="${x.toFixed(1)}" cy="${ys[i].toFixed(1)}" r="2.4" fill="${color}"/>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="spark-svg">
      <line x1="${pad}" y1="${zeroY}" x2="${W - pad}" y2="${zeroY}" stroke="rgba(255,255,255,0.15)" stroke-dasharray="2,3"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>
      ${dots}
    </svg>`;
  }

  // =========================================================================
  // PLUGIN 2: Trajektorien-Plot (Cluster über Phasen)
  // =========================================================================
  registerPlugin('trajectories', () => {
    const cs = BUNDLE.clusters;
    const W = 720, H = 340;
    const padL = 78, padR = 18, padT = 24, padB = 70;
    const phases = BUNDLE.phases;
    const xStep = (W - padL - padR) / (phases.length - 1);
    const yMin = -10, yMax = 20;
    const y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
    const x = i => padL + i * xStep;

    let lines = '';
    let dots  = '';
    cs.forEach(c => {
      const pts = c.centroid_pp;
      const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('');
      lines += `<path d="${path}" fill="none" stroke="${c.color}" stroke-width="2.2" opacity="0.92" pointer-events="none"/>`;
      pts.forEach((p, i) => {
        dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="3.5" fill="${c.color}" pointer-events="none"/>`;
      });
    });
    // x-axis labels and gridlines (kompakt: Phasencode + Jahre; voller Name im Tooltip)
    let xAxis = '';
    phases.forEach((p, i) => {
      const xv = x(i).toFixed(1);
      xAxis += `<line x1="${xv}" y1="${y(yMin).toFixed(1)}" x2="${xv}" y2="${y(yMax).toFixed(1)}" stroke="rgba(255,255,255,0.06)"/>`;
      xAxis += `<text x="${xv}" y="${H - padB + 20}" fill="var(--text)" font-size="11" font-weight="600" text-anchor="middle">${p.code}</text>`;
      xAxis += `<text x="${xv}" y="${H - padB + 36}" fill="var(--text-dim)" font-size="10" text-anchor="middle">${p.from}-${p.to}</text>`;
    });
    // y-axis
    let yAxis = '';
    for (let v = yMin; v <= yMax; v += 5) {
      const yv = y(v).toFixed(1);
      yAxis += `<line x1="${padL}" y1="${yv}" x2="${W - padR}" y2="${yv}" stroke="rgba(255,255,255,0.05)"/>`;
      yAxis += `<text x="${padL - 8}" y="${(parseFloat(yv) + 3).toFixed(1)}" fill="var(--text-dim)" font-size="10" text-anchor="end">${v > 0 ? '+' : ''}${v}</text>`;
    }
    yAxis += `<line x1="${padL}" y1="${y(0).toFixed(1)}" x2="${W - padR}" y2="${y(0).toFixed(1)}" stroke="rgba(255,255,255,0.25)" stroke-dasharray="3,3"/>`;

    const labelMidY = ((padT + (H - padB)) / 2).toFixed(1);
    const plotW = (W - padL - padR).toFixed(1);
    const plotH = (H - padT - padB).toFixed(1);
    return `<div class="viz-trajectories">
      <svg class="traj-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        ${yAxis}
        ${xAxis}
        ${lines}
        ${dots}
        <text x="18" y="${labelMidY}" fill="var(--text-muted)" font-size="10" text-anchor="middle" transform="rotate(-90 18 ${labelMidY})">Index (pp Abweichung vom CH-Schnitt)</text>
        <rect class="hit" x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="transparent"/>
        <g class="tl-hover" style="display:none"></g>
      </svg>
      <div class="viz-caption">Centroid-Trajektorien der fuenf Cluster ueber die sechs Phasen. Bewege den Zeiger ueber die Grafik, um Phase, Zeitraum und alle Cluster-Werte zu sehen. Die Spreizung kollabiert sichtbar - in P1 reicht sie von -9 bis +11 pp, in P6 nur noch von -2 bis +3 pp.</div>
    </div>`;
  });

  // Post-Render: Hover-Tooltip-Verhalten fuer Trajektorien-Punkte
  function wireTrajectoriesTooltip(wrap) {
    const root = wrap.querySelector('.viz-trajectories');
    if (!root) return;
    const svg = root.querySelector('svg.traj-svg') || root.querySelector('svg');
    if (!svg) return;
    const hit = svg.querySelector('rect.hit');
    const hover = svg.querySelector('g.tl-hover');
    if (!hit || !hover) return;

    const SVGNS = 'http://www.w3.org/2000/svg';
    const cs = BUNDLE.clusters;
    const phases = BUNDLE.phases;
    const W = 720, H = 340;
    const padL = 78, padR = 18, padT = 24, padB = 70;
    const xStep = (W - padL - padR) / (phases.length - 1);
    const yMin = -10, yMax = 20;
    const y = v => padT + (1 - (v - yMin) / (yMax - yMin)) * (H - padT - padB);
    const x = i => padL + i * xStep;

    // Aufraeumen, falls renderStep idempotent erneut aufgerufen wird
    while (hover.firstChild) hover.removeChild(hover.firstChild);

    // Vertikale Guideline ueber die gesamte Plotflaeche
    const guide = document.createElementNS(SVGNS, 'line');
    guide.setAttribute('class', 'tl-line');
    guide.setAttribute('y1', padT);
    guide.setAttribute('y2', H - padB);
    hover.appendChild(guide);

    // Pro Cluster ein hervorgehobener Punkt (oben drueber)
    const clusterDots = cs.map(c => {
      const d = document.createElementNS(SVGNS, 'circle');
      d.setAttribute('class', 'tl-dot');
      d.setAttribute('r', '4.5');
      d.setAttribute('fill', c.color);
      d.setAttribute('stroke', '#ffffff');
      d.setAttribute('stroke-width', '1.6');
      hover.appendChild(d);
      return d;
    });

    // Label-Box (Hintergrund + Text)
    const labelBg = document.createElementNS(SVGNS, 'rect');
    labelBg.setAttribute('class', 'tl-label-bg');
    labelBg.setAttribute('rx', '5'); labelBg.setAttribute('ry', '5');
    hover.appendChild(labelBg);

    const labelHead = document.createElementNS(SVGNS, 'text');
    labelHead.setAttribute('class', 'tl-label-head');
    labelHead.setAttribute('text-anchor', 'start');
    hover.appendChild(labelHead);

    const labelSub = document.createElementNS(SVGNS, 'text');
    labelSub.setAttribute('class', 'tl-label-sub');
    labelSub.setAttribute('text-anchor', 'start');
    hover.appendChild(labelSub);

    // Pro Cluster eine Zeile (farbiges Quadrat + Cluster-Name + Wert)
    const rows = cs.map(() => {
      const sw = document.createElementNS(SVGNS, 'rect');
      sw.setAttribute('class', 'tl-row-sw');
      sw.setAttribute('width', '7'); sw.setAttribute('height', '7'); sw.setAttribute('rx', '1');
      const nm = document.createElementNS(SVGNS, 'text');
      nm.setAttribute('class', 'tl-row-name');
      nm.setAttribute('text-anchor', 'start');
      const vl = document.createElementNS(SVGNS, 'text');
      vl.setAttribute('class', 'tl-row-val');
      vl.setAttribute('text-anchor', 'end');
      hover.appendChild(sw); hover.appendChild(nm); hover.appendChild(vl);
      return { sw, nm, vl };
    });

    const ROW_H = 14;
    const HEAD_H = 30;     // Header (Phase-Code + Zeitraum)
    const BOX_W = 220;
    const BOX_H = HEAD_H + rows.length * ROW_H + 10;

    function update(e) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const loc = pt.matrixTransform(ctm.inverse());
      // Naechstgelegene Phase in x-Richtung
      let nearest = 0, best = Infinity;
      for (let i = 0; i < phases.length; i++) {
        const d = Math.abs(x(i) - loc.x);
        if (d < best) { best = d; nearest = i; }
      }
      const xv = x(nearest);
      const ph = phases[nearest];

      hover.style.display = 'block';
      guide.setAttribute('x1', xv);
      guide.setAttribute('x2', xv);

      // Per-Cluster-Dots + Zeilen befuellen, nach Wert absteigend sortiert
      const items = cs.map((c, ci) => ({
        c, ci,
        val: c.centroid_pp[nearest],
        cy: y(c.centroid_pp[nearest])
      })).sort((a, b) => b.val - a.val);

      items.forEach((it, idx) => {
        const dot = clusterDots[it.ci];
        dot.setAttribute('cx', xv);
        dot.setAttribute('cy', it.cy);
        const row = rows[idx];
        row.sw.setAttribute('fill', it.c.color);
        row.nm.textContent = it.c.label;
        const sign = it.val > 0 ? '+' : '';
        row.vl.textContent = sign + it.val.toFixed(2) + ' pp';
      });

      // Label-Box positionieren: bevorzugt rechts vom Guide, sonst links
      let bx = xv + 12;
      if (bx + BOX_W > W - padR) bx = xv - 12 - BOX_W;
      if (bx < padL) bx = padL + 4;
      let by = padT + 8;
      // Falls die Box den hoechsten Punkt verdeckt, leicht nach unten schieben
      const minY = Math.min(...items.map(it => it.cy));
      if (by + HEAD_H > minY - 6) by = Math.min(H - padB - BOX_H - 4, minY + 12);
      if (by < padT + 2) by = padT + 2;

      labelBg.setAttribute('x', bx);
      labelBg.setAttribute('y', by);
      labelBg.setAttribute('width', BOX_W);
      labelBg.setAttribute('height', BOX_H);

      labelHead.setAttribute('x', bx + 10);
      labelHead.setAttribute('y', by + 14);
      labelHead.textContent = ph.code + '  ' + ph.from + '\u2013' + ph.to;

      labelSub.setAttribute('x', bx + 10);
      labelSub.setAttribute('y', by + 26);
      labelSub.textContent = ph.name;

      items.forEach((it, idx) => {
        const row = rows[idx];
        const yLine = by + HEAD_H + idx * ROW_H + 9;
        row.sw.setAttribute('x', bx + 10);
        row.sw.setAttribute('y', yLine - 6);
        row.nm.setAttribute('x', bx + 22);
        row.nm.setAttribute('y', yLine);
        row.vl.setAttribute('x', bx + BOX_W - 10);
        row.vl.setAttribute('y', yLine);
      });
    }

    hit.addEventListener('mousemove', update);
    hit.addEventListener('mouseleave', () => { hover.style.display = 'none'; });
    // Tap auf Touch: kurz einblenden
    hit.addEventListener('click', update);
  }

  // =========================================================================
  // PLUGIN 3: Phasen-Heatmap als Karten-Multiples
  // =========================================================================
  registerPlugin('phaseMaps', () => {
    const phases = BUNDLE.phases;
    let html = '<div class="viz-phasemaps">';
    phases.forEach(p => {
      // The actual SVGs are filled by JS after insertion, so we just create
      // placeholder <div class="mini-map" data-phase="..."></div>
      html += `
        <div class="mini-map-wrap">
          <div class="mini-map-title">${p.from}–${p.to} <span class="mini-map-name">${p.name}</span></div>
          <div class="mini-map" data-phase="${p.code}"></div>
        </div>`;
    });
    html += '</div>';
    html += `<div class="viz-caption">Pro Phase: Abweichung jeder Gemeinde vom Schweizer Schnitt. Farbskala: rot −15 pp — mint +15 pp. Die Innerschweiz dreht zwischen P1 und P2 von kapitalfeindlich auf kapitalfreundlich; die Romandie folgt 1891–1918 als Industrie-Hochburg, fällt dann zurück. Heute (P6) hat sich die Schweiz weitgehend angeglichen.</div>`;
    return html;
  });

  // After phaseMaps HTML is inserted, populate the mini-maps with cloned SVGs
  function paintPhaseMaps(container) {
    const masterSvg = document.querySelector('#swissMap svg');
    if (!masterSvg) return;
    container.querySelectorAll('.mini-map').forEach(slot => {
      const phase = slot.dataset.phase;
      const clone = masterSvg.cloneNode(true);
      clone.removeAttribute('aria-label');
      clone.setAttribute('class', 'phase-svg');
      // colorize communes by this phase's idx
      const lookup = BUNDLE.lookup;
      const data = BUNDLE.data;
      clone.querySelectorAll('.commune').forEach(p => {
        const mid = lookup[`${p.dataset.ktkz}|${p.dataset.name}`];
        const rec = mid && data[mid];
        const phRec = rec && rec.phases[phase];
        if (!phRec) {
          p.setAttribute('fill', '#1e242a');
          p.setAttribute('stroke', '#1e242a');
          return;
        }
        const scale = (phase === 'P1' || phase === 'P2') ? 18 : 8;
        const c = divergingColor(phRec.idx, scale);
        p.setAttribute('fill', c);
        p.setAttribute('stroke', c);
      });
      // Strip the interactive bits from clones — they don't need tooltips
      slot.appendChild(clone);
    });
  }

  // =========================================================================
  // PLUGIN 4: Methodische Einschränkungen
  // =========================================================================
  registerPlugin('limitations', () => {
    return `<div class="viz-limitations">
      <p><strong>Diese Antwort basiert auf einer Pilot-Codierung (Pilotversuch 1.2)</strong>, die einer systematischen Robustheitsprüfung noch nicht standgehalten hat. Fünf Limitationen sind zu beachten:</p>
      <ul class="limit-list">
        <li><strong>LLM-Klassifikations-Bias.</strong> Pilotversuch 1.2 vergibt 67 % negative und 29 % positive Scores. Im Anker-Test gegen die im Methodik-Paper definierten 16 Skalenanker stimmen 7 von 16 LLM-Scores exakt überein. Das volle 2&times;2-Design (Run A–D) ist noch ausstehend; der Konsens-Score wird später aus jener Bedingung gebildet, die in der Expert-Validierung am besten abschneidet.</li>
        <li><strong>Vorlagen-Anzahl pro Phase ist ungleich.</strong> P1 (1848–1890) basiert auf 32 Vorlagen, P6 (1992–2026) auf 306. Die hohe Spreizung im 19. Jahrhundert (SD &asymp; 12 pp) ist teilweise inhärente Volatilität bei wenigen Beobachtungen.</li>
        <li><strong>Gemeindefusionen.</strong> Daten sind auf den Stand 2023 rückprojiziert. Für 237 historische Konstellationen (insb. 1866–1900 und einzelne 1970er-Initiativen) weicht das Panel-Aggregat um mehr als 5 Prozentpunkte vom offiziellen Kantonsresultat ab; betroffen sind überproportional FR, BE, BL und AI.</li>
        <li><strong>Aggregat- statt Individualebene.</strong> Der Index beschreibt das Abstimmungsverhalten von Gemeinden, nicht von einzelnen Stimmenden (klassischer ökologischer Fehlschluss). Individualdaten (CIVITAS/VOTO ab 1977, FORS) sind in dieser Klassifikationsrunde nicht integriert.</li>
        <li><strong>Sprachregion und Konfession sind aktuell nicht im Modell.</strong> Strukturvariablen auf Gemeindeebene (Spracherhebung, Konfession, Urbanität, Einkommen) werden als eigener Daten-Slot nachgereicht. Bis dahin bleiben die Cluster geographisch interpretiert, nicht strukturell erklärt.</li>
      </ul>
    </div>`;
  });

  // =========================================================================
  // Render a step from the analysis transcript
  // =========================================================================
  async function renderStep(step) {
    // optional thinking
    if (step.thinking_stages && step.thinking_stages.length) {
      const tb = appendThinkingBubble();
      await cycleThinking(tb, step.thinking_stages, 750);
    }
    const bubble = appendAssistantBubble();
    // Intro text
    if (step.html) {
      await typeHtml(bubble, step.html, 5);
    }
    // Plug-in viz?
    if (step.plugin) {
      const fn = PLUGINS[step.plugin];
      if (fn) {
        const html = fn(step.config || {});
        const wrap = document.createElement('div');
        wrap.className = 'viz-wrap';
        wrap.innerHTML = html;
        bubble.appendChild(wrap);
        // Post-render hook for phaseMaps (needs DOM access to inject cloned SVGs)
        if (step.plugin === 'phaseMaps') {
          paintPhaseMaps(wrap);
        }
        if (step.plugin === 'trajectories') {
          wireTrajectoriesTooltip(wrap);
        }
        await sleep(180);
      }
    }
    // Caption / coda
    if (step.coda) {
      const codaEl = document.createElement('div');
      codaEl.className = 'viz-coda';
      bubble.appendChild(codaEl);
      await typeHtml(codaEl, step.coda, 5);
    }
    // Update trust card
    if (step.trust) {
      await updateTrust(step.trust.value, step.trust.sources, step.trust.note);
    }
    await sleep(450);
  }

  // =========================================================================
  // The single demo tour: 4 steps
  // =========================================================================
  function buildTour() {
    return [
      {
        // INTRO
        thinking_stages: [
          'Frage wird interpretiert',
          'Korpus geladen: 708 Vorlagen, 2 157 Gemeinden, 1866–2026',
          'LLM-Scoring abgerufen (Pilotversuch 1.2 · Mistral Large 3.0)',
          'Index pro Gemeinde &times; Phase wird berechnet'
        ],
        html: `
<p>Ich verrechne für jede Gemeinde ihren <strong>Ja-Anteil pro Vorlage</strong> mit dem <strong>LLM-Kapitalfreundlichkeits-Score</strong> der Vorlage und mittele über alle 704 Vorlagen seit 1848<span class="cite">1</span>. Der Index ist <strong>relativ zum Schweizer Schnitt</strong> definiert: eine Gemeinde, die wie das ganze Land abstimmt, hat einen Index von 0 pp. Damit ist der Status-quo-Bias der direkten Demokratie — viele Initiativen werden generell abgelehnt — bereits absorbiert.</p>
<p>Die Karte oben rechts zeigt diese kumulierte Abweichung über alle 158 Jahre auf einen Blick. Mint = die Gemeinde stimmt systematisch kapitalfreundlicher als der CH-Schnitt; rot = kapitalfeindlicher.</p>`,
        trust: {
          value: 62,
          sources: 6,
          note: 'Pilot-Codierung. LLM-Score gegen 7 von 16 Ankerbeispielen exakt korrekt. Volle 2×2-Robustheitsprüfung steht aus.'
        }
      },
      {
        // SCHRITT 1 — Cluster-Gruppierung
        thinking_stages: [
          'Gemeinden werden auf z-standardisierten 6-Phasen-Vektoren gruppiert',
          'k-means k=5 wird ausgeführt (Inertia 5 787)',
          'Cluster werden nach P6-Index sortiert'
        ],
        html: `
<h3 class="step-h">1. Gruppierung nach Stimmverhalten</h3>
<p>Ich gruppiere die 1 926 Gemeinden mit vollständigen Daten in <strong>fünf Cluster</strong>, basierend auf ihrem Index-Profil über die sechs Phasen<span class="cite">2</span>. Jeder Cluster steht für eine typische historische Trajektorie:</p>`,
        plugin: 'clusters',
        coda: `<p>Die Cluster bilden die etablierten Lager der Schweizer Politgeographie ab: ein kapitalfeindlicher Tessiner-urbaner Block, zwei kapitalfreundliche Pioniergruppen mit gegensätzlicher Geschichte, eine Romandie-Welle und der nachhaltige Schwenk der Innerschweiz vom Sonderbund-Erbe zur bürgerlichen Konstanz.</p>`,
        trust: {
          value: 68,
          sources: 6,
          note: 'Clustering datenbasiert (k-means k=5). Cluster-Beschreibungen folgen aus den Centroid-Trajektorien — kein externes Labeling.'
        }
      },
      {
        // SCHRITT 2 — Verlauf über die Zeit
        thinking_stages: [
          'Phasen-Centroids werden geplottet',
          'Sechs Wendepunkte werden auf der Zeitachse markiert (1848, 1891, 1919, 1948, 1972, 1992)'
        ],
        html: `
<h3 class="step-h">2. Verlauf über die Zeit</h3>
<p>Die folgenden Linien zeigen, wie sich der durchschnittliche Index jedes Clusters über die sechs Phasen entwickelt — vom liberalen Bundesstaat (1848–1890) bis zur Globalisierungs-Gegenwart (1992–2026)<span class="cite">3</span>:</p>`,
        plugin: 'trajectories',
        coda: `<p>Zwei strukturelle Befunde springen ins Auge. Erstens: die <strong>Spreizung kollabiert</strong>. In P1 stehen die Cluster bis zu 20 pp auseinander, in P6 nur noch 5 pp. Die Schweiz ist auf der Kapitalfreundlichkeits-Achse <em>strukturell homogener</em> geworden. Zweitens: die <strong>Innerschweiz dreht zwischen P1 und P2</strong> — von −8.5 pp zu +4.6 pp. Das ist die historisch dokumentierte Integration des katholisch-konservativen Lagers in den bürgerlichen Block nach dem Generalstreik 1918.</p>`,
        trust: {
          value: 71,
          sources: 6,
          note: 'Verlauf statistisch robust. Phase 1 mit 32 Vorlagen am dünnsten (SD ±12 pp), Phase 6 mit 306 Vorlagen am stabilsten (SD ±2 pp).'
        }
      },
      {
        // SCHRITT 3 — Heatmap auf Schweizerkarte
        thinking_stages: [
          'Gemeindegeometrie wird für jede Phase eingefärbt',
          'Sechs Karten-Multiples werden generiert',
          'Farbskala wird pro Phase auf SD-Quantile kalibriert'
        ],
        html: `
<h3 class="step-h">3. Räumliche Heatmap pro Phase</h3>
<p>Der Cluster-Plot abstrahiert das Bild auf fünf Centroid-Linien. Die folgenden sechs Schweizer Karten zeigen das <strong>ganze Auflösungsbild auf Gemeindeebene</strong>, eine Karte pro Phase:</p>`,
        plugin: 'phaseMaps',
        coda: `<p>Auffällig: P1 hat die <strong>grössten regionalen Kontraste</strong> — tiefblaue Innerschweiz und dunkelmint umrandete liberale Reformkantone (Zürich, Bern). Ab P2 verschiebt sich der Schwerpunkt: die Romandie wird zur mint-dominierten Industrie-Hochburg. P3 ist die Krisenzeit, mit Freiburg und Aargau als überraschend kapitalfreundlichen Lagern. Ab P4 verflacht das Bild zunehmend; P6 ist fast eine Schweiz in Pastell.</p>`,
        trust: {
          value: 74,
          sources: 6,
          note: 'Karten direkt aus dem Panel gerechnet. Für 6 Gemeinden ist der SVG-Pfad fusion-bedingt nicht joinbar; sie erscheinen dunkel.'
        }
      },
      {
        // SCHRITT 4 — Methodische Einschränkungen
        thinking_stages: [
          'Vertrauensindex wird auf Grundlage der Validierungs-Stratifikation aktualisiert',
          'Limitationen werden expliziert'
        ],
        html: `
<h3 class="step-h">4. Methodische Einschränkungen</h3>`,
        plugin: 'limitations',
        trust: {
          value: 62,
          sources: 6,
          note: 'Pilot-Codierung. Aussagen sind belastbar als deskriptive Befunde aus diesem Run, nicht als final validierte Ergebnisse.'
        }
      }
    ];
  }

  // =========================================================================
  // Boot
  // =========================================================================
  async function run() {
    try {
      await loadBundle();
      renderMainMap();
      revealContextCards();

      // Composer placeholder + the “Anfrage”-Effekt
      const ta = document.querySelector('.composer textarea');
      if (ta) ta.placeholder = 'Stelle eine Anfrage an die Schweizer Demokratiegeschichte.';

      // URL-Parameter prüfen: ?q=... und ?autosubmit=1 (z.B. vom "Chat öffnen"-Button auf index.html)
      const params = new URLSearchParams(window.location.search || '');
      const qParam = (params.get('q') || '').trim();
      const autosubmit = params.get('autosubmit') === '1';
      const defaultPrompt = 'Visualisiere mir die Kapitalfreundlichkeit aller Schweizer Gemeinden im Zeitverlauf';
      const promptText = qParam || defaultPrompt;

      if (autosubmit) {
        // Direkt absenden: Prompt einfügen, kurz anzeigen, sofort als User-Message übernehmen
        if (ta) {
          ta.value = promptText;
          await sleep(120);
          ta.value = '';
        }
        appendUserMessage(promptText);
        await sleep(120);
      } else {
        // Demo-Modus: Tipp-Animation simulieren
        if (ta) {
          ta.value = '';
          for (const ch of promptText) {
            ta.value += ch;
            await sleep(14 + Math.random() * 10);
          }
          await sleep(450);
          ta.value = '';
        }
        appendUserMessage(promptText);
        await sleep(350);
      }

      const steps = buildTour();
      for (const s of steps) {
        await renderStep(s);
      }

      if (ta) ta.placeholder = 'Beta-Demo · nur eine vordefinierte Anfrage.';
      // Persist
      try { sessionStorage.setItem(STORAGE_KEY, 'done'); } catch (e) {}
    } catch (err) {
      console.error('Cleavage tour failed:', err);
      const bubble = appendAssistantBubble();
      bubble.innerHTML = `<p style="color: #ff7a6a">Fehler beim Laden der Analyse-Daten: ${escapeHtml(err.message || String(err))}</p>`;
    }
  }

  // Wait for DOM, then go
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
