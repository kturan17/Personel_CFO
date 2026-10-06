/* Basit, bağımlılıksız SVG grafikler — çizgi (crosshair + ipucu) ve yatay çubuk (ipucu). */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function compact(v) {
    const a = Math.abs(v);
    const f = (x, d) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: d }).format(x);
    if (a >= 1e6) return f(v / 1e6, 1) + ' Mn';
    if (a >= 1e3) return f(v / 1e3, a >= 1e5 ? 0 : 1) + ' B';
    return f(v, 0);
  }
  function niceTicks(max, n) {
    if (max <= 0) return [0, 1];
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
    const out = []; for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
    if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
    return out;
  }
  function el(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  // series: [{name, values, color, dash}], labels: []
  function line(host, opt) {
    host.innerHTML = '';
    host.classList.add('chart');
    const W = Math.max(280, host.clientWidth || 320), H = opt.height || 200;
    const padL = 44, padR = 10, padT = 10, padB = 26;
    const n = opt.labels.length;
    const maxV = Math.max(1, ...opt.series.flatMap(s => s.values.filter(v => v != null)));
    const ticks = niceTicks(maxV, 4), top = ticks[ticks.length - 1];
    const x = i => padL + (n <= 1 ? 0 : i * (W - padL - padR) / (n - 1));
    const y = v => padT + (H - padT - padB) * (1 - v / top);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': opt.aria || 'Grafik' });
    ticks.forEach(t => {
      svg.appendChild(el('line', { x1: padL, x2: W - padR, y1: y(t), y2: y(t), style: 'stroke:var(--hair);stroke-width:1' }));
      const tx = el('text', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end', style: 'fill:var(--muted);font-size:11px' }); tx.textContent = compact(t); svg.appendChild(tx);
    });
    const every = Math.max(1, Math.ceil(n / Math.floor((W - padL) / 62)));
    opt.labels.forEach((lb, i) => {
      if (i % every !== 0 && i !== n - 1) return;
      if (i !== n - 1 && i + every > n - 1 && n - 1 - i < every * 0.6) return;
      const tx = el('text', { x: x(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', style: 'fill:var(--muted);font-size:11px' });
      tx.textContent = opt.short ? opt.short(lb, i) : lb; svg.appendChild(tx);
    });
    opt.series.forEach(s => {
      let d = ''; s.values.forEach((v, i) => { if (v == null) return; d += (d ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
      svg.appendChild(el('path', { d, fill: 'none', style: `stroke:${s.color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round${s.dash ? ';stroke-dasharray:5 4' : ''}` }));
      if (n <= 14) s.values.forEach((v, i) => { if (v != null) svg.appendChild(el('circle', { cx: x(i), cy: y(v), r: 3.5, style: `fill:${s.color};stroke:var(--surface);stroke-width:2` })); });
    });
    const cross = el('line', { y1: padT, y2: H - padB, style: 'stroke:var(--muted);stroke-width:1;opacity:0' });
    svg.appendChild(cross);
    const dots = opt.series.map(s => { const c = el('circle', { r: 4.5, style: `fill:${s.color};stroke:var(--surface);stroke-width:2;opacity:0` }); svg.appendChild(c); return c; });
    const hit = el('rect', { x: padL, y: 0, width: W - padL - padR, height: H, fill: 'transparent', style: 'cursor:crosshair;touch-action:pan-y' });
    svg.appendChild(hit);
    host.appendChild(svg);
    const tt = document.createElement('div'); tt.className = 'tt'; host.appendChild(tt);
    function show(ev) {
      const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
      const i = Math.max(0, Math.min(n - 1, Math.round((px - padL) / ((W - padL - padR) / Math.max(1, n - 1)))));
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.opacity = .5;
      opt.series.forEach((s, k) => { const v = s.values[i]; if (v == null) { dots[k].style.opacity = 0; return; } dots[k].setAttribute('cx', x(i)); dots[k].setAttribute('cy', y(v)); dots[k].style.opacity = 1; });
      tt.innerHTML = `<div class="b" style="margin-bottom:3px">${esc(opt.labels[i])}</div>` + opt.series.map(s => s.values[i] == null ? '' :
        `<div><span class="sw2" style="background:${s.color}"></span>${esc(s.name)}: <b>${esc(opt.fmt ? opt.fmt(s.values[i]) : compact(s.values[i]))}</b></div>`).join('');
      tt.classList.add('show');
      const tw = tt.offsetWidth, left = x(i) * r.width / W;
      tt.style.left = Math.max(0, Math.min(r.width - tw, left + (left > r.width / 2 ? -tw - 12 : 12))) + 'px';
      tt.style.top = '4px';
    }
    function hide() { tt.classList.remove('show'); cross.style.opacity = 0; dots.forEach(d => d.style.opacity = 0); }
    hit.addEventListener('pointermove', show); hit.addEventListener('pointerdown', show); hit.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hide(); });
    document.addEventListener('pointerdown', ev => { if (!host.contains(ev.target)) hide(); });
  }

  // items: [{label, value, sub}] — tek seri yatay çubuk
  function barsH(host, opt) {
    host.innerHTML = ''; host.classList.add('chart');
    const items = opt.items, W = Math.max(280, host.clientWidth || 320), rowH = 34, labW = Math.min(130, W * 0.36), valW = 70;
    const H = items.length * rowH + 4, max = Math.max(1, ...items.map(i => i.value));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': opt.aria || 'Grafik' });
    const tt = document.createElement('div'); tt.className = 'tt';
    items.forEach((it, k) => {
      const y0 = k * rowH + 4, bw = Math.max(2, (W - labW - valW - 8) * it.value / max), bh = 16;
      const g = el('g', { style: 'cursor:default' });
      const lab = el('text', { x: 0, y: y0 + bh / 2 + 5, style: 'fill:var(--ink2);font-size:12.5px' });
      let t = it.label; if (t.length > 18) t = t.slice(0, 17) + '…'; lab.textContent = t; g.appendChild(lab);
      g.appendChild(el('rect', { x: labW, y: y0, width: W - labW - valW - 8, height: bh, rx: 4, style: 'fill:var(--surface2)' }));
      g.appendChild(el('path', { d: `M${labW} ${y0}h${Math.max(0, bw - 4)}a4 4 0 0 1 4 4v${bh - 8}a4 4 0 0 1 -4 4h${-Math.max(0, bw - 4)}z`, style: `fill:${it.color || 'var(--s1)'}` }));
      const v = el('text', { x: W, y: y0 + bh / 2 + 5, 'text-anchor': 'end', style: 'fill:var(--ink);font-size:12.5px;font-weight:600' });
      v.textContent = opt.fmt ? opt.fmt(it.value) : compact(it.value); g.appendChild(v);
      const hitr = el('rect', { x: 0, y: y0 - 6, width: W, height: rowH, fill: 'transparent' }); g.appendChild(hitr);
      const showT = () => {
        tt.innerHTML = `<div class="b">${esc(it.label)}</div><div>${esc(opt.fmt ? opt.fmt(it.value) : compact(it.value))}</div>` + (it.sub ? `<div class="muted">${esc(it.sub)}</div>` : '');
        tt.classList.add('show'); const r = svg.getBoundingClientRect();
        tt.style.left = Math.max(0, Math.min(r.width - tt.offsetWidth, labW * r.width / W)) + 'px'; tt.style.top = (y0 + rowH) * r.height / H + 'px';
      };
      hitr.addEventListener('pointerenter', showT); hitr.addEventListener('pointerdown', showT); hitr.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') tt.classList.remove('show'); });
      svg.appendChild(g);
    });
    document.addEventListener('pointerdown', ev => { if (!host.contains(ev.target)) tt.classList.remove('show'); });
    host.appendChild(svg); host.appendChild(tt);
  }
  root.CFOCharts = { line, barsH, compact };
})(window);
