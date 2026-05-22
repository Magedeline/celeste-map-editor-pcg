import { TILE_SIZE } from './constants.js';

// ── helpers ────────────────────────────────────────────────────────────────

export function snap8(v) { return Math.round(v / 8) * 8; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Room ───────────────────────────────────────────────────────────────────

export class Room {
  constructor(d = {}) {
    this.name       = d.name       || 'room_0';
    this.x          = (d.x != null && typeof d.x === 'number' && isFinite(d.x)) ? d.x : 0;
    this.y          = (d.y != null && typeof d.y === 'number' && isFinite(d.y)) ? d.y : 0;
    const rawW      = (typeof d.width  === 'number' && isFinite(d.width)  && d.width  > 0) ? d.width  : 320;
    const rawH      = (typeof d.height === 'number' && isFinite(d.height) && d.height > 0) ? d.height : 184;
    this.width      = rawW;
    this.height     = rawH;
    this.tileWidth  = d.tileWidth  || Math.floor(this.width  / TILE_SIZE);
    this.tileHeight = d.tileHeight || Math.floor(this.height / TILE_SIZE);
    this.tilesFg    = d.tilesFg ? { tiles: [...d.tilesFg.tiles]  } : { tiles: this._empty() };
    this.tilesBg    = d.tilesBg ? { tiles: [...d.tilesBg.tiles]  } : { tiles: this._empty() };
    this.entities   = d.entities ? d.entities.map(e => ({ ...e })) : [];
    this.triggers   = d.triggers ? d.triggers.map(t => ({ ...t })) : [];
    this.decalsFg   = d.decalsFg ? [...d.decalsFg] : [];
    this.decalsBg   = d.decalsBg ? [...d.decalsBg] : [];
    this.music      = d.music      || '';
    this.ambience   = d.ambience   || '';
    this.wind       = d.wind       || '';
    this.dark       = !!d.dark;
    this.underwater = !!d.underwater;
    this.space      = !!d.space;
    this.hasCheckpoint  = !!d.hasCheckpoint;
    this.delayAltMusic  = !!d.delayAltMusic;
    this.color      = d.color != null ? d.color : 0;
  }

  _empty() {
    const row = '0'.repeat(this.tileWidth);
    return Array.from({ length: this.tileHeight }, () => row);
  }

  clone() { return new Room(JSON.parse(JSON.stringify(this))); }

  resize(newW, newH) {
    newW = clamp(snap8(newW), 80, 2048);
    newH = clamp(snap8(newH), 80, 2048);
    const tw = Math.floor(newW / TILE_SIZE);
    const th = Math.floor(newH / TILE_SIZE);
    const resizeLayer = (td) => {
      const out = [];
      for (let r = 0; r < th; r++) {
        const old = (td.tiles && td.tiles[r]) || '';
        out.push(Array.from({ length: tw }, (_, c) => old[c] || '0').join(''));
      }
      return { tiles: out };
    };
    this.tilesFg    = resizeLayer(this.tilesFg);
    this.tilesBg    = resizeLayer(this.tilesBg);
    this.width      = newW;  this.height     = newH;
    this.tileWidth  = tw;    this.tileHeight = th;
  }
}

// ── MapModel ───────────────────────────────────────────────────────────────

export class MapModel {
  constructor() {
    this.packageName     = 'newmap';
    this.rooms           = [];
    this.fillers         = [];
    this.stylesFg        = [];
    this.stylesBg        = [];
    this.previewMetadata = null;
    this._history        = [];
    this._historyIdx     = -1;
    this._filePath       = null;
    this._dirty          = false;
    this._copyBuffer     = null;
  }

  get filePath() { return this._filePath; }
  get isDirty()  { return this._dirty; }

  // ── Load ────────────────────────────────────────────────────────────────

  loadFromGenerator(data) {
    this.packageName     = data.packageName || this.packageName || 'newmap';
    this.rooms           = data.rooms.map(r => new Room(r));
    this.fillers         = Array.isArray(data.fillers)   ? data.fillers.map(f => ({ ...f }))  : [];
    this.stylesFg        = Array.isArray(data.stylesFg)  ? data.stylesFg.map(s => ({ ...s })) : [];
    this.stylesBg        = Array.isArray(data.stylesBg)  ? data.stylesBg.map(s => ({ ...s })) : [];
    this.previewMetadata = data.previewMetadata || null;
    this._filePath       = null;
    this._dirty          = true;
    this._resetHistory();
  }

  loadFromJSON(jsonStr, filePath = null) {
    const data = JSON.parse(jsonStr);
    this.packageName = data.packageName || data.package || this.packageName || 'newmap';
    this.fillers     = Array.isArray(data.fillers)  ? data.fillers.map(f => ({ ...f }))  : [];
    this.stylesFg    = Array.isArray(data.stylesFg) ? data.stylesFg.map(s => ({ ...s })) : [];
    this.stylesBg    = Array.isArray(data.stylesBg) ? data.stylesBg.map(s => ({ ...s })) : [];

    if (Array.isArray(data.rooms)) {
      this.rooms           = data.rooms.map(r => new Room(r));
      this.previewMetadata = data.previewMetadata || null;
    } else if (Array.isArray(data.levels)) {
      this.rooms           = data.levels.map(l => this._convLevel(l));
      this.previewMetadata = null;
    } else {
      throw new Error('Unknown map format: expected .rooms or .levels array');
    }

    this._filePath = filePath;
    this._dirty    = false;
    this._resetHistory();
  }

  _convLevel(l) {
    const w = l.width || 320, h = l.height || 184;
    const tw = Math.floor(w / TILE_SIZE), th = Math.floor(h / TILE_SIZE);
    const parseTiles = (str) => {
      const lines = (str || '').split('\n');
      return { tiles: Array.from({ length: th }, (_, r) => {
        const ln = lines[r] || '';
        return Array.from({ length: tw }, (_, c) => ln[c] || '0').join('');
      }) };
    };
    return new Room({
      name: l.name || l.id || 'room', x: l.xoffset || 0, y: l.yoffset || 0,
      width: w, height: h, tileWidth: tw, tileHeight: th,
      tilesFg: parseTiles(l.solids), tilesBg: parseTiles(l.bg),
      entities: l.entities || [], triggers: l.triggers || [],
      decalsFg: l.decals || [], color: l.c || 0,
      music: l.music || '', dark: !!l.dark, underwater: !!l.underwater,
    });
  }

  toJSON() {
    return JSON.stringify({
      packageName:     this.packageName,
      rooms:           this.rooms,
      fillers:         this.fillers,
      stylesFg:        this.stylesFg,
      stylesBg:        this.stylesBg,
      previewMetadata: this.previewMetadata,
    }, null, 2);
  }

  // ── History ─────────────────────────────────────────────────────────────

  _resetHistory() {
    this._history    = [this.rooms.map(r => r.clone())];
    this._historyIdx = 0;
  }

  pushHistory() {
    this._history    = this._history.slice(0, this._historyIdx + 1);
    this._history.push(this.rooms.map(r => r.clone()));
    if (this._history.length > 80) this._history.shift(); else this._historyIdx++;
    this._dirty = true;
  }

  undo() {
    if (this._historyIdx <= 0) return false;
    this._historyIdx--;
    this.rooms = this._history[this._historyIdx].map(r => r.clone());
    return true;
  }

  redo() {
    if (this._historyIdx >= this._history.length - 1) return false;
    this._historyIdx++;
    this.rooms = this._history[this._historyIdx].map(r => r.clone());
    return true;
  }

  // ── Edit ops ─────────────────────────────────────────────────────────────

  setTile(ri, layer, row, col, t) {
    const room = this.rooms[ri];
    if (!room) return;
    if (row < 0 || row >= room.tileHeight || col < 0 || col >= room.tileWidth) return;
    const td = layer === 'fg' ? room.tilesFg : room.tilesBg;
    if (!td.tiles[row]) td.tiles[row] = '0'.repeat(room.tileWidth);
    const s = td.tiles[row];
    td.tiles[row] = s.slice(0, col) + t + s.slice(col + 1);
  }

  addEntity(ri, def, lx, ly) {
    const r = this.rooms[ri]; if (!r) return;
    const maxId = r.entities.reduce((m, e) => Math.max(m, e.id || 0), 0);
    r.entities.push({ name: def.name, id: maxId + 1, x: lx, y: ly, width: def.w || 8, height: def.h || 8, nodes: [], attributes: {} });
    this.pushHistory();
  }

  addTrigger(ri, def, lx, ly) {
    const r = this.rooms[ri]; if (!r) return;
    r.triggers.push({ name: def.name, x: lx, y: ly, width: def.w || 64, height: def.h || 24, attributes: {} });
    this.pushHistory();
  }

  deleteEntityAt(ri, lx, ly) {
    const r = this.rooms[ri]; if (!r) return false;
    const idx = r.entities.findIndex(e => lx >= e.x && lx <= e.x + (e.width  || 8)  && ly >= e.y && ly <= e.y + (e.height || 8));
    if (idx >= 0) { r.entities.splice(idx, 1); this.pushHistory(); return true; }
    const tidx = r.triggers.findIndex(t => lx >= t.x && lx <= t.x + (t.width || 64) && ly >= t.y && ly <= t.y + (t.height || 24));
    if (tidx >= 0) { r.triggers.splice(tidx, 1); this.pushHistory(); return true; }
    return false;
  }

  addRoom(x, y, w, h) {
    const i = this.rooms.length;
    this.rooms.push(new Room({ name: `room_${i}`, x, y, width: w, height: h }));
    this.pushHistory();
    return i;
  }

  deleteRoom(ri)         { this.rooms.splice(ri, 1); this.pushHistory(); }
  moveRoom(ri, nx, ny)   { const r = this.rooms[ri]; if (r) { r.x = nx; r.y = ny; } }

  replaceRoomTiles(ri, fgTiles, bgTiles, entities) {
    const r = this.rooms[ri]; if (!r) return;
    if (fgTiles)  r.tilesFg  = { tiles: [...fgTiles] };
    if (bgTiles)  r.tilesBg  = { tiles: [...bgTiles] };
    if (entities) r.entities = entities.map(e => ({ ...e }));
    this.pushHistory();
  }

  selectAll()     { return this.rooms.map((_, i) => i); }

  copyRooms(indices) {
    this._copyBuffer = indices.map(i => this.rooms[i]).filter(Boolean).map(r => r.clone());
  }

  pasteRooms(ox = 32, oy = 32) {
    if (!this._copyBuffer || !this._copyBuffer.length) return [];
    const start = this.rooms.length;
    for (const r of this._copyBuffer) {
      const n = r.clone();
      n.name = n.name + '_copy';
      n.x    = snap8(n.x + ox);
      n.y    = snap8(n.y + oy);
      this.rooms.push(n);
    }
    this.pushHistory();
    return this._copyBuffer.map((_, i) => start + i);
  }
}
