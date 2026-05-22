import {
  TILE_SIZE, TILE_COLORS, ROOM_COLORS, ENTITY_COLOR,
  HANDLES, HANDLE_SIZE, HANDLE_CURSOR,
} from './constants.js';
import { clamp } from './MapModel.js';

// ── Handle geometry ────────────────────────────────────────────────────────

function getHandlePos(room, dir) {
  const { x, y, width: w, height: h } = room;
  switch (dir) {
    case 'nw': return { x,       y       };
    case 'n':  return { x:x+w/2, y       };
    case 'ne': return { x:x+w,   y       };
    case 'e':  return { x:x+w,   y:y+h/2 };
    case 'se': return { x:x+w,   y:y+h   };
    case 's':  return { x:x+w/2, y:y+h   };
    case 'sw': return { x,       y:y+h   };
    case 'w':  return { x,       y:y+h/2 };
  }
}

// ── CanvasRenderer ─────────────────────────────────────────────────────────

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d', { alpha: false });
    this.zoom   = 1.0;
    this.panX   = 60;
    this.panY   = 60;

    this.showTopology = true;
    this.showGrid     = true;
    this.showBg       = true;
    this.showEntities = true;
    this.showTriggers = true;
  }

  // ── Coordinate transforms ──────────────────────────────────────────────

  worldToScreen(wx, wy) {
    return { x: (wx + this.panX) * this.zoom, y: (wy + this.panY) * this.zoom };
  }

  screenToWorld(sx, sy) {
    return { x: sx / this.zoom - this.panX, y: sy / this.zoom - this.panY };
  }

  // ── Camera ops ────────────────────────────────────────────────────────

  zoomAt(sx, sy, dir) {
    const f  = dir > 0 ? 1.15 : 1 / 1.15;
    const wx = sx / this.zoom - this.panX;
    const wy = sy / this.zoom - this.panY;
    this.zoom = clamp(this.zoom * f, 0.1, 8);
    this.panX = sx / this.zoom - wx;
    this.panY = sy / this.zoom - wy;
  }

  resetView() { this.zoom = 1; this.panX = 0; this.panY = 0; }

  fitToScreen(rooms) {
    if (!rooms || !rooms.length) { this.resetView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    let valid = 0;
    for (const r of rooms) {
      if (!r || !isFinite(r.x) || !isFinite(r.y) || !isFinite(r.width) || !isFinite(r.height)) continue;
      valid++;
      x0 = Math.min(x0, r.x);          y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height);
    }
    if (!valid) { this.resetView(); return; }
    const pad = 64;
    const cw  = this.canvas.width  > pad * 2 ? this.canvas.width  : 1024;
    const ch  = this.canvas.height > pad * 2 ? this.canvas.height : 768;
    this.zoom = clamp(Math.min((cw - pad * 2) / Math.max(1, x1 - x0), (ch - pad * 2) / Math.max(1, y1 - y0)), 0.1, 4);
    this.panX = pad / this.zoom - x0;
    this.panY = pad / this.zoom - y0;
  }

  // ── Hit testing ───────────────────────────────────────────────────────

  getHandleAt(sx, sy, room) {
    if (!room) return null;
    const hs = HANDLE_SIZE + 3;
    for (const dir of HANDLES) {
      const sp = this.worldToScreen(getHandlePos(room, dir).x, getHandlePos(room, dir).y);
      if (Math.abs(sx - sp.x) <= hs / 2 && Math.abs(sy - sp.y) <= hs / 2) return dir;
    }
    return null;
  }

  getRoomAt(sx, sy, rooms) {
    const w = this.screenToWorld(sx, sy);
    for (let i = rooms.length - 1; i >= 0; i--) {
      const r = rooms[i];
      if (w.x >= r.x && w.x < r.x + r.width && w.y >= r.y && w.y < r.y + r.height) return i;
    }
    return -1;
  }

  getTileAt(sx, sy, room) {
    const w   = this.screenToWorld(sx, sy);
    const col = Math.floor((w.x - room.x) / TILE_SIZE);
    const row = Math.floor((w.y - room.y) / TILE_SIZE);
    return { col, row, valid: col >= 0 && col < room.tileWidth && row >= 0 && row < room.tileHeight };
  }

  getCursorForHandle(dir) { return HANDLE_CURSOR[dir] || 'default'; }

  // ── Full frame render ─────────────────────────────────────────────────

  render(map, selectedIndices, hoverInfo, createPreview, rubberBand) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = '#12131f';
    ctx.fillRect(0, 0, W, H);
    this._worldGrid();

    if (!map || !map.rooms.length) {
      ctx.fillStyle = '#3a3d5a';
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No map loaded — Generate or File > Open', W / 2, H / 2);
      return;
    }

    for (let i = 0; i < map.rooms.length; i++) {
      const sel = selectedIndices instanceof Set ? selectedIndices.has(i) : i === selectedIndices;
      this._room(map.rooms[i], sel);
      if (sel) this._resizeHandles(map.rooms[i]);
    }

    if (this.showTopology && map.previewMetadata) this._topology(map);
    if (hoverInfo)     this._hoverHL(hoverInfo);
    if (createPreview) this._createPreview(createPreview);
    if (rubberBand)    this._rubberBand(rubberBand);
  }

  // ── Internal draw helpers ─────────────────────────────────────────────

  _worldGrid() {
    const gs = 128 * this.zoom;
    if (gs < 6) return;
    const ctx = this.ctx;
    const ox = ((this.panX * this.zoom) % gs + gs) % gs;
    const oy = ((this.panY * this.zoom) % gs + gs) % gs;
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let x = ox; x <= this.canvas.width;  x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, this.canvas.height); }
    for (let y = oy; y <= this.canvas.height; y += gs) { ctx.moveTo(0, y); ctx.lineTo(this.canvas.width, y); }
    ctx.stroke();
  }

  _room(room, selected) {
    const ctx = this.ctx;
    const { x: sx, y: sy } = this.worldToScreen(room.x, room.y);
    const sw = room.width * this.zoom, sh = room.height * this.zoom;
    if (sx + sw < 0 || sx > this.canvas.width || sy + sh < 0 || sy > this.canvas.height) return;

    ctx.fillStyle = '#0b0d1a';
    ctx.fillRect(sx, sy, sw, sh);

    if (this.showBg)       this._tileLayer(room.tilesBg, sx, sy, 0.28);
    this._tileLayer(room.tilesFg, sx, sy, 1.0);
    if (this.showEntities) this._entities(room, sx, sy);
    if (this.showTriggers) this._triggers(room, sx, sy);
    if (this.showGrid && this.zoom > 2.0) this._tileGrid(room, sx, sy);

    const col = selected ? '#ffff55' : (ROOM_COLORS[room.color % ROOM_COLORS.length] || '#4a5a7a');
    ctx.strokeStyle = col;
    ctx.lineWidth   = selected ? 2 : 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

    if (this.zoom > 0.22) {
      const fs = clamp(10 * this.zoom, 8, 11);
      ctx.fillStyle = 'rgba(180,190,220,0.45)';
      ctx.font      = `${fs}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(room.name, sx + 3, sy + fs + 2);
      // Checkpoint indicator
      if (room.hasCheckpoint) {
        const cpText = 'CP';
        ctx.font = `bold ${fs}px monospace`;
        const cpWidth = ctx.measureText(cpText).width;
        ctx.fillStyle = 'rgba(255, 220, 50, 0.9)';
        ctx.fillText(cpText, sx + sw - cpWidth - 4, sy + fs + 2);
      }
    }
  }

  _resizeHandles(room) {
    const ctx = this.ctx, hs = HANDLE_SIZE;
    for (const dir of HANDLES) {
      const wp = getHandlePos(room, dir);
      const sp = this.worldToScreen(wp.x, wp.y);
      ctx.fillStyle   = '#ffffff';
      ctx.strokeStyle = '#333355';
      ctx.lineWidth   = 1;
      ctx.fillRect(sp.x - hs / 2, sp.y - hs / 2, hs, hs);
      ctx.strokeRect(sp.x - hs / 2, sp.y - hs / 2, hs, hs);
    }
  }

  _tileLayer(td, sx, sy, alpha) {
    const ctx = this.ctx, ts = TILE_SIZE * this.zoom;
    if (ts < 0.3) return;
    ctx.globalAlpha = alpha;
    for (let row = 0; row < (td ? td.tiles.length : 0); row++) {
      const rowStr = td.tiles[row] || '';
      for (let col = 0; col < rowStr.length; col++) {
        const t = rowStr[col];
        if (t === '0' || t === ' ') continue;
        ctx.fillStyle = TILE_COLORS[t] || '#888';
        ctx.fillRect(sx + col * ts, sy + row * ts, ts, ts);
      }
    }
    ctx.globalAlpha = 1;
  }

  _entities(room, sx, sy) {
    const ctx = this.ctx;
    for (const e of (room.entities || [])) {
      const ex = sx + e.x * this.zoom, ey = sy + e.y * this.zoom;
      const ew = Math.max(3, (e.width  || 8)  * this.zoom);
      const eh = Math.max(3, (e.height || 8)  * this.zoom);
      const col = ENTITY_COLOR[e.name] || '#aaaaaa';
      ctx.fillStyle   = col + '2a';
      ctx.fillRect(ex, ey, ew, eh);
      ctx.strokeStyle = col;
      ctx.lineWidth   = 1;
      ctx.strokeRect(ex + 0.5, ey + 0.5, ew - 1, eh - 1);
      if (this.zoom > 1.8 && ew > 14) {
        const fs = clamp(8 * this.zoom, 6, 9);
        ctx.fillStyle  = col;
        ctx.font       = `${fs}px monospace`;
        ctx.textAlign  = 'center';
        ctx.fillText(e.name.slice(0, 14), ex + ew / 2, ey + eh / 2 + fs / 3);
      }
    }
  }

  _triggers(room, sx, sy) {
    const ctx = this.ctx;
    for (const t of (room.triggers || [])) {
      const tx = sx + t.x * this.zoom, ty = sy + t.y * this.zoom;
      const tw = Math.max(3, (t.width  || 64) * this.zoom);
      const th = Math.max(3, (t.height || 24) * this.zoom);
      ctx.fillStyle = 'rgba(255,136,0,0.08)';
      ctx.fillRect(tx, ty, tw, th);
      ctx.strokeStyle = 'rgba(255,136,0,0.55)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
      ctx.setLineDash([]);
      if (this.zoom > 1.8 && tw > 24) {
        const fs = clamp(7 * this.zoom, 6, 8);
        ctx.fillStyle = 'rgba(255,170,80,0.9)';
        ctx.font      = `${fs}px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(t.name.slice(0, 18), tx + 3, ty + fs + 2);
      }
    }
  }

  _tileGrid(room, sx, sy) {
    const ctx = this.ctx, ts = TILE_SIZE * this.zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    for (let c = 0; c <= room.tileWidth;  c++) { const x = sx + c * ts; ctx.moveTo(x, sy); ctx.lineTo(x, sy + room.height * this.zoom); }
    for (let r = 0; r <= room.tileHeight; r++) { const y = sy + r * ts; ctx.moveTo(sx, y); ctx.lineTo(sx + room.width * this.zoom, y); }
    ctx.stroke();
  }

  _hoverHL(info) {
    const ctx = this.ctx;
    if (info.type === 'tile') {
      const { room, row, col } = info;
      const { x: sx, y: sy } = this.worldToScreen(room.x, room.y);
      const ts = TILE_SIZE * this.zoom;
      ctx.fillStyle   = 'rgba(255,255,255,0.18)';
      ctx.fillRect(sx + col * ts, sy + row * ts, ts, ts);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = 1;
      ctx.strokeRect(sx + col * ts + 0.5, sy + row * ts + 0.5, ts - 1, ts - 1);
    } else if (info.type === 'room') {
      const { x: sx, y: sy } = this.worldToScreen(info.room.x, info.room.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx, sy, info.room.width * this.zoom, info.room.height * this.zoom);
      ctx.setLineDash([]);
    }
  }

  _createPreview(prev) {
    const ctx = this.ctx;
    const x1 = Math.min(prev.x0, prev.x1), y1 = Math.min(prev.y0, prev.y1);
    const x2 = Math.max(prev.x0, prev.x1), y2 = Math.max(prev.y0, prev.y1);
    const { x: sx, y: sy } = this.worldToScreen(x1, y1);
    const sw = (x2 - x1) * this.zoom, sh = (y2 - y1) * this.zoom;
    if (sw < 1 || sh < 1) return;
    ctx.fillStyle   = 'rgba(80,120,220,0.12)';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = 'rgba(80,180,255,0.85)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    ctx.setLineDash([]);
    const fs = 10;
    ctx.font      = `${fs}px monospace`;
    ctx.fillStyle = 'rgba(120,180,255,0.9)';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round((x2 - x1) / 8) * 8} x ${Math.round((y2 - y1) / 8) * 8}`, sx + sw / 2, sy + sh / 2 + fs / 3);
  }

  _rubberBand(rb) {
    const ctx = this.ctx;
    const x1 = Math.min(rb.x0, rb.x1), y1 = Math.min(rb.y0, rb.y1);
    const x2 = Math.max(rb.x0, rb.x1), y2 = Math.max(rb.y0, rb.y1);
    ctx.fillStyle   = 'rgba(100,140,255,0.08)';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeStyle = 'rgba(100,160,255,0.6)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1 - 1, y2 - y1 - 1);
    ctx.setLineDash([]);
  }

  _topology(map) {
    const ctx  = this.ctx, meta = map.previewMetadata;
    const nodes = meta.nodes || [];
    const mainSet = new Set(meta.mainPathNodeIds || []);

    for (const node of nodes) {
      const fr = map.rooms.find(r => r.name === node.roomName); if (!fr) continue;
      const fc = this.worldToScreen(fr.x + fr.width / 2, fr.y + fr.height / 2);
      for (const cid of (node.connections || [])) {
        const tn = nodes.find(n => n.id === cid); if (!tn) continue;
        const tr = map.rooms.find(r => r.name === tn.roomName); if (!tr) continue;
        const tc = this.worldToScreen(tr.x + tr.width / 2, tr.y + tr.height / 2);
        const isMain = mainSet.has(node.id) && mainSet.has(cid);
        ctx.strokeStyle = isMain ? 'rgba(255,200,50,0.55)' : 'rgba(80,130,255,0.32)';
        ctx.lineWidth   = isMain ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(fc.x, fc.y); ctx.lineTo(tc.x, tc.y); ctx.stroke();
      }
    }

    for (const node of nodes) {
      const r = map.rooms.find(r => r.name === node.roomName); if (!r) continue;
      const c  = this.worldToScreen(r.x + r.width / 2, r.y + r.height / 2);
      const nr = Math.max(3, 5 * this.zoom);
      ctx.beginPath(); ctx.arc(c.x, c.y, nr, 0, Math.PI * 2);
      ctx.fillStyle = node.id === meta.startNodeId  ? '#00ff88'
                    : node.id === meta.goalNodeId    ? '#ff4040'
                    : mainSet.has(node.id)           ? '#ffcc00'
                    :                                  '#5566cc';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }
  }
}
