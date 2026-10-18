// Gráficos SVG leves e interativos (tooltips via data-tip), sem bibliotecas externas.
import { esc, fmt } from './dom.js';

const W = 860;

function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

const defs = `<defs><linearGradient id="gBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)" stop-opacity=".55"/></linearGradient></defs>`;

/** data: [{ label, value, tip }] */
export function barChart(data, { height = 180, every = 1, unit = 'XP' } = {}) {
  const padL = 34;
  const padB = 22;
  const h = height - padB;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const bw = (W - padL) / Math.max(1, data.length);
  const grid = [0, 0.5, 1].map((f) => {
    const y = h - f * (h - 8);
    return `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y}" y2="${y}"/><text x="${padL - 6}" y="${y + 3}" text-anchor="end">${fmt(max * f)}</text>`;
  }).join('');
  const bars = data.map((d, i) => {
    const bh = (d.value / max) * (h - 8);
    const x = padL + i * bw + bw * 0.15;
    const label = i % every === 0 ? `<text x="${x + bw * 0.35}" y="${height - 6}" text-anchor="middle">${esc(d.label)}</text>` : '';
    return `<rect class="bar-r" x="${x}" y="${h - bh}" width="${Math.max(1, bw * 0.7)}" height="${Math.max(0, bh)}" rx="3"
      data-tip="${esc(d.tip || d.label)}: <b>${fmt(d.value)} ${unit}</b>"/>
      <rect x="${padL + i * bw}" y="0" width="${bw}" height="${h}" fill="transparent" data-tip="${esc(d.tip || d.label)}: <b>${fmt(d.value)} ${unit}</b>"/>${label}`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="Gráfico de barras">${defs}${grid}${bars}</svg>`;
}

/** series: [{ key, name, color, values: number[] }], labels: string[] */
export function lineChart(series, labels, { height = 220, every = 7, hidden = [] } = {}) {
  const padL = 34;
  const padB = 22;
  const h = height - padB;
  const visible = series.filter((s) => !hidden.includes(s.key));
  const max = niceMax(Math.max(1, ...visible.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - 6);
  const y = (v) => h - (v / max) * (h - 8);
  const grid = [0, 0.5, 1].map((f) => `<line class="grid-line" x1="${padL}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/><text x="${padL - 6}" y="${y(max * f) + 3}" text-anchor="end">${fmt(max * f)}</text>`).join('');
  const lines = visible.map((s) => {
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px ${s.color})"/>
      <circle cx="${x(n - 1)}" cy="${y(s.values[n - 1] || 0)}" r="3.5" fill="${s.color}"/>`;
  }).join('');
  const xl = labels.map((l, i) => (i % every === 0 || i === n - 1 ? `<text x="${x(i)}" y="${height - 6}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
  const hits = labels.map((l, i) => {
    const tip = `${esc(l)}<br>${visible.map((s) => `<span style="color:${s.color}">●</span> ${esc(s.name)}: <b>${fmt(s.values[i])}</b>`).join('<br>')}`;
    const bw = (W - padL) / n;
    return `<rect x="${x(i) - bw / 2}" y="0" width="${bw}" height="${h}" fill="transparent" data-tip="${esc(tip)}"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="Gráfico de linhas">${grid}${lines}${xl}${hits}</svg>`;
}

export function legend(series, hidden = [], action = '') {
  return `<div class="legend">${series.map((s) => `<button class="${hidden.includes(s.key) ? 'off' : ''}" ${action ? `data-action="${action}" data-key="${s.key}"` : ''} aria-pressed="${!hidden.includes(s.key)}"><i style="background:${s.color}"></i>${esc(s.name)}</button>`).join('')}</div>`;
}

/** axes: [{ key, label, value, color }], max: escala */
export function radar(axes, max) {
  const S = 300;
  const c = S / 2;
  const R = 108;
  const n = axes.length;
  const pt = (i, r) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const rings = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${axes.map((_, i) => pt(i, R * f).join(',')).join(' ')}" fill="none" stroke="rgba(120,150,255,.14)"/>`).join('');
  const spokes = axes.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" stroke="rgba(120,150,255,.12)"/>`).join('');
  const shape = axes.map((a, i) => pt(i, R * Math.min(1, a.value / max)).join(',')).join(' ');
  const dots = axes.map((a, i) => {
    const [px, py] = pt(i, R * Math.min(1, a.value / max));
    const [lx, ly] = pt(i, R + 24);
    return `<circle cx="${px}" cy="${py}" r="4.5" fill="${a.color}" data-tip="${esc(a.label)}: <b>nível ${a.value}</b>"/>
      <text x="${lx}" y="${ly + 4}" text-anchor="middle" style="fill:${a.color};font-weight:700;font-size:12px">${esc(a.key)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${S} ${S}" style="max-width:340px;margin:auto" role="img" aria-label="Radar de atributos">
    <defs><radialGradient id="gRad"><stop offset="0" stop-color="var(--accent)" stop-opacity=".55"/><stop offset="1" stop-color="var(--accent2)" stop-opacity=".25"/></radialGradient></defs>
    ${rings}${spokes}<polygon points="${shape}" fill="url(#gRad)" stroke="var(--accent)" stroke-width="2" style="filter:drop-shadow(0 0 8px var(--accent))"/>${dots}</svg>`;
}

/** cells: [{ key, xp, protected, future, label }] em colunas de 7 dias */
export function heatmap(cells, max) {
  const lvl = (xp) => (xp <= 0 ? '' : xp < max * 0.25 ? 'l1' : xp < max * 0.5 ? 'l2' : xp < max * 0.8 ? 'l3' : 'l4');
  return `<div class="heat" role="img" aria-label="Mapa de consistência">${cells.map((c) => {
    const cls = c.future ? 'fut' : c.xp > 0 ? lvl(c.xp) : c.protected ? 'prot' : '';
    return `<i class="${cls}" data-tip="${esc(c.label)}: <b>${fmt(c.xp)} XP</b>${c.protected ? ' · dia protegido' : ''}"></i>`;
  }).join('')}</div>`;
}
