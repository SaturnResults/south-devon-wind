/* South Devon Wind – windsurf & wingfoil spot checker.
 * Data: Open-Meteo (multi-model wind + marine tide model, no key needed)
 *       UKHO Admiralty UK Tidal API (optional, free "Discovery" key) for official HW/LW times.
 */
(() => {
  'use strict';

  const TZ = 'Europe/London';
  const HOUR = 3600e3;

  const MODELS = [
    { id: 'ukmo_uk_deterministic_2km', label: 'Met Office UKV 2 km', short: 'UKV' },
    { id: 'ecmwf_ifs025', label: 'ECMWF IFS', short: 'ECMWF' },
    { id: 'icon_d2', label: 'DWD ICON-D2', short: 'ICON' },
    { id: 'meteofrance_arome_france_hd', label: 'Météo-France AROME HD', short: 'AROME' },
    { id: 'gfs_seamless', label: 'NOAA GFS', short: 'GFS' },
  ];

  const DEFAULTS = {
    windsurfMin: 20, windsurfMax: 40,
    wingMin: 12, wingMax: 30,
    models: MODELS.map(m => m.id),
    admiraltyKey: '',
    daylightOnly: true,
    days: 5,
  };

  // ---------- storage (best effort) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  let settings = Object.assign({}, DEFAULTS, store.get('sdw.settings', {}));
  if (!Array.isArray(settings.models) || !settings.models.length) settings.models = DEFAULTS.models.slice();

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = d => ((d % 360) + 360) % 360;
  const angDiff = (a, b) => { const d = Math.abs(norm(a) - norm(b)); return d > 180 ? 360 - d : d; };
  const inRange = (d, [from, to]) => { d = norm(d); from = norm(from); to = norm(to); return from <= to ? d >= from && d <= to : d >= from || d <= to; };
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const compass = d => COMPASS[Math.round(norm(d) / 22.5) % 16];
  const mean = a => { const v = a.filter(x => x != null && !isNaN(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const circMean = a => {
    const v = a.filter(x => x != null && !isNaN(x)); if (!v.length) return null;
    let s = 0, c = 0; v.forEach(d => { s += Math.sin(d * Math.PI / 180); c += Math.cos(d * Math.PI / 180); });
    return norm(Math.atan2(s, c) * 180 / Math.PI);
  };
  const fmt = (t, opts) => new Intl.DateTimeFormat('en-GB', Object.assign({ timeZone: TZ }, opts)).format(new Date(t));
  const hhmm = t => fmt(t, { hour: '2-digit', minute: '2-digit' });
  const dayName = t => fmt(t, { weekday: 'short', day: 'numeric', month: 'short' });
  const dayKey = t => fmt(t, { year: 'numeric', month: '2-digit', day: '2-digit' });
  const round = x => x == null ? '–' : Math.round(x);

  // ---------- sun ----------
  function sunElevation(t, lat, lon) {
    const d = t / 86400000 + 2440587.5 - 2451545.0; // days since J2000
    const g = (357.529 + 0.98560028 * d) * Math.PI / 180;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * Math.PI / 180;
    const e = (23.439 - 0.00000036 * d) * Math.PI / 180;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = norm(280.46061837 + 360.98564736629 * d) * Math.PI / 180;
    const ha = gmst + lon * Math.PI / 180 - ra;
    const la = lat * Math.PI / 180;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) * 180 / Math.PI;
  }
  const isDaylight = (t, lat, lon) => sunElevation(t, lat, lon) > -0.833;

  // ---------- geohash (for Met Office links) ----------
  function geohash(lat, lon, len = 9) {
    const b32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let latR = [-90, 90], lonR = [-180, 180], hash = '', bit = 0, ch = 0, even = true;
    while (hash.length < len) {
      const r = even ? lonR : latR, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
      if (v > mid) { ch |= 1 << (4 - bit); r[0] = mid; } else r[1] = mid;
      even = !even;
      if (bit < 4) bit++; else { hash += b32[ch]; bit = 0; ch = 0; }
    }
    return hash;
  }

  // ---------- direction quality ----------
  // returns { cls: label, q: 'good' | 'ok' | 'caution' | 'bad' }
  function dirQuality(spot, dir) {
    if (dir == null) return { cls: '–', q: 'bad' };
    if (spot.goodDirs) {
      if (spot.goodDirs.some(r => inRange(dir, r))) return { cls: 'good dir', q: 'good' };
      if (spot.goodDirs.some(([a, b]) => inRange(dir, [a - 25, b + 25]))) return { cls: 'marginal dir', q: 'ok' };
      return { cls: 'poor dir', q: 'bad' };
    }
    const a = angDiff(dir, spot.seaward);
    if (a < 30) return { cls: 'onshore', q: 'ok' };
    if (a < 67.5) return { cls: 'cross-on', q: 'good' };
    if (a <= 112.5) return { cls: 'cross-shore', q: 'good' };
    if (a < 150) return { cls: 'cross-off', q: 'caution' };
    return { cls: 'offshore', q: 'bad' };
  }

  // ---------- tides ----------
  function extremaFromSeries(times, heights) {
    const ev = [];
    for (let i = 1; i < heights.length - 1; i++) {
      const a = heights[i - 1], b = heights[i], c = heights[i + 1];
      if (a == null || b == null || c == null) continue;
      const isHigh = b > a && b >= c, isLow = b < a && b <= c;
      if (!isHigh && !isLow) continue;
      const den = a - 2 * b + c;
      const off = den ? (a - c) / (2 * den) : 0; // hours, parabolic refinement
      const h = b - (a - c) * off / 4;
      const step = times[i + 1] - times[i];
      ev.push({ type: isHigh ? 'HW' : 'LW', t: times[i] + off * step, h });
    }
    return ev;
  }

  // cosine interpolation between HW/LW events
  function tideHeightFromEvents(ev, t) {
    for (let i = 0; i < ev.length - 1; i++) {
      const a = ev[i], b = ev[i + 1];
      if (t >= a.t && t <= b.t) {
        const f = (t - a.t) / (b.t - a.t);
        return a.h + (b.h - a.h) * (1 - Math.cos(Math.PI * f)) / 2;
      }
    }
    return null;
  }

  function tideState(spot, tide, t) {
    if (!tide || !tide.events.length) return { ok: true, label: '', known: false };
    const ev = tide.events;
    const near = type => ev.filter(e => e.type === type).reduce((best, e) => (!best || Math.abs(e.t - t) < Math.abs(best.t - t)) ? e : best, null);
    const hw = near('HW'), lw = near('LW');
    const rule = spot.tide.rule;
    let ok = true;
    if (rule === 'hw') ok = !!hw && Math.abs(t - hw.t) <= spot.tide.hours * HOUR;
    else if (rule === 'notLow') ok = !lw || Math.abs(t - lw.t) >= spot.tide.hours * HOUR;
    const next = ev.find(e => e.t > t);
    const rising = next ? next.type === 'HW' : null;
    let label = '';
    if (hw) {
      const dh = (t - hw.t) / HOUR;
      if (Math.abs(dh) < 0.25) label = 'High water';
      else label = `HW ${dh > 0 ? '+' : '−'}${Math.abs(dh).toFixed(1)}h`;
    }
    return { ok, label, known: true, rising, height: tide.heightAt(t) };
  }

  // ---------- data fetch ----------
  async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  async function fetchWind(spots) {
    const p = new URLSearchParams({
      latitude: spots.map(s => s.lat).join(','),
      longitude: spots.map(s => s.lon).join(','),
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      models: settings.models.join(','),
      wind_speed_unit: 'kn',
      timeformat: 'unixtime',
      timezone: 'GMT',
      forecast_days: String(settings.days),
    });
    const data = await fetchJSON('https://api.open-meteo.com/v1/forecast?' + p);
    return Array.isArray(data) ? data : [data];
  }

  function tideRefs(spots) {
    const refs = new Map();
    spots.forEach(s => { const k = s.tide.ref.join(','); if (!refs.has(k)) refs.set(k, s.tide.ref); });
    return refs;
  }

  async function fetchTidesOpenMeteo(refs) {
    const keys = [...refs.keys()];
    const p = new URLSearchParams({
      latitude: keys.map(k => refs.get(k)[0]).join(','),
      longitude: keys.map(k => refs.get(k)[1]).join(','),
      hourly: 'sea_level_height_msl',
      timeformat: 'unixtime',
      timezone: 'GMT',
      past_days: '1',
      forecast_days: String(settings.days + 1),
    });
    let data = await fetchJSON('https://marine-api.open-meteo.com/v1/marine?' + p);
    if (!Array.isArray(data)) data = [data];
    const out = new Map();
    keys.forEach((k, i) => {
      const d = data[i]; if (!d || !d.hourly) return;
      const times = d.hourly.time.map(x => x * 1000), h = d.hourly.sea_level_height_msl;
      const events = extremaFromSeries(times, h);
      out.set(k, {
        source: 'Open-Meteo tide model',
        events,
        heightAt: t => {
          const i = times.findIndex(x => x > t);
          if (i <= 0 || h[i] == null || h[i - 1] == null) return null;
          const f = (t - times[i - 1]) / (times[i] - times[i - 1]);
          return h[i - 1] + (h[i] - h[i - 1]) * f;
        },
        series: times.map((t, i) => [t, h[i]]).filter(x => x[1] != null),
      });
    });
    return out;
  }

  const ADMIRALTY = 'https://admiraltyapi.azure-api.net/uktidalapi/api/V1';
  async function fetchTidesAdmiralty(refs, key) {
    const headers = { 'Ocp-Apim-Subscription-Key': key };
    let stations = store.get('sdw.adm.stations', null);
    if (!stations) {
      const gj = await fetchJSON(`${ADMIRALTY}/Stations`, { headers });
      stations = (gj.features || []).map(f => ({ id: f.properties.Id, name: f.properties.Name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
      store.set('sdw.adm.stations', stations);
    }
    const dist = (a, b) => Math.hypot(a[0] - b.lat, (a[1] - b.lon) * Math.cos(a[0] * Math.PI / 180));
    const out = new Map(), cache = new Map();
    for (const [k, ref] of refs) {
      const st = stations.reduce((best, s) => !best || dist(ref, s) < dist(ref, best) ? s : best, null);
      if (!st) continue;
      if (!cache.has(st.id)) {
        cache.set(st.id, fetchJSON(`${ADMIRALTY}/Stations/${encodeURIComponent(st.id)}/TidalEvents?duration=${settings.days + 1}`, { headers }));
      }
      const raw = await cache.get(st.id);
      const events = raw.map(e => ({
        type: e.EventType === 'HighWater' ? 'HW' : 'LW',
        t: Date.parse(/Z|[+-]\d\d:?\d\d$/.test(e.DateTime) ? e.DateTime : e.DateTime + 'Z'),
        h: e.Height,
      })).sort((a, b) => a.t - b.t);
      out.set(k, {
        source: `UKHO Admiralty – ${st.name}`,
        events,
        heightAt: t => tideHeightFromEvents(events, t),
        series: null,
      });
    }
    return out;
  }

  // shift a tide record by the spot's offset
  function tideForSpot(spot, tides) {
    const base = tides && tides.get(spot.tide.ref.join(','));
    if (!base) return null;
    const off = (spot.tide.offsetMin || 0) * 60e3;
    if (!off) return base;
    return {
      source: base.source + ` (+${spot.tide.offsetMin} min)`,
      events: base.events.map(e => ({ ...e, t: e.t + off })),
      heightAt: t => base.heightAt(t - off),
      series: base.series && base.series.map(([t, h]) => [t + off, h]),
    };
  }

  // ---------- analysis ----------
  function rate(sport, w, dq, tideOk, day) {
    const min = settings[sport + 'Min'], max = settings[sport + 'Max'];
    if (w.speed == null) return 'none';
    if (settings.daylightOnly && !day) return 'dark';
    if (!tideOk) return 'tide';
    if (dq.q === 'bad') return 'no';
    if (w.speed > max || (w.gust != null && w.gust > max + 8)) return 'over';
    if (w.speed >= min && dq.q === 'good') return 'go';
    if (w.speed >= min) return 'maybe'; // onshore / cross-off
    if (w.speed >= min - 3 && dq.q !== 'caution') return 'maybe';
    return 'no';
  }

  function analyseSpot(spot, wx, tide) {
    const times = wx.hourly.time.map(x => x * 1000);
    const hours = times.map((t, i) => {
      const models = {};
      settings.models.forEach(m => {
        const s = wx.hourly[`wind_speed_10m_${m}`] || (settings.models.length === 1 ? wx.hourly.wind_speed_10m : null);
        const g = wx.hourly[`wind_gusts_10m_${m}`] || (settings.models.length === 1 ? wx.hourly.wind_gusts_10m : null);
        const d = wx.hourly[`wind_direction_10m_${m}`] || (settings.models.length === 1 ? wx.hourly.wind_direction_10m : null);
        models[m] = { speed: s ? s[i] : null, gust: g ? g[i] : null, dir: d ? d[i] : null };
      });
      const vals = Object.values(models);
      const w = { speed: mean(vals.map(v => v.speed)), gust: mean(vals.map(v => v.gust)), dir: circMean(vals.map(v => v.dir)) };
      const sp = vals.map(v => v.speed).filter(v => v != null);
      w.spread = sp.length > 1 ? Math.max(...sp) - Math.min(...sp) : 0;
      const dq = dirQuality(spot, w.dir);
      const ts = tideState(spot, tide, t);
      const day = isDaylight(t, spot.lat, spot.lon);
      return { t, models, w, dq, tide: ts, day, windsurf: rate('windsurf', w, dq, ts.ok, day), wing: rate('wing', w, dq, ts.ok, day) };
    });
    const windows = sport => {
      const out = []; let cur = null;
      hours.forEach(h => {
        const good = h.t >= Date.now() - HOUR && h[sport] === 'go';
        if (good) { if (!cur) cur = { start: h.t, end: h.t + HOUR, peak: h.w.speed, hours: [h] }; else { cur.end = h.t + HOUR; cur.peak = Math.max(cur.peak, h.w.speed); cur.hours.push(h); } }
        else if (cur) { out.push(cur); cur = null; }
      });
      if (cur) out.push(cur);
      return out;
    };
    const now = Date.now();
    const nowIdx = Math.max(0, times.findIndex(t => t + HOUR > now));
    return { spot, hours, now: hours[nowIdx], nowIdx, tide, windows: { windsurf: windows('windsurf'), wing: windows('wing') } };
  }

  // ---------- rendering helpers ----------
  const STATUS = {
    go: { txt: 'GO', cls: 'st-go' },
    maybe: { txt: 'Maybe', cls: 'st-maybe' },
    over: { txt: 'Too much', cls: 'st-over' },
    no: { txt: 'No', cls: 'st-no' },
    tide: { txt: 'Tide', cls: 'st-tide' },
    dark: { txt: 'Dark', cls: 'st-dark' },
    none: { txt: '–', cls: 'st-no' },
  };
  const badge = (label, s) => `<span class="badge ${STATUS[s].cls}" title="${esc(label)}: ${STATUS[s].txt}">${label ? esc(label) + ' ' : ''}<b>${STATUS[s].txt}</b></span>`;
  const arrow = (dir, size = 22) => dir == null ? '' :
    `<svg class="arrow" width="${size}" height="${size}" viewBox="0 0 24 24" style="transform:rotate(${dir + 180}deg)" aria-label="wind from ${compass(dir)}"><path d="M12 2 L18 20 L12 16 L6 20 Z" fill="currentColor"/></svg>`;
  const speedClass = s => s == null ? 'w0' : s < 8 ? 'w1' : s < 12 ? 'w2' : s < 16 ? 'w3' : s < 20 ? 'w4' : s < 25 ? 'w5' : s < 30 ? 'w6' : 'w7';
  const ICON = { wind: '💨', tide: '🌊', cam: '📷', spot: '📍', star: '★', board: '🏄', link: '🔗', clock: '🕑', map: '🗺️' };

  const section = (id, icon, title, sub, body, extraCls = '') => `<section class="panel ${extraCls}" id="${id}">
      <header class="panel-head"><h2><span class="ico" aria-hidden="true">${icon}</span>${title}</h2>${sub ? `<p class="panel-sub">${sub}</p>` : ''}</header>
      <div class="panel-body">${body}</div></section>`;

  function windowText(w, showPeak = true) {
    if (!w) return '<span class="muted">none in forecast</span>';
    const same = dayKey(w.start) === dayKey(w.end - 1);
    return `<b>${dayName(w.start)}</b> ${hhmm(w.start)}–${same ? '' : dayName(w.end) + ' '}${hhmm(w.end)}${showPeak ? ` <span class="muted">· peak ${round(w.peak)} kn</span>` : ''}`;
  }

  const ruleText = s => s.tide.rule === 'hw' ? `HW ±${s.tide.hours}h only` : s.tide.rule === 'notLow' ? `avoid LW ±${s.tide.hours}h` : 'any tide';

  function tideNow(a) {
    if (!a.tide) return '<span class="muted">tide n/a</span>';
    if (a.spot.tide.rule === 'none') return '<span class="muted">any tide</span>';
    return a.now.tide.ok ? '<span class="pill ok-pill">tide ✓</span>' : '<span class="pill bad-pill">tide ✗</span>';
  }

  // tide windows (sailable periods) for tide-dependent spots, daylight only
  function tideWindows(a) {
    const out = []; let cur = null;
    a.hours.forEach(h => {
      const good = h.t + HOUR > Date.now() && h.tide.ok && h.day;
      if (good) { if (!cur) cur = { start: h.t, end: h.t + HOUR }; else cur.end = h.t + HOUR; }
      else if (cur) { out.push(cur); cur = null; }
    });
    if (cur) out.push(cur);
    return out;
  }

  // ---------- pages ----------
  function overviewPage(all) {
    const best = sport => all.flatMap(a => a.windows[sport].map(x => ({ ...x, spot: a.spot })))
      .sort((x, y) => x.start - y.start || y.peak - x.peak).slice(0, 5);
    const onNow = sport => all.filter(a => a.now[sport] === 'go');
    const bestCol = (sport, title) => {
      const now = onNow(sport), next = best(sport);
      return `<div class="bet">
        <div class="bet-head"><h3>${title}</h3><span class="muted small">≥ ${settings[sport + 'Min']} kn · good direction · right tide</span></div>
        <div class="bet-now ${now.length ? 'is-on' : ''}">${now.length ? `<b>On now:</b> ${now.map(a => `<a href="#spot/${a.spot.id}">${esc(a.spot.name)}</a>`).join(', ')}` : 'Nothing on right now'}</div>
        <ol class="sessions">${next.map(w => `<li><a href="#spot/${w.spot.id}">${esc(w.spot.name)}</a><span>${windowText(w)}</span></li>`).join('') || '<li class="muted">No sessions in the forecast.</li>'}</ol>
      </div>`;
    };
    const order = { go: 0, maybe: 1, over: 2, tide: 3, no: 4, dark: 5, none: 6 };
    const rows = all.slice().sort((x, y) => (Math.min(order[x.now.windsurf], order[x.now.wing]) - Math.min(order[y.now.windsurf], order[y.now.wing])) || ((y.spot.favourite ? 1 : 0) - (x.spot.favourite ? 1 : 0)));
    const nowTable = `<div class="scroll-x"><table class="now-table">
      <thead><tr><th>Spot</th><th>Wind</th><th class="c-gust">Gust</th><th>Direction</th><th>Tide</th><th>Windsurf</th><th>Wing</th></tr></thead>
      <tbody>${rows.map(a => `<tr onclick="location.hash='#spot/${a.spot.id}'">
        <td class="spot-cell"><a href="#spot/${a.spot.id}">${a.spot.favourite ? '<span class="star">★</span> ' : ''}${esc(a.spot.name)}</a><div class="muted tiny c-area">${esc(a.spot.area)}</div></td>
        <td><span class="knots ${speedClass(a.now.w.speed)}">${round(a.now.w.speed)}</span></td>
        <td class="muted c-gust">${round(a.now.w.gust)}</td>
        <td class="nowrap">${arrow(a.now.w.dir, 16)} ${a.now.w.dir == null ? '' : compass(a.now.w.dir)} <span class="chip q-${a.now.dq.q}">${esc(a.now.dq.cls.replace(' dir', ''))}</span></td>
        <td>${tideNow(a)}</td>
        <td>${badge('', a.now.windsurf)}</td>
        <td>${badge('', a.now.wing)}</td></tr>`).join('')}</tbody></table></div>`;
    return section('best', ICON.board, 'Best bets', 'The next sessions where wind strength, direction and tide all line up (daylight only).',
      `<div class="bets">${bestCol('windsurf', 'Windsurf')}${bestCol('wing', 'Wingfoil')}</div>`) +
      section('now', ICON.clock, 'Right now', `Conditions this hour · ${hhmm(Date.now())}`, nowTable) +
      quickNav();
  }

  function quickNav() {
    return `<div class="quick">
      <a href="#wind" class="quick-card"><span>${ICON.wind}</span><b>Wind forecast</b><small>All spots, next ${settings.days} days</small></a>
      <a href="#tides" class="quick-card"><span>${ICON.tide}</span><b>Tides</b><small>HW/LW times & sailable windows</small></a>
      <a href="#webcams" class="quick-card"><span>${ICON.cam}</span><b>Webcams</b><small>Check the water before you drive</small></a>
      <a href="#spots" class="quick-card"><span>${ICON.spot}</span><b>Spot guide</b><small>Directions, hazards, notes</small></a>
    </div>`;
  }

  function windPage(all) {
    const SLOTS = [7, 10, 13, 16, 19];
    const first = all[0];
    const days = [...new Set(first.hours.map(h => dayKey(h.t)))];
    const hourOf = t => +fmt(t, { hour: '2-digit', hourCycle: 'h23' });
    const cols = [];
    days.forEach(d => SLOTS.forEach(sl => {
      const idx = first.hours.findIndex(h => dayKey(h.t) === d && hourOf(h.t) === sl);
      if (idx >= 0 && first.hours[idx].t + HOUR > Date.now()) cols.push({ d, sl, idx });
    }));
    let prev = '';
    const dayHead = [];
    cols.forEach(c => { if (c.d !== prev) { dayHead.push({ d: c.d, n: 1, t: first.hours[c.idx].t }); prev = c.d; } else dayHead[dayHead.length - 1].n++; });
    const isNew = (i) => i === 0 || cols[i].d !== cols[i - 1].d;
    const table = `<div class="scroll-x"><table class="matrix">
      <thead>
        <tr><th class="sticky"></th>${dayHead.map(d => `<th colspan="${d.n}" class="newday dayh">${dayName(d.t)}</th>`).join('')}</tr>
        <tr><th class="sticky">Spot</th>${cols.map((c, i) => `<th class="${isNew(i) ? 'newday' : ''} tiny">${String(c.sl).padStart(2, '0')}</th>`).join('')}</tr>
      </thead>
      <tbody>${all.map(a => `<tr>
        <th class="sticky spot-cell"><a href="#spot/${a.spot.id}">${a.spot.favourite ? '<span class="star">★</span> ' : ''}${esc(a.spot.name)}</a></th>
        ${cols.map((c, i) => {
          const h = a.hours[c.idx]; if (!h) return '<td></td>';
          const ws = h.windsurf === 'go', wg = h.wing === 'go';
          return `<td class="${speedClass(h.w.speed)} ${isNew(i) ? 'newday' : ''} ${h.dq.q === 'bad' ? 'baddir' : ''}" title="${esc(a.spot.name)} ${dayName(h.t)} ${hhmm(h.t)}: ${round(h.w.speed)} kn (gust ${round(h.w.gust)}) ${h.w.dir == null ? '' : compass(h.w.dir)} – ${h.dq.cls}">
            <div class="mx-speed">${round(h.w.speed)}</div>${arrow(h.w.dir, 13)}
            <div class="mx-dots">${ws ? '<i class="dot dot-ws" title="Windsurf GO"></i>' : ''}${wg ? '<i class="dot dot-wing" title="Wing GO"></i>' : ''}</div></td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>`;
    const legend = `<div class="legend-row small">
      <span class="scale">${[['w1', '<8'], ['w2', '8–12'], ['w3', '12–16'], ['w4', '16–20'], ['w5', '20–25'], ['w6', '25–30'], ['w7', '30+']].map(([c, l]) => `<span class="${c}">${l}</span>`).join('')}</span>
      <span><i class="dot dot-ws"></i> Windsurf GO</span><span><i class="dot dot-wing"></i> Wing GO</span><span><span class="baddir-key"></span> offshore / wrong direction</span></div>`;
    const models = `<ul class="model-list">${settings.models.map(id => { const m = MODELS.find(x => x.id === id); return `<li><b>${esc(m.short)}</b> ${esc(m.label)}</li>`; }).join('')}</ul>`;
    return section('wind', ICON.wind, 'Wind forecast', `Average of ${settings.models.length} models, in knots. Tap a spot for the hourly breakdown by model.`, legend + table) +
      section('models', ICON.map, 'Forecast models used', 'Change these in Settings. UKV and AROME are high-res short-range models; ECMWF and GFS go further out.', models);
  }

  function tideChartSVG(tide, start, end, opts = {}) {
    if (!tide) return '<p class="muted">Tide data unavailable.</p>';
    const pts = [];
    for (let t = start; t <= end; t += HOUR / 3) { const h = tide.heightAt(t); if (h != null) pts.push([t, h]); }
    if (pts.length < 2) return '<p class="muted">Tide data unavailable.</p>';
    const hrs = (end - start) / HOUR;
    const W = Math.max(640, hrs * (opts.pxPerHour || 9)), H = 150, P = 18, TOP = 34;
    const hs = pts.map(p => p[1]), hmin = Math.min(...hs), hmax = Math.max(...hs);
    const x = t => P + (t - start) / (end - start) * (W - 2 * P);
    const y = h => H - P - (h - hmin) / ((hmax - hmin) || 1) * (H - P - TOP);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
    const area = path + `L${x(pts[pts.length - 1][0]).toFixed(1)},${H}L${x(pts[0][0]).toFixed(1)},${H}Z`;
    let bands = '';
    const step = HOUR, bw = (W - 2 * P) * step / (end - start) + 0.5;
    for (let t = start; t < end; t += step) {
      if (opts.lat != null && !isDaylight(t + step / 2, opts.lat, opts.lon)) bands += `<rect class="night" x="${x(t)}" y="0" width="${bw}" height="${H}"/>`;
      else if (opts.okAt && opts.okAt(t + step / 2)) bands += `<rect class="tide-ok" x="${x(t)}" y="0" width="${bw}" height="${H}"/>`;
    }
    const evs = tide.events.filter(e => e.t >= start && e.t <= end).map(e => {
      const ex = x(e.t), ey = y(tide.heightAt(e.t) ?? e.h);
      return `<circle cx="${ex}" cy="${ey}" r="3" class="tide-pt"/><text x="${ex}" y="${e.type === 'HW' ? ey - 8 : ey + 14}" text-anchor="middle" class="tide-lbl">${e.type} ${hhmm(e.t)}</text>`;
    }).join('');
    const nowX = x(Date.now());
    let days = '';
    for (let t = start; t <= end; t += HOUR) {
      if (+fmt(t, { hour: '2-digit', hourCycle: 'h23' }) === 0) days += `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H}" class="day-line"/><text x="${x(t) + 4}" y="12" class="day-lbl">${dayName(t)}</text>`;
    }
    return `<div class="scroll-x chart-wrap"><svg class="tide-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${bands}<path d="${area}" class="tide-area"/><path d="${path}" class="tide-path"/>${days}${evs}${Date.now() >= start && Date.now() <= end ? `<line x1="${nowX}" x2="${nowX}" y1="0" y2="${H}" class="now-line"/>` : ''}</svg></div>`;
  }

  function tideTimesTable(tide, from, to) {
    if (!tide) return '<p class="muted">Tide data unavailable.</p>';
    const byDay = new Map();
    tide.events.filter(e => e.t >= from && e.t <= to).forEach(e => {
      const k = dayKey(e.t); if (!byDay.has(k)) byDay.set(k, { t: e.t, ev: [] }); byDay.get(k).ev.push(e);
    });
    return `<div class="tide-days">${[...byDay.values()].map(d => `<div class="tide-day"><div class="td-name">${dayName(d.t)}</div>
      ${d.ev.map(e => `<div class="td-ev ${e.type === 'HW' ? 'hw' : 'lw'}"><span>${e.type === 'HW' ? 'High' : 'Low'}</span><b>${hhmm(e.t)}</b><small>${e.h != null ? e.h.toFixed(1) + ' m' : ''}</small></div>`).join('')}</div>`).join('')}</div>`;
  }

  function tidesPage(all) {
    const start = new Date(); start.setMinutes(0, 0, 0);
    const from = start.getTime() - 3 * HOUR, to = from + settings.days * 24 * HOUR;
    const dependent = all.filter(a => a.spot.tide.rule !== 'none');
    const windowsCard = dependent.map(a => {
      const tw = tideWindows(a).slice(0, 6);
      return `<div class="tw-card"><div class="tw-head"><a href="#spot/${a.spot.id}">${a.spot.favourite ? '<span class="star">★</span> ' : ''}${esc(a.spot.name)}</a><span class="pill">${ruleText(a.spot)}</span></div>
        <ul>${tw.map(w => `<li>${windowText(w, false)}</li>`).join('') || '<li class="muted">No daylight tide windows</li>'}</ul></div>`;
    }).join('');
    // one block per tide area (shared reference point)
    const groups = new Map();
    all.forEach(a => { const k = a.spot.tide.ref.join(','); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); });
    const areas = [...groups.entries()].map(([k, g]) => {
      const a = g.find(x => !x.spot.tide.offsetMin) || g[0];
      const offs = g.filter(x => x.spot.tide.offsetMin).map(x => `${esc(x.spot.name)} +${x.spot.tide.offsetMin} min`);
      return `<div class="tide-area-block"><h3>${esc((window.TIDE_AREAS || {})[k] || a.spot.name)}</h3>
        <p class="muted small tide-covers">For: ${g.map(x => `<a href="#spot/${x.spot.id}">${esc(x.spot.name)}</a>`).join(', ')}${offs.length ? ` · times shown for ${esc(a.spot.name)}; ${offs.join(', ')}` : ''}</p>
        ${tideTimesTable(a.tide, from, to)}
        ${tideChartSVG(a.tide, from, to, { lat: a.spot.lat, lon: a.spot.lon })}
        <p class="muted tiny">${a.tide ? esc(a.tide.source) : ''}</p></div>`;
    }).join('');
    return section('tide-windows', ICON.clock, 'Sailable tide windows', 'Daylight periods when the tide is right at spots that depend on it. Wind not included – see Best bets for that.', `<div class="tw-grid">${windowsCard}</div>`) +
      section('tide-times', ICON.tide, 'Tide times', `High and low water for each area. ${settings.admiraltyKey ? 'Official UKHO Admiralty times.' : 'From the Open-Meteo tide model (approximate) – add a free Admiralty key in Settings for official times.'} Not for navigation.`, areas);
  }

  function webcamsPage(all) {
    const cards = all.map(a => `<div class="cam-card"><div class="cam-head"><a href="#spot/${a.spot.id}">${a.spot.favourite ? '<span class="star">★</span> ' : ''}${esc(a.spot.name)}</a>
        <span class="knots ${speedClass(a.now.w.speed)}">${round(a.now.w.speed)} kn</span></div>
      <ul>${(a.spot.webcams || []).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${ICON.cam} ${esc(l.label)}</a></li>`).join('') || '<li class="muted">None known</li>'}</ul></div>`).join('');
    return section('webcams', ICON.cam, 'Webcams', 'Third-party cameras – they open in a new tab and some may be offline.', `<div class="cam-grid">${cards}</div>`) +
      section('more', ICON.link, 'More live data', '', `<ul class="link-list">${window.GENERAL_LINKS.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`).join('')}</ul>`);
  }

  function spotsPage(all) {
    const cards = all.map(a => {
      const s = a.spot, n = a.now;
      return `<a class="card" href="#spot/${s.id}">
        <div class="card-head"><div><h3>${s.favourite ? '<span class="star">★</span> ' : ''}${esc(s.name)}</h3><div class="muted small">${esc(s.area)}</div></div>
          <div class="now-wind ${speedClass(n.w.speed)}">${arrow(n.w.dir)}<div><b>${round(n.w.speed)}</b><small> kn</small></div></div></div>
        <p class="small">${esc(s.dirNote)}</p>
        <div class="row small"><span class="pill">${ICON.tide} ${ruleText(s)}</span></div>
      </a>`;
    }).join('');
    return section('spots', ICON.spot, 'Spot guide', `${all.length} spots. ★ = your regulars.`, `<div class="cards">${cards}</div>`);
  }

  function compassSVG(spot, dir) {
    const R = 70, C = 80;
    const pt = (deg, r) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
    const arc = (a, b, cls) => {
      if (norm(b - a) === 0) return '';
      const [x1, y1] = pt(a, R), [x2, y2] = pt(b, R), large = norm(b - a) > 180 ? 1 : 0;
      return `<path class="${cls}" d="M${C},${C} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z"/>`;
    };
    let sectors = '';
    if (spot.goodDirs) sectors = spot.goodDirs.map(([a, b]) => arc(a, b, 'sec-good')).join('');
    else {
      const s = spot.seaward;
      sectors = arc(s - 112.5, s - 30, 'sec-good') + arc(s + 30, s + 112.5, 'sec-good') + arc(s - 30, s + 30, 'sec-ok') +
        arc(s + 150, s + 210, 'sec-bad') + arc(s + 112.5, s + 150, 'sec-caution') + arc(s + 210, s + 247.5, 'sec-caution');
    }
    const labels = ['N', 'E', 'S', 'W'].map((l, i) => { const [x, y] = pt(i * 90, R + 9); return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${l}</text>`; }).join('');
    const [sx, sy] = pt(spot.seaward, R - 8);
    const sea = spot.goodDirs ? '' : `<line class="sea" x1="${C}" y1="${C}" x2="${sx}" y2="${sy}"/><text class="sea-t" x="${pt(spot.seaward, R - 24)[0]}" y="${pt(spot.seaward, R - 24)[1]}" text-anchor="middle">sea</text>`;
    let wind = '';
    if (dir != null) { const [x1, y1] = pt(dir, R), [x2, y2] = pt(dir, 14); wind = `<line class="wind" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ah)"/>`; }
    return `<svg class="compass" viewBox="-6 -6 172 172" role="img" aria-label="Good wind directions for ${esc(spot.name)}">
      <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="wind-head"/></marker></defs>
      <circle cx="${C}" cy="${C}" r="${R}" class="ring"/>${sectors}${sea}${wind}${labels}</svg>`;
  }

  function hourlyTableHTML(a) {
    const hrs = a.hours.filter(h => h.t + HOUR > Date.now() && (!settings.daylightOnly || h.day));
    let lastDay = '';
    const head = hrs.map(h => { const d = dayKey(h.t), nd = d !== lastDay; lastDay = d; return `<th class="${nd ? 'newday' : ''}">${nd ? `<div class="dlbl">${dayName(h.t)}</div>` : '<div class="dlbl">&nbsp;</div>'}${fmt(h.t, { hour: '2-digit' })}</th>`; }).join('');
    const nd = hrs.map((h, i) => i && dayKey(h.t) !== dayKey(hrs[i - 1].t) ? ' newday' : '');
    const row = (label, fn, cls = '') => `<tr class="${cls}"><th class="rlabel">${label}</th>${hrs.map((h, i) => fn(h, nd[i])).join('')}</tr>`;
    const modelRows = settings.models.map(m => {
      const meta = MODELS.find(x => x.id === m);
      return row(`<span title="${esc(meta.label)}">${esc(meta.short)}</span>`, (h, c) => {
        const v = h.models[m];
        return `<td class="${speedClass(v.speed)}${c}" title="${meta.short}: ${round(v.speed)} kn, gust ${round(v.gust)}, ${v.dir == null ? '' : compass(v.dir)}">${v.speed == null ? '' : round(v.speed)}</td>`;
      }, 'model');
    }).join('');
    return `<div class="scroll-x"><table class="hourly">
      <thead><tr><th class="rlabel"></th>${head}</tr></thead>
      <tbody>
        ${row('<b>Wind</b>', (h, c) => `<td class="${speedClass(h.w.speed)}${c} strong">${round(h.w.speed)}</td>`)}
        ${row('Gust', (h, c) => `<td class="${speedClass(h.w.gust)}${c}">${round(h.w.gust)}</td>`)}
        ${row('Dir', (h, c) => `<td class="${c.trim()}" title="${h.w.dir == null ? '' : compass(h.w.dir) + ' ' + Math.round(h.w.dir) + '°'}">${arrow(h.w.dir, 16)}<div class="tiny">${h.w.dir == null ? '' : compass(h.w.dir)}</div></td>`)}
        ${row('Shore', (h, c) => `<td class="q-${h.dq.q}${c} tiny">${esc(h.dq.cls.replace(' dir', '').replace('-shore', ''))}</td>`)}
        ${row('Tide', (h, c) => `<td class="${a.spot.tide.rule !== 'none' ? (h.tide.ok ? 'tide-in' : 'tide-out') : ''}${c} tiny">${h.tide.height == null ? '' : h.tide.height.toFixed(1)}${h.tide.rising == null ? '' : h.tide.rising ? '↑' : '↓'}</td>`)}
        ${row('Windsurf', (h, c) => `<td class="${STATUS[h.windsurf].cls}${c} tiny">${STATUS[h.windsurf].txt}</td>`, 'verdict')}
        ${row('Wing', (h, c) => `<td class="${STATUS[h.wing].cls}${c} tiny">${STATUS[h.wing].txt}</td>`, 'verdict')}
        <tr class="subhead"><th class="rlabel" colspan="${hrs.length + 1}">By model</th></tr>
        ${modelRows}
      </tbody></table></div>`;
  }

  function spotPage(a) {
    const s = a.spot, n = a.now;
    const start = new Date(); start.setMinutes(0, 0, 0);
    const from = start.getTime() - 3 * HOUR, to = from + settings.days * 24 * HOUR;
    const mo = `https://weather.metoffice.gov.uk/forecast/${geohash(s.lat, s.lon)}`;
    const windyLink = `https://www.windy.com/${s.lat}/${s.lon}?${s.lat},${s.lon},12`;
    const windyEmbed = `https://embed.windy.com/embed2.html?lat=${s.lat}&lon=${s.lon}&detailLat=${s.lat}&detailLon=${s.lon}&zoom=10&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=kt&metricTemp=%C2%B0C&radarRange=-1`;
    const li = l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a></li>`;
    const forecasts = [
      { label: 'Windy', url: windyLink }, { label: 'Met Office', url: mo },
      s.windfinder && { label: 'Windfinder', url: `https://www.windfinder.com/forecast/${s.windfinder}` },
      { label: 'Windguru', url: 'https://www.windguru.cz/' },
      { label: 'Admiralty EasyTide', url: 'https://easytide.admiralty.co.uk/' },
      { label: 'Directions (Google Maps)', url: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}` },
    ].filter(Boolean);
    const wl = sport => a.windows[sport].slice(0, 5).map(w => `<li><span>${windowText(w)}</span></li>`).join('') || '<li class="muted">None in forecast</li>';

    const hero = `<div class="hero">
        <div class="hero-main">
          <a href="#spots" class="back">← All spots</a>
          <h1>${s.favourite ? '<span class="star">★</span> ' : ''}${esc(s.name)}</h1>
          <div class="muted">${esc(s.area)}</div>
          <div class="hero-stats">
            <div class="stat ${speedClass(n.w.speed)}"><span class="stat-l">Wind</span><span class="stat-v">${arrow(n.w.dir, 24)} ${round(n.w.speed)}<small> kn</small></span><span class="stat-s">${n.w.dir == null ? '' : compass(n.w.dir)} · gust ${round(n.w.gust)}</span></div>
            <div class="stat"><span class="stat-l">Direction</span><span class="stat-v small-v"><span class="chip q-${n.dq.q}">${esc(n.dq.cls)}</span></span><span class="stat-s">${esc(s.dirNote.split('.')[0])}</span></div>
            <div class="stat"><span class="stat-l">Tide</span><span class="stat-v small-v">${tideNow(a)}</span><span class="stat-s">${n.tide.label || ''} · ${ruleText(s)}</span></div>
            <div class="stat"><span class="stat-l">Verdict now</span><span class="stat-v small-v">${badge('Windsurf', n.windsurf)} ${badge('Wing', n.wing)}</span></div>
          </div>
        </div>
        <div class="hero-compass">${compassSVG(s, n.w.dir)}
          <div class="legend small"><span class="sw sec-good"></span>good <span class="sw sec-ok"></span>onshore <span class="sw sec-caution"></span>cross-off <span class="sw sec-bad"></span>offshore</div></div>
      </div>`;

    return hero +
      section('sessions', ICON.board, 'Sessions', 'When wind, direction and tide all line up (daylight).',
        `<div class="bets"><div class="bet"><div class="bet-head"><h3>Windsurf</h3><span class="muted small">≥ ${settings.windsurfMin} kn</span></div><ul class="sessions">${wl('windsurf')}</ul></div>
         <div class="bet"><div class="bet-head"><h3>Wingfoil</h3><span class="muted small">≥ ${settings.wingMin} kn</span></div><ul class="sessions">${wl('wing')}</ul></div></div>`) +
      section('forecast', ICON.wind, 'Wind forecast', `Hourly, in knots. Top rows are the ${settings.models.length}-model average; individual models below.`, hourlyTableHTML(a)) +
      section('tide', ICON.tide, 'Tide', `${ruleText(s)}. ${s.tide.rule !== 'none' ? 'Green shading = sailable tide window; grey = night.' : 'Grey = night.'}`,
        tideTimesTable(a.tide, Date.now() - 3 * HOUR, to) +
        tideChartSVG(a.tide, from, to, { lat: s.lat, lon: s.lon, okAt: s.tide.rule === 'none' ? null : t => tideState(s, a.tide, t).ok }) +
        `<p class="muted tiny">${a.tide ? esc(a.tide.source) : ''} · Not for navigation.</p>`) +
      section('cams', ICON.cam, 'Webcams', 'Third-party – may be offline.', `<ul class="link-list">${(s.webcams || []).map(li).join('') || '<li class="muted">None known</li>'}</ul>`) +
      section('about', ICON.spot, 'Spot notes', '', `<p>${esc(s.notes)}</p><p><b>Wind:</b> ${esc(s.dirNote)}</p>${(s.links || []).length ? `<ul class="link-list">${s.links.map(li).join('')}</ul>` : ''}`) +
      section('links', ICON.link, 'Other forecasts', '', `<ul class="link-list">${forecasts.map(li).join('')}</ul>`) +
      section('map', ICON.map, 'Live wind map', '', `<div class="windy"><iframe title="Windy wind map for ${esc(s.name)}" loading="lazy" src="${windyEmbed}" frameborder="0"></iframe></div>`);
  }

  function settingsPage() {
    return section('settings', '⚙︎', 'Settings', 'Saved on this device.', `<form id="settings-form">
      <div class="form-grid">
      <fieldset><legend>Windsurf (knots)</legend>
        <label>Minimum <input type="number" name="windsurfMin" min="0" max="60" value="${settings.windsurfMin}"></label>
        <label>Too much above <input type="number" name="windsurfMax" min="0" max="80" value="${settings.windsurfMax}"></label></fieldset>
      <fieldset><legend>Wingfoil (knots)</legend>
        <label>Minimum <input type="number" name="wingMin" min="0" max="60" value="${settings.wingMin}"></label>
        <label>Too much above <input type="number" name="wingMax" min="0" max="80" value="${settings.wingMax}"></label></fieldset>
      </div>
      <fieldset><legend>Forecast models</legend>
        ${MODELS.map(m => `<label class="cb"><input type="checkbox" name="model" value="${m.id}" ${settings.models.includes(m.id) ? 'checked' : ''}> ${esc(m.label)}</label>`).join('')}
      </fieldset>
      <fieldset><legend>Other</legend>
        <label class="cb"><input type="checkbox" name="daylightOnly" ${settings.daylightOnly ? 'checked' : ''}> Daylight hours only</label>
        <label>Forecast days <input type="number" name="days" min="1" max="7" value="${settings.days}"></label>
        <label>UKHO Admiralty Tidal API key <span class="muted small">(optional – official HW/LW times; free "Discovery" tier at admiraltyapi.portal.azure-api.net)</span>
          <input type="text" name="admiraltyKey" autocomplete="off" spellcheck="false" value="${esc(settings.admiraltyKey)}"></label>
      </fieldset>
      <div class="row"><button type="submit" class="btn">Save &amp; refresh</button><button type="button" class="btn ghost" id="reset">Reset defaults</button></div>
    </form>`);
  }

  // ---------- app ----------
  let analysed = null, lastUpdated = null, tideNote = '';

  async function load() {
    const main = $('#main');
    if (!analysed) main.innerHTML = '<p class="loading">Fetching forecasts…</p>';
    $('#refresh').classList.add('spin');
    const spots = window.SPOTS;
    const refs = tideRefs(spots);
    const windP = fetchWind(spots);
    let tidesP;
    tideNote = '';
    if (settings.admiraltyKey) {
      tidesP = fetchTidesAdmiralty(refs, settings.admiraltyKey).catch(err => {
        tideNote = `Admiralty API failed (${err.message}) – using tide model instead.`;
        return fetchTidesOpenMeteo(refs);
      });
    } else tidesP = fetchTidesOpenMeteo(refs);
    tidesP = tidesP.catch(err => { tideNote = `Tide data unavailable (${err.message}).`; return null; });
    try {
      const [wind, tides] = await Promise.all([windP, tidesP]);
      analysed = spots.map((s, i) => analyseSpot(s, wind[i], tideForSpot(s, tides)));
      lastUpdated = Date.now();
      render();
    } catch (err) {
      main.innerHTML = `<div class="error panel"><p>Couldn't load the forecast: ${esc(err.message)}</p><button class="btn" id="retry">Try again</button></div>`;
      $('#retry').onclick = load;
    } finally { $('#refresh').classList.remove('spin'); }
  }

  function render() {
    const main = $('#main');
    const hash = location.hash || '#';
    const m = hash.match(/^#spot\/(.+)$/);
    const tab = m ? 'spots' : (hash.slice(1) || 'overview');
    document.querySelectorAll('.tabs a').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
    $('#updated').textContent = lastUpdated ? `Updated ${hhmm(lastUpdated)}` : '';
    if (hash === '#settings') { main.innerHTML = settingsPage(); bindSettings(); return; }
    if (!analysed) return;
    const note = tideNote ? `<p class="warn small">${esc(tideNote)}</p>` : '';
    let html;
    if (m) { const a = analysed.find(x => x.spot.id === m[1]); html = a ? spotPage(a) : spotsPage(analysed); }
    else if (tab === 'wind') html = windPage(analysed);
    else if (tab === 'tides') html = tidesPage(analysed);
    else if (tab === 'webcams') html = webcamsPage(analysed);
    else if (tab === 'spots') html = spotsPage(analysed);
    else html = overviewPage(analysed);
    main.innerHTML = note + html;
  }

  function bindSettings() {
    const f = $('#settings-form');
    f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f);
      const num = (k, d) => { const v = parseFloat(fd.get(k)); return isNaN(v) ? d : v; };
      const models = fd.getAll('model');
      settings = {
        windsurfMin: num('windsurfMin', DEFAULTS.windsurfMin), windsurfMax: num('windsurfMax', DEFAULTS.windsurfMax),
        wingMin: num('wingMin', DEFAULTS.wingMin), wingMax: num('wingMax', DEFAULTS.wingMax),
        models: models.length ? models : DEFAULTS.models.slice(),
        daylightOnly: fd.get('daylightOnly') === 'on',
        days: Math.min(7, Math.max(1, Math.round(num('days', DEFAULTS.days)))),
        admiraltyKey: String(fd.get('admiraltyKey') || '').trim(),
      };
      store.set('sdw.settings', settings);
      location.hash = '';
      load();
    };
    $('#reset').onclick = () => { settings = Object.assign({}, DEFAULTS, { models: DEFAULTS.models.slice() }); store.set('sdw.settings', settings); render(); };
  }

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  document.addEventListener('DOMContentLoaded', () => {
    $('#refresh').onclick = load;
    load();
    setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30 * 60e3);
  });

  // exposed for tests
  window.__SDW = { dirQuality, extremaFromSeries, tideHeightFromEvents, sunElevation, geohash, analyseSpot, settings: () => settings };
})();
