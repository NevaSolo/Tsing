/*
 * Extrait du modèle 3D (public/shirt.gltf) vers src/canvas/utils/trimGeometry.js la géométrie des bordures, en coordonnées de texture :
 *   - col : triangles de la bande de col (pièce séparée du patron) → coloriée entièrement, + son pourtour ;
 *   - manches / bas : bords ouverts du maillage (poignets, ourlet) + triangles voisins (découpe : pas de débordement).
 * À relancer seulement si le modèle change :  node scripts/extract-trims.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const g = JSON.parse(readFileSync(new URL("public/shirt.gltf", root), "utf8"));
const buf = Buffer.from(g.buffers[0].uri.split(",")[1], "base64");
const read = (i) => {
  const a = g.accessors[i];
  const bv = g.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = bv.byteStride ?? comps * 4;
  return Array.from({ length: a.count }, (_, k) => {
    const row = Array.from({ length: comps }, (_, c) => {
      const p = off + k * stride + c * 4;
      return a.componentType === 5126 ? buf.readFloatLE(p) : buf.readUInt32LE(p);
    });
    return comps === 1 ? row[0] : row;
  });
};
const prim = g.meshes[0].primitives[0];
const pos = read(prim.attributes.POSITION);
const uv = read(prim.attributes.TEXCOORD_0);
const idx = read(prim.indices);
const tris = Array.from({ length: idx.length / 3 }, (_, t) => [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]);

const r4 = (x) => Math.round(x * 10000) / 10000;
const uvKey = (i) => uv[i].map((x) => Math.round(x * 1e5)).join(",");
const posKey = (i) => pos[i].map((x) => Math.round(x * 1e4)).join(",");

// ---- Îlots UV (pièces du patron)
const parent = new Map();
const find = (x) => {
  while (parent.get(x) !== x) {
    parent.set(x, parent.get(parent.get(x)));
    x = parent.get(x);
  }
  return x;
};
for (let i = 0; i < uv.length; i++) if (!parent.has(uvKey(i))) parent.set(uvKey(i), uvKey(i));
for (const [a, b, c] of tris) {
  for (const o of [b, c]) {
    const ra = find(uvKey(a));
    const ro = find(uvKey(o));
    if (ra !== ro) parent.set(ra, ro);
  }
}
const islands = new Map();
for (const t of tris) {
  const r = find(uvKey(t[0]));
  if (!islands.has(r)) islands.set(r, []);
  islands.get(r).push(t);
}
const pieces = [...islands.values()].filter((list) => list.length > 50);

// ---- Bords ouverts du maillage 3D (sommets soudés par position), regroupés en boucles
const edgeUse = new Map();
for (const t of tris) {
  for (let e = 0; e < 3; e++) {
    const i = t[e];
    const j = t[(e + 1) % 3];
    const a = posKey(i);
    const b = posKey(j);
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    const cur = edgeUse.get(k);
    if (cur) cur.n++;
    else edgeUse.set(k, { n: 1, i, j, a, b });
  }
}
const open = [...edgeUse.values()].filter((e) => e.n === 1);
const byVertex = new Map();
open.forEach((e, n) => {
  for (const v of [e.a, e.b]) {
    if (!byVertex.has(v)) byVertex.set(v, []);
    byVertex.get(v).push(n);
  }
});
const seen = new Set();
const loops = [];
open.forEach((_, n) => {
  if (seen.has(n)) return;
  const stack = [n];
  const loop = [];
  while (stack.length) {
    const m = stack.pop();
    if (seen.has(m)) continue;
    seen.add(m);
    loop.push(open[m]);
    for (const v of [open[m].a, open[m].b]) for (const o of byVertex.get(v)) if (!seen.has(o)) stack.push(o);
  }
  loops.push(loop);
});
// Seules les grandes boucles sont des ouvertures (col, poignets, ourlet) ; les petites sont des défauts du maillage.
const ys = pos.map((p) => p[1]);
const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
const segs = { hem: [], sleeves: [], collar: [] };
for (const loop of loops.filter((l) => l.length >= 20)) {
  const pts = loop.flatMap((e) => [pos[e.i], pos[e.j]]);
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const kind = cy < minY + 0.15 * (maxY - minY) ? "hem" : Math.abs(cx) > 0.1 ? "sleeves" : cy > maxY - 0.2 * (maxY - minY) ? "collar" : null;
  if (kind) for (const e of loop) segs[kind].push([...uv[e.i], ...uv[e.j]].map(r4));
}

// ---- Découpe : triangles des pièces concernées, proches du bord (bande ≤ 60 px), orientés pareil
const MAX_BAND = 0.07;
const distToSeg = (u, v, [a, b, c, d]) => {
  const dx = c - a;
  const dy = d - b;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((u - a) * dx + (v - b) * dy) / len)) : 0;
  return Math.hypot(u - (a + t * dx), v - (b + t * dy));
};
const oriented = (t) => {
  const [p, q, r] = t.map((i) => uv[i]);
  const area = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  // Au millième (≈ 1 px de texture) : suffisant pour une découpe, fichier plus léger.
  return (area < 0 ? [p, r, q] : [p, q, r]).flat().map((x) => Math.round(x * 1000) / 1000);
};
const islandOf = new Map();
pieces.forEach((list, n) => list.forEach((t) => islandOf.set(t, n)));
const nearTris = (segments) => {
  const touched = new Set();
  for (const seg of segments) {
    const u = (seg[0] + seg[2]) / 2;
    const v = (seg[1] + seg[3]) / 2;
    for (const t of tris) {
      if (!islandOf.has(t)) continue;
      if (t.some((i) => distToSeg(uv[i][0], uv[i][1], seg) < 1e-4)) touched.add(islandOf.get(t));
    }
    void u;
    void v;
  }
  return tris.filter((t) => touched.has(islandOf.get(t)) && t.some((i) => segments.some((seg) => distToSeg(uv[i][0], uv[i][1], seg) < MAX_BAND))).map(oriented);
};

// Col : la bande de col est une petite pièce séparée, coloriée entièrement.
const collarPieces = pieces.filter((list) => {
  const vs = list.flatMap((t) => t.map((i) => uv[i][1]));
  const ysOf = list.flatMap((t) => t.map((i) => pos[i][1]));
  return Math.max(...vs) - Math.min(...vs) < 0.1 && Math.min(...ysOf) > maxY - 0.25 * (maxY - minY);
});
const collarOutline = (() => {
  const count = new Map();
  for (const t of collarPieces.flat()) {
    for (let e = 0; e < 3; e++) {
      const a = uvKey(t[e]);
      const b = uvKey(t[(e + 1) % 3]);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const cur = count.get(k);
      if (cur) cur.n++;
      else count.set(k, { n: 1, seg: [...uv[t[e]], ...uv[t[(e + 1) % 3]]].map(r4) });
    }
  }
  return [...count.values()].filter((x) => x.n === 1).map((x) => x.seg);
})();

const out = {
  source: "public/shirt.gltf",
  collar: { tris: collarPieces.flat().map(oriented), edges: collarOutline },
  sleeves: { edges: segs.sleeves, tris: nearTris(segs.sleeves) },
  hem: { edges: segs.hem, tris: nearTris(segs.hem) },
};
const file = new URL("src/canvas/utils/trimGeometry.js", root);
writeFileSync(file, `// Généré par scripts/extract-trims.mjs — ne pas modifier à la main.\nexport default ${JSON.stringify(out)};\n`);
console.log(
  Object.fromEntries(Object.entries(out).filter(([k]) => k !== "source").map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b.length]))])),
  `${(JSON.stringify(out).length / 1024).toFixed(0)} Ko`
);
