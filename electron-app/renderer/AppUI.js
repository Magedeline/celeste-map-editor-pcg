import {
  TILE_PALETTE, ENTITY_TYPES, TRIGGER_TYPES, MOD_BROWSER,
  ENTITY_COLOR, ROOM_COLORS,
} from './constants.js';
import { MapModel, Room, snap8, clamp, esc } from './MapModel.js';
import { CanvasRenderer } from './CanvasRenderer.js';

// ── AppUI ──────────────────────────────────────────────────────────────────

export class AppUI {
  constructor() {
    this.map      = new MapModel();
    this.renderer = null;

    this.selectedIndices = new Set();
    this.currentTool     = 'select';
    this.currentTile     = '1';
    this.currentEntity   = ENTITY_TYPES[0];
    this.currentTrigger  = TRIGGER_TYPES[0];

    // pointer state
    this._isPainting   = false;
    this._isDragging   = false;
    this._isResize     = false;  this._resizeDir    = null;
    this._isPanning    = false;
    this._isRubberBand = false;
    this._isCreating   = false;

    this._panStart      = null;  this._panOrigin    = null;
    this._dragStart     = null;  this._dragOrigins  = {};
    this._rbStart       = null;  this._resizeOrigin = null;
    this._createStart   = null;  this._createPreview = null;
    this._rubberBand    = null;
    this._hoverInfo     = null;
    this._lastTileKey   = null;

    // render
    this._requestedRender = false;
    this._statusMsg       = 'Ready';

    // inspector dirty-check
    this._lastInspectorRoomIdx = -2;

    // GAN
    this._ganStatusTimer         = null;
    this._ganStartInProgress     = false;
    this._ganStatusRefreshInFlight = false;
    this._ganModelPath           = '';

    this._initDOM();
  }

  // ── DOM wiring ─────────────────────────────────────────────────────────

  _initDOM() {
    const canvas = document.getElementById('map-canvas');
    this.renderer = new CanvasRenderer(canvas);
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Tab bar
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const pane = document.getElementById('tab-' + btn.dataset.tab);
        if (pane) pane.classList.add('active');
      });
    });

    // Canvas
    canvas.addEventListener('wheel',       e => this._onWheel(e),    { passive: false });
    canvas.addEventListener('mousedown',   e => this._onMouseDown(e));
    canvas.addEventListener('mousemove',   e => this._onMouseMove(e));
    canvas.addEventListener('mouseup',     e => this._onMouseUp(e));
    canvas.addEventListener('mouseleave',  e => this._onMouseLeave(e));
    canvas.addEventListener('contextmenu', e => this._onCtxMenu(e));
    document.addEventListener('keydown',   e => this._onKeyDown(e));
    document.addEventListener('click',     ()  => this._hideCtxMenu());

    // Context menu
    document.getElementById('ctx-menu').addEventListener('click', e => {
      e.stopPropagation();
      const action = e.target.closest('[data-action]')?.dataset.action;
      this._hideCtxMenu();
      if (action) this._ctxAction(action);
    });

    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(b =>
      b.addEventListener('click', () => this._setTool(b.dataset.tool)));

    // Build palettes + mod browser
    this._buildTilePalette();
    this._buildEntityPalette();
    this._buildTriggerPalette();
    this._buildModBrowser();

    // File / toolbar
    document.getElementById('btn-new').addEventListener(   'click', () => this._newMap());
    document.getElementById('btn-open').addEventListener(  'click', () => this._openMap());
    document.getElementById('btn-close')?.addEventListener('click', () => this._closeMap());
    document.getElementById('btn-save').addEventListener(  'click', () => this._saveMap());
    document.getElementById('btn-export').addEventListener('click', () => this._exportMap());
    document.getElementById('btn-fit').addEventListener(   'click', () => { this.renderer.fitToScreen(this.map.rooms); this._render(); });

    // PCG
    document.getElementById('btn-add-pcg-room').addEventListener( 'click', () => this._addPcgRoom());
    document.getElementById('btn-regen-room').addEventListener(   'click', () => this._regenRoom());
    document.getElementById('btn-resize-pcg').addEventListener(   'click', () => this._resizePcgRoom());
    document.getElementById('btn-gan-fill').addEventListener(     'click', () => this._ganFillRoom());
    document.getElementById('btn-gan-start').addEventListener(    'click', () => this._startGanServer());
    document.getElementById('btn-gan-model').addEventListener(    'click', () => this._pickGanModel());
    document.getElementById('btn-randomize-seed').addEventListener('click', () => {
      document.getElementById('gen-seed').value = Math.floor(Math.random() * 4294967295);
    });
    document.getElementById('btn-generate').addEventListener('click', () => this._generate());

    // Toggles
    ['topology','grid','bg','entities','triggers'].forEach(key => {
      const el = document.getElementById('toggle-' + key); if (!el) return;
      const prop = 'show' + key.charAt(0).toUpperCase() + key.slice(1);
      el.addEventListener('change', e => { this.renderer[prop] = e.target.checked; this._render(); });
    });

    // Palette search
    document.getElementById('entity-search')?.addEventListener('input', e => this._filterPalette('entity', e.target.value));
    document.getElementById('trigger-search')?.addEventListener('input', e => this._filterPalette('trigger', e.target.value));

    // Room props modal
    const modal = document.getElementById('modal-room-props');
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this._closeModal());
    document.getElementById('mp-cancel')?.addEventListener(      'click', () => this._closeModal());
    document.getElementById('mp-apply')?.addEventListener(       'click', () => this._applyRoomProps());
    // Close modal when clicking backdrop
    modal?.addEventListener('click', (e) => { if (e.target === modal) this._closeModal(); });
    // Escape key to close modal
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal?.style.display === 'flex') this._closeModal(); });
    // Debug checkbox clicks
    ['mp-dark', 'mp-underwater', 'mp-space', 'mp-hasCheckpoint', 'mp-delayAltMusic'].forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.addEventListener('click', (e) => console.log('Checkbox clicked:', id, 'checked:', e.target.checked));
    });

    this._checkGeneratorPath();
    this._updateGanModelButton();
    this._startGanStatusPolling();
    this._render();
  }

  _resize() {
    const canvas = this.renderer.canvas, c = canvas.parentElement;
    canvas.width = c.clientWidth; canvas.height = c.clientHeight;
    this._render();
  }

  // ── Render loop ────────────────────────────────────────────────────────

  _render() {
    if (this._requestedRender) return;
    this._requestedRender = true;
    requestAnimationFrame(() => {
      this._requestedRender = false;
      this.renderer.render(
        this.map.rooms.length ? this.map : null,
        this.selectedIndices,
        this._hoverInfo,
        this._isCreating   ? this._createPreview : null,
        this._isRubberBand ? this._rubberBand     : null,
      );
      this._updateInspector();
      this._updateRoomList();
      this._updateTopology();
      this._updateStatusBar();
    });
  }

  // ── Tool management ────────────────────────────────────────────────────

  _setTool(t) {
    this.currentTool = t;
    document.querySelectorAll('[data-tool]').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === t));

    const show = (id, cond) => { const el = document.getElementById(id); if (el) el.style.display = cond ? 'block' : 'none'; };
    show('tile-palette-section',    t === 'fg' || t === 'bg');
    show('entity-palette-section',  t === 'entities');
    show('trigger-palette-section', t === 'triggers');

    const hints = {
      select:   'Click/drag to select. Drag handles to resize. Shift = multi-select.',
      create:   'Drag to draw a new room.',
      fg:       'Paint foreground tiles. Right-drag = erase.',
      bg:       'Paint background tiles.',
      entities: 'Click room to place entity.',
      triggers: 'Click room to place trigger.',
      erase:    'Click to erase tiles/entities.',
    };
    const hint = document.getElementById('tool-hint');
    if (hint) hint.textContent = hints[t] || '';

    if (t !== 'select') { this.selectedIndices.clear(); this._render(); }
  }

  // ── Palettes ───────────────────────────────────────────────────────────

  _buildTilePalette() {
    const pal = document.getElementById('tile-palette'); if (!pal) return;
    pal.innerHTML = '';
    for (const t of TILE_PALETTE) {
      const b = document.createElement('button');
      b.className = 'tile-btn'; b.dataset.tile = t; b.title = `Tile ${t}`; b.textContent = t;
      b.style.background = TILE_COLORS[t] || '#888';
      b.addEventListener('click', () => {
        this.currentTile = t;
        pal.querySelectorAll('.tile-btn').forEach(x => x.classList.toggle('active', x.dataset.tile === t));
      });
      if (t === this.currentTile) b.classList.add('active');
      pal.appendChild(b);
    }
    const er = document.createElement('button');
    er.className = 'tile-btn eraser'; er.dataset.tile = '0'; er.title = 'Erase'; er.textContent = '×';
    er.addEventListener('click', () => {
      this.currentTile = '0';
      pal.querySelectorAll('.tile-btn').forEach(x => x.classList.toggle('active', x.dataset.tile === '0'));
    });
    pal.appendChild(er);
  }

  _buildEntityPalette()  { this._buildObjPalette('entity',  ENTITY_TYPES,  'entity-palette',  et => { this.currentEntity  = et; }); }
  _buildTriggerPalette() { this._buildObjPalette('trigger', TRIGGER_TYPES, 'trigger-palette', tt => { this.currentTrigger = tt; }); }

  _buildObjPalette(kind, list, containerId, onSelect) {
    const pal = document.getElementById(containerId); if (!pal) return;
    pal.innerHTML = '';
    let lastCat = null;
    for (const item of list) {
      if (item.cat !== lastCat) {
        const hdr = document.createElement('div');
        hdr.className = 'palette-cat'; hdr.textContent = item.cat;
        pal.appendChild(hdr); lastCat = item.cat;
      }
      const b = document.createElement('button');
      b.className = `${kind}-btn`; b.textContent = item.name; b.dataset.name = item.name;
      const col = (kind === 'entity' ? ENTITY_COLOR[item.name] : '#ff8800') || '#aaa';
      b.style.cssText += `;border-left:3px solid ${col};color:${col}`;
      b.addEventListener('click', () => {
        onSelect(item);
        pal.querySelectorAll(`.${kind}-btn`).forEach(x => x.classList.toggle('active', x === b));
      });
      pal.appendChild(b);
    }
  }

  _filterPalette(kind, query) {
    const q   = query.toLowerCase();
    const sel = kind === 'entity' ? '#entity-palette' : '#trigger-palette';
    document.querySelectorAll(`${sel} .${kind}-btn`).forEach(b => {
      b.style.display = !q || b.dataset.name.toLowerCase().includes(q) ? '' : 'none';
    });
    document.querySelectorAll(`${sel} .palette-cat`).forEach(hdr => {
      let next = hdr.nextElementSibling, hasVis = false;
      while (next && !next.classList.contains('palette-cat')) {
        if (next.style.display !== 'none') hasVis = true;
        next = next.nextElementSibling;
      }
      hdr.style.display = hasVis ? '' : 'none';
    });
  }

  _buildModBrowser() {
    const div = document.getElementById('mod-browser'); if (!div) return;
    div.innerHTML = '';
    const tagColors = { tool:'#5278cc', framework:'#cc7744', campaign:'#44cc88', helper:'#cc44aa', docs:'#888' };
    for (const mod of MOD_BROWSER) {
      const tc   = tagColors[mod.tag] || '#888';
      const card = document.createElement('div');
      card.className = 'mod-card';
      card.innerHTML = `<div class="mod-name">${esc(mod.name)} <span class="mod-tag" style="background:${tc}22;color:${tc}">${esc(mod.tag)}</span></div><div class="mod-desc">${esc(mod.desc)}</div><a class="mod-link">${esc(mod.url.replace('https://github.com/', ''))}</a>`;
      card.querySelector('.mod-link').addEventListener('click', () => {
        if (window.electronAPI?.openExternal) window.electronAPI.openExternal(mod.url);
        else window.open(mod.url, '_blank');
      });
      div.appendChild(card);
    }
  }

  // ── Canvas events ──────────────────────────────────────────────────────

  _pos(e) {
    const r = this.renderer.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _onWheel(e) {
    e.preventDefault();
    const p = this._pos(e);
    this.renderer.zoomAt(p.x, p.y, -e.deltaY);
    this._render();
  }

  _onMouseDown(e) {
    const pos = this._pos(e);
    if (e.button === 2) return; // context menu handled separately

    // Middle-click or Alt+LMB = pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this._isPanning = true;
      this._panStart  = pos;
      this._panOrigin = { x: this.renderer.panX, y: this.renderer.panY };
      this.renderer.canvas.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;

    const { rooms } = this.map;

    if (this.currentTool === 'create') {
      const w = this.renderer.screenToWorld(pos.x, pos.y);
      this._isCreating   = true;
      this._createStart  = { x: snap8(w.x), y: snap8(w.y) };
      this._createPreview = { x0: this._createStart.x, y0: this._createStart.y, x1: this._createStart.x + 80, y1: this._createStart.y + 80 };
      return;
    }

    if (this.currentTool === 'select') {
      if (this.selectedIndices.size === 1) {
        const handle = this.renderer.getHandleAt(pos.x, pos.y, rooms[[...this.selectedIndices][0]]);
        if (handle) {
          this._isResize     = true;
          this._resizeDir    = handle;
          this._dragStart    = pos;
          const r            = rooms[[...this.selectedIndices][0]];
          this._resizeOrigin = { x: r.x, y: r.y, width: r.width, height: r.height };
          return;
        }
      }
      const ri = this.renderer.getRoomAt(pos.x, pos.y, rooms);
      if (ri >= 0) {
        if (e.shiftKey) {
          this.selectedIndices.has(ri) ? this.selectedIndices.delete(ri) : this.selectedIndices.add(ri);
        } else {
          if (!this.selectedIndices.has(ri)) { this.selectedIndices.clear(); this.selectedIndices.add(ri); }
        }
        this._isDragging   = true;
        this._dragStart    = pos;
        this._dragOrigins  = {};
        for (const idx of this.selectedIndices) {
          const r = rooms[idx]; this._dragOrigins[idx] = { x: r.x, y: r.y };
        }
      } else {
        if (!e.shiftKey) this.selectedIndices.clear();
        this._isRubberBand = true;
        this._rbStart      = pos;
        this._rubberBand   = { x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y };
      }
      this._render();
      return;
    }

    if (this.currentTool === 'fg' || this.currentTool === 'bg' || this.currentTool === 'erase') {
      const ri = this.renderer.getRoomAt(pos.x, pos.y, rooms);
      if (ri >= 0) {
        this.selectedIndices.clear();
        this.selectedIndices.add(ri);
        this._isPainting = true;
        this._paintTile(pos, ri);
      }
      return;
    }

    if (this.currentTool === 'entities') {
      const ri = this.renderer.getRoomAt(pos.x, pos.y, rooms);
      if (ri >= 0) this._placeEntity(pos, ri);
      return;
    }
    if (this.currentTool === 'triggers') {
      const ri = this.renderer.getRoomAt(pos.x, pos.y, rooms);
      if (ri >= 0) this._placeTrigger(pos, ri);
      return;
    }
  }

  _onMouseMove(e) {
    const pos = this._pos(e);

    if (this._isPanning) {
      const dx = (pos.x - this._panStart.x) / this.renderer.zoom;
      const dy = (pos.y - this._panStart.y) / this.renderer.zoom;
      this.renderer.panX = this._panOrigin.x + dx;
      this.renderer.panY = this._panOrigin.y + dy;
      this._render(); return;
    }

    if (this._isCreating && this._createStart) {
      const w = this.renderer.screenToWorld(pos.x, pos.y);
      this._createPreview = {
        x0: this._createStart.x, y0: this._createStart.y,
        x1: snap8(Math.max(w.x, this._createStart.x + 80)),
        y1: snap8(Math.max(w.y, this._createStart.y + 80)),
      };
      this._render(); return;
    }

    if (this._isResize && this._resizeDir) {
      const si   = [...this.selectedIndices][0];
      const room = this.map.rooms[si]; if (!room) return;
      const dx = (pos.x - this._dragStart.x) / this.renderer.zoom;
      const dy = (pos.y - this._dragStart.y) / this.renderer.zoom;
      const o = this._resizeOrigin, dir = this._resizeDir;
      let nx = o.x, ny = o.y, nw = o.width, nh = o.height;
      if (dir.includes('w')) { nx = snap8(o.x + dx); nw = snap8(Math.max(80, o.width  - dx)); }
      if (dir.includes('e')) {                        nw = snap8(Math.max(80, o.width  + dx)); }
      if (dir.includes('n')) { ny = snap8(o.y + dy); nh = snap8(Math.max(80, o.height - dy)); }
      if (dir.includes('s')) {                        nh = snap8(Math.max(80, o.height + dy)); }
      room.x = nx; room.y = ny; room.resize(nw, nh);
      this._setStatus(`Resize ${room.name}: ${nw}×${nh}`);
      this._render(); return;
    }

    if (this._isDragging) {
      const dx = (pos.x - this._dragStart.x) / this.renderer.zoom;
      const dy = (pos.y - this._dragStart.y) / this.renderer.zoom;
      for (const idx of this.selectedIndices) {
        const o = this._dragOrigins[idx];
        if (o) this.map.moveRoom(idx, snap8(o.x + dx), snap8(o.y + dy));
      }
      this._render(); return;
    }

    if (this._isRubberBand) {
      this._rubberBand = { x0: this._rbStart.x, y0: this._rbStart.y, x1: pos.x, y1: pos.y };
      const w1 = this.renderer.screenToWorld(Math.min(this._rbStart.x, pos.x), Math.min(this._rbStart.y, pos.y));
      const w2 = this.renderer.screenToWorld(Math.max(this._rbStart.x, pos.x), Math.max(this._rbStart.y, pos.y));
      this.selectedIndices.clear();
      for (let i = 0; i < this.map.rooms.length; i++) {
        const r = this.map.rooms[i];
        if (r.x < w2.x && r.x + r.width > w1.x && r.y < w2.y && r.y + r.height > w1.y) this.selectedIndices.add(i);
      }
      this._render(); return;
    }

    if (this._isPainting) {
      const ri = this.renderer.getRoomAt(pos.x, pos.y, this.map.rooms);
      if (ri >= 0) this._paintTile(pos, ri);
    }

    this._updateHover(pos);
    const w = this.renderer.screenToWorld(pos.x, pos.y);
    this._setStatus(`(${Math.floor(w.x)}, ${Math.floor(w.y)})  ×${this.renderer.zoom.toFixed(2)}`);
  }

  _onMouseUp(e) {
    if (this._isCreating && this._createPreview) {
      const p = this._createPreview;
      const x = Math.min(p.x0, p.x1), y = Math.min(p.y0, p.y1);
      const w = snap8(Math.max(80, Math.abs(p.x1 - p.x0)));
      const h = snap8(Math.max(80, Math.abs(p.y1 - p.y0)));
      const ri = this.map.addRoom(x, y, w, h);
      this.selectedIndices.clear(); this.selectedIndices.add(ri);
      this._isCreating = false; this._createPreview = null; this._createStart = null;
      this._setStatus(`Created ${this.map.rooms[ri].name} (${w}×${h})`);
      this._render(); return;
    }
    // Push single history entry for the completed resize/drag/paint stroke
    if (this._isResize)     { this.map.pushHistory(); this._isResize = false; this._resizeDir = null; this._resizeOrigin = null; }
    if (this._isDragging)   { this.map.pushHistory(); this._isDragging = false; this._dragOrigins = {}; }
    if (this._isPainting)   { this.map.pushHistory(); this._isPainting = false; this._lastTileKey = null; }
    if (this._isRubberBand) { this._isRubberBand = false; this._rubberBand = null; }
    this._isPanning = false;
    this.renderer.canvas.classList.remove('panning');
    this._render();
  }

  _onMouseLeave() {
    this._isPainting = this._isDragging = this._isPanning =
    this._isRubberBand = this._isCreating = this._isResize = false;
    this._hoverInfo = this._createPreview = this._rubberBand = null;
    this.renderer.canvas.classList.remove('panning');
    this._render();
  }

  _updateHover(pos) {
    const ri = this.renderer.getRoomAt(pos.x, pos.y, this.map.rooms);
    if (ri < 0) {
      if (this._hoverInfo) { this._hoverInfo = null; this._render(); }
      this.renderer.canvas.style.cursor = '';
      return;
    }
    const room = this.map.rooms[ri];
    if (this.currentTool === 'fg' || this.currentTool === 'bg' || this.currentTool === 'erase') {
      const tile = this.renderer.getTileAt(pos.x, pos.y, room);
      if (tile.valid && (!this._hoverInfo || this._hoverInfo.row !== tile.row || this._hoverInfo.col !== tile.col)) {
        this._hoverInfo = { type: 'tile', room, row: tile.row, col: tile.col };
        this._render();
      }
    } else if (this.currentTool === 'select') {
      if (!this._hoverInfo || this._hoverInfo.room !== room) {
        this._hoverInfo = { type: 'room', room }; this._render();
      }
      if (this.selectedIndices.size === 1) {
        const handle = this.renderer.getHandleAt(pos.x, pos.y, this.map.rooms[[...this.selectedIndices][0]]);
        this.renderer.canvas.style.cursor = handle ? this.renderer.getCursorForHandle(handle) : 'default';
      }
    } else {
      if (this._hoverInfo) { this._hoverInfo = null; this._render(); }
    }
  }

  // ── Edit ops ───────────────────────────────────────────────────────────

  _paintTile(pos, ri) {
    const room  = this.map.rooms[ri];
    const tile  = this.renderer.getTileAt(pos.x, pos.y, room);
    if (!tile.valid) return;
    const key = `${ri}:${tile.row}:${tile.col}`;
    if (key === this._lastTileKey) return;
    this._lastTileKey = key;

    // FIX: erase always erases the current layer, not hardcoded to fg
    const layer = this.currentTool === 'bg' ? 'bg' : 'fg';
    const brush = this.currentTool === 'erase' ? '0' : this.currentTile;
    this.map.setTile(ri, layer, tile.row, tile.col, brush);
    this._render();
  }

  _placeEntity(pos, ri) {
    const r = this.map.rooms[ri];
    const w = this.renderer.screenToWorld(pos.x, pos.y);
    this.map.addEntity(ri, this.currentEntity, snap8(w.x - r.x), snap8(w.y - r.y));
    this._render();
  }

  _placeTrigger(pos, ri) {
    const r = this.map.rooms[ri];
    const w = this.renderer.screenToWorld(pos.x, pos.y);
    this.map.addTrigger(ri, this.currentTrigger, snap8(w.x - r.x), snap8(w.y - r.y));
    this._render();
  }

  // ── Keyboard ───────────────────────────────────────────────────────────

  _onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const tag  = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }

    if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); if (this.map.undo()) { this._setStatus('Undo'); this._render(); } return; }
    if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); if (this.map.redo()) { this._setStatus('Redo'); this._render(); } return; }
    if (ctrl && e.key === 's') { e.preventDefault(); this._saveMap(); return; }
    if (ctrl && e.key === 'o') { e.preventDefault(); this._openMap(); return; }
    if (ctrl && e.key === 'n') { e.preventDefault(); this._newMap(); return; }
    if (ctrl && e.key === 'w') { e.preventDefault(); this._closeMap(); return; }
    if (ctrl && !e.shiftKey && e.key === 't') { e.preventDefault(); this._setTool('create'); return; }
    if (ctrl && e.shiftKey  && e.key === 'T') { e.preventDefault(); this._openRoomPropsModal(); return; }
    if (ctrl && e.key === 'a') { e.preventDefault(); this.selectedIndices = new Set(this.map.selectAll()); this._render(); return; }
    if (ctrl && e.key === 'c') { e.preventDefault(); this.map.copyRooms([...this.selectedIndices]); this._setStatus(`Copied ${this.selectedIndices.size}`); return; }
    if (ctrl && e.key === 'v') { e.preventDefault(); const p = this.map.pasteRooms(32, 32); if (p.length) { this.selectedIndices = new Set(p); this._render(); } return; }

    const toolMap = { v:'select', t:'create', f:'fg', b:'bg', e:'entities', g:'triggers', x:'erase' };
    if (!ctrl && !e.altKey && toolMap[e.key]) { this._setTool(toolMap[e.key]); return; }
    if (e.key === 'F' && e.shiftKey) { e.preventDefault(); this.renderer.fitToScreen(this.map.rooms); this._render(); return; }
    if (e.key === 'Escape') { this.selectedIndices.clear(); this._isCreating = false; this._createPreview = null; this._render(); return; }

    if (e.key === 'Delete' && this.currentTool === 'select' && this.selectedIndices.size > 0) {
      if (!confirm(`Delete ${this.selectedIndices.size} room(s)?`)) return;
      [...this.selectedIndices].sort((a, b) => b - a).forEach(i => this.map.deleteRoom(i));
      this.selectedIndices.clear(); this._render(); return;
    }

    // Alt+arrows: move rooms 8 px
    if (e.altKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 8;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp'   ? -step : e.key === 'ArrowDown'  ? step : 0;
      for (const i of this.selectedIndices) { const r = this.map.rooms[i]; if (r) { r.x += dx; r.y += dy; } }
      this.map.pushHistory(); this._render(); return;
    }

    // FIX: guard resize keys so unrelated keys don't fall through
    if (!ctrl && !e.altKey && this.currentTool === 'select' && this.selectedIndices.size === 1) {
      const step = 8, i = [...this.selectedIndices][0], room = this.map.rooms[i];
      if (!room) return;
      let changed = false;
      if (e.key === 'q') { room.resize(Math.max(80, room.width  - step), room.height); changed = true; }
      if (e.key === 'e') { room.resize(room.width  + step, room.height);               changed = true; }
      if (e.key === 'a') { room.resize(room.width, Math.max(80, room.height - step));  changed = true; }
      if (e.key === 'd') { room.resize(room.width, room.height + step);                changed = true; }
      if (changed) { e.preventDefault(); this.map.pushHistory(); this._setStatus(`Resized: ${room.width}×${room.height}`); this._render(); }
    }
  }

  // ── Context menu ───────────────────────────────────────────────────────

  _onCtxMenu(e) {
    e.preventDefault();
    this._isPanning = false;
    this.renderer.canvas.classList.remove('panning');
    const pos = this._pos(e);
    const ri  = this.renderer.getRoomAt(pos.x, pos.y, this.map.rooms);
    if (ri < 0) { this._hideCtxMenu(); return; }
    if (!this.selectedIndices.has(ri)) { this.selectedIndices.clear(); this.selectedIndices.add(ri); this._render(); }
    const menu = document.getElementById('ctx-menu');
    menu.style.left = `${e.clientX}px`; menu.style.top = `${e.clientY}px`; menu.style.display = 'block';
  }

  _hideCtxMenu() { const m = document.getElementById('ctx-menu'); if (m) m.style.display = 'none'; }

  _ctxAction(action) {
    console.log('_ctxAction:', action, 'selected:', this.selectedIndices.size);
    switch (action) {
      case 'props':      this._openRoomPropsModal(); break;
      case 'regen':      this._regenRoom(); break;
      case 'resize-pcg': this._resizePcgRoom(); break;
      case 'gan-fill':   this._ganFillRoom(); break;
      case 'copy':       this.map.copyRooms([...this.selectedIndices]); this._setStatus('Copied'); break;
      case 'paste': { const p = this.map.pasteRooms(32, 32); if (p.length) { this.selectedIndices = new Set(p); this._render(); } break; }
      case 'delete':
        if (this.selectedIndices.size && confirm(`Delete ${this.selectedIndices.size} room(s)?`)) {
          [...this.selectedIndices].sort((a, b) => b - a).forEach(i => this.map.deleteRoom(i));
          this.selectedIndices.clear(); this._render();
        }
        break;
    }
  }

  // ── PCG ops ────────────────────────────────────────────────────────────

  _genParams() {
    return {
      mode:       document.getElementById('gen-mode')?.value      || 'normal',
      layout:     document.getElementById('gen-layout')?.value    || 'linear',
      archetype:  document.getElementById('gen-archetype')?.value || 'forest',
      kit:        document.getElementById('gen-kit')?.value       || 'default',
      seed:       document.getElementById('gen-seed')?.value      || '',
      roomWidth:  parseInt(document.getElementById('gen-room-w')?.value)  || 320,
      roomHeight: parseInt(document.getElementById('gen-room-h')?.value)  || 184,
    };
  }

  async _generate() {
    const btn = document.getElementById('btn-generate');
    btn.disabled = true; btn.textContent = 'Generating…';
    this._setStatus('Generating…');
    const params = {
      ...this._genParams(),
      clusterWidth:  parseInt(document.getElementById('gen-cluster-w')?.value) || 3,
      clusterHeight: parseInt(document.getElementById('gen-cluster-h')?.value) || 2,
    };
    try {
      const data = await window.electronAPI.generateMap(params);
      this.map.loadFromGenerator(data);
      this.renderer.fitToScreen(this.map.rooms);
      this.selectedIndices.clear();
      this._render();
      const summary = data.summary || `${data.rooms.length} rooms`;
      document.getElementById('gen-summary').textContent = summary;
      this._setStatus(summary);
      if (data.seedLabel) {
        const n = data.seedLabel.replace(/\D/g, '');
        if (n) document.getElementById('gen-seed').value = n;
      }
    } catch (err) {
      const msg = err?.error || err?.message || String(err);
      this._setStatus(`Error: ${msg}`);
      document.getElementById('gen-summary').textContent = `Error: ${msg}`;
      alert(`Generator error:\n\n${msg}`);
    } finally {
      btn.disabled = false; btn.textContent = '▶ Generate';
    }
  }

  async _addPcgRoom() {
    this._setStatus('Generating single room…');
    try {
      const data = await window.electronAPI.generateSingleRoom(this._genParams());
      if (!data.rooms?.[0]) throw new Error('No room returned');
      let maxX = 0;
      for (const r of this.map.rooms) maxX = Math.max(maxX, r.x + r.width);
      const src = data.rooms[0]; src.x = maxX + 32; src.y = 0;
      const room = new Room(src), ri = this.map.rooms.length;
      this.map.rooms.push(room); this.map.pushHistory();
      this.selectedIndices.clear(); this.selectedIndices.add(ri);
      this.renderer.fitToScreen(this.map.rooms);
      this._render(); this._setStatus(`Added ${room.name} via PCG`);
    } catch (err) {
      const msg = err?.error || err?.message || String(err);
      this._setStatus(`PCG Error: ${msg}`); alert(msg);
    }
  }

  async _regenRoom() {
    if (this.selectedIndices.size !== 1) { this._setStatus('Select exactly one room to regenerate'); return; }
    const ri   = [...this.selectedIndices][0];
    const room = this.map.rooms[ri]; if (!room) return;
    this._setStatus('Regenerating room…');
    try {
      const data = await window.electronAPI.generateSingleRoom({ ...this._genParams(), roomWidth: room.width, roomHeight: room.height });
      if (!data.rooms?.[0]) throw new Error('No room returned');
      const src = data.rooms[0];
      this.map.replaceRoomTiles(ri, src.tilesFg?.tiles, src.tilesBg?.tiles, src.entities);
      this._render(); this._setStatus(`Regenerated ${room.name}`);
    } catch (err) {
      const msg = err?.error || err?.message || String(err);
      this._setStatus(`PCG Error: ${msg}`); alert(msg);
    }
  }

  async _resizePcgRoom() {
    if (this.selectedIndices.size !== 1) { this._setStatus('Select one room first'); return; }
    const ri   = [...this.selectedIndices][0];
    const room = this.map.rooms[ri]; if (!room) return;
    const wStr = prompt('New width (px, multiple of 8):', String(room.width));
    const hStr = prompt('New height (px, multiple of 8):', String(room.height));
    if (!wStr || !hStr) return;
    const nw = snap8(clamp(parseInt(wStr) || room.width,  80, 2048));
    const nh = snap8(clamp(parseInt(hStr) || room.height, 80, 2048));
    room.resize(nw, nh);
    this.map.pushHistory();
    this._render(); this._setStatus('Resized, regenerating…');
    await this._regenRoom();
  }

  async _ganFillRoom() {
    if (this.selectedIndices.size !== 1) { this._setStatus('Select exactly one room for GAN fill'); return; }
    const ri   = [...this.selectedIndices][0];
    const room = this.map.rooms[ri]; if (!room) return;
    this._setStatus('GAN filling room…');
    const kit = document.getElementById('gen-kit')?.value || 'house';
    try {
      const health = await window.electronAPI.ganHealth({ port: 5555 });
      if (!(health?.status === 'ok' && health.model_loaded)) {
        await this._refreshGanStatus();
        throw new Error('GAN server is offline. Click "Start GAN Server" first.');
      }
      const result = await window.electronAPI.ganFillRoom({ width: room.width, height: room.height, kit, temperature: 1.0 });
      if (result.error) throw new Error(result.error);
      if (!result.tiles?.length) throw new Error('No tiles returned');
      this.map.pushHistory();
      room.tilesFg = { tiles: result.tiles };
      this._render();
      this._setStatus(`GAN filled ${room.name} (${result.width}×${result.height} tiles)`);
    } catch (err) {
      const msg = String(err?.error || err?.message || err).replace(/^Error invoking remote method 'gan-fill-room':\s*/i, '');
      this._setStatus(`GAN Error: ${msg}`);
      alert(`GAN Fill failed:\n\n${msg}`);
    }
  }

  // ── File ops ───────────────────────────────────────────────────────────

  _resetTransients() {
    this.selectedIndices.clear();
    this._isPainting = this._isDragging = this._isResize =
    this._isPanning  = this._isRubberBand = this._isCreating = false;
    this._resizeDir  = null;
    this._panStart   = this._panOrigin   = null;
    this._dragStart  = null; this._dragOrigins = {};
    this._rbStart    = this._resizeOrigin = null;
    this._createStart = this._createPreview = null;
    this._rubberBand  = this._hoverInfo     = null;
    this._lastTileKey = null;
    this._lastInspectorRoomIdx = -2;
  }

  _applyLoadedMap(statusMsg) {
    this._resetTransients();
    this.renderer.resetView();
    this._resize();
    this._render();
    requestAnimationFrame(() => {
      this._resize();
      this.renderer.fitToScreen(this.map.rooms);
      this._render();
      if (statusMsg) this._setStatus(statusMsg);
    });
  }

  async _newMap() {
    if (this.map.isDirty && this.map.rooms.length > 0 && !confirm('Discard unsaved changes?')) return;
    this.map = new MapModel();
    document.getElementById('gen-summary').textContent = '';
    this._applyLoadedMap('New map');
  }

  async _closeMap() {
    if (this.map.isDirty && this.map.rooms.length > 0 && !confirm('Close map and discard unsaved changes?')) return;
    this.map = new MapModel();
    const gs = document.getElementById('gen-summary'); if (gs) gs.textContent = '';
    const topo = document.getElementById('topology-info');
    if (topo) topo.innerHTML = '<p class="no-selection">Generate a map to see topology.</p>';
    this._applyLoadedMap('Map closed');
  }

  async _openMap() {
    try {
      const r = await window.electronAPI.openMap();
      if (!r) return;
      if (this.map.isDirty && this.map.rooms.length > 0 && !confirm('Discard unsaved changes to current map?')) return;
      this.map = new MapModel();
      this.map.loadFromJSON(r.content, r.filePath);
      this.map._isBinary = typeof r.filePath === 'string' && /\.bin$/i.test(r.filePath);
      this._applyLoadedMap(`Opened: ${r.filePath}`);
    } catch (err) {
      alert(`Failed to open:\n${err.message || err}`);
    }
  }

  async _saveMap() {
    try {
      const path = await window.electronAPI.saveMap(this.map.toJSON(), this.map.filePath);
      if (path) { this.map._filePath = path; this.map._dirty = false; this._render(); this._setStatus(`Saved: ${path}`); }
    } catch (err) { alert(`Failed to save:\n${err.message || err}`); }
  }

  async _exportMap() {
    try {
      const p = await window.electronAPI.saveMap(this.map.toJSON(), null);
      if (p) this._setStatus(`Exported: ${p}`);
    } catch (err) { alert(`Failed to export:\n${err.message || err}`); }
  }

  // ── Room props modal ───────────────────────────────────────────────────

  _openRoomPropsModal() {
    console.log('_openRoomPropsModal called, selected:', this.selectedIndices.size);
    if (this.selectedIndices.size !== 1) { console.log('Modal: need exactly 1 room selected'); return; }
    const ri = [...this.selectedIndices][0], r = this.map.rooms[ri]; if (!r) { console.log('Modal: room not found'); return; }
    const set = (id, v) => { const el = document.getElementById(id); if (!el) return; el.type === 'checkbox' ? el.checked = !!v : el.value = v ?? ''; };
    set('mp-name', r.name); set('mp-x', r.x); set('mp-y', r.y); set('mp-w', r.width); set('mp-h', r.height);
    set('mp-music', r.music); set('mp-ambience', r.ambience); set('mp-wind', r.wind); set('mp-color', r.color);
    set('mp-dark', r.dark); set('mp-underwater', r.underwater); set('mp-space', r.space);
    set('mp-hasCheckpoint', r.hasCheckpoint); set('mp-delayAltMusic', r.delayAltMusic);
    console.log('Opened modal, room checkpoint:', r.hasCheckpoint);
    document.getElementById('modal-room-props').style.display = 'flex';
  }

  _closeModal() { document.getElementById('modal-room-props').style.display = 'none'; }

  _applyRoomProps() {
    console.log('_applyRoomProps called, selected:', this.selectedIndices.size);
    if (this.selectedIndices.size !== 1) { console.log('Apply: need exactly 1 room'); this._closeModal(); return; }
    const ri = [...this.selectedIndices][0], r = this.map.rooms[ri]; if (!r) { console.log('Apply: room not found'); return; }
    const get = (id) => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };
    const nw = snap8(clamp(parseInt(get('mp-w')) || r.width,  80, 2048));
    const nh = snap8(clamp(parseInt(get('mp-h')) || r.height, 80, 2048));
    if (nw !== r.width || nh !== r.height) r.resize(nw, nh);
    r.name        = get('mp-name') || r.name;
    r.x           = snap8(parseInt(get('mp-x')) || r.x);
    r.y           = snap8(parseInt(get('mp-y')) || r.y);
    r.music       = get('mp-music'); r.ambience = get('mp-ambience'); r.wind = get('mp-wind');
    r.color       = parseInt(get('mp-color')) || 0;
    r.dark        = get('mp-dark'); r.underwater = get('mp-underwater'); r.space = get('mp-space');
    r.hasCheckpoint = get('mp-hasCheckpoint'); r.delayAltMusic = get('mp-delayAltMusic');
    console.log('Applied checkpoint:', r.hasCheckpoint, 'room:', r.name);
    this.map.pushHistory();
    this._lastInspectorRoomIdx = -2; // force inspector redraw
    this._closeModal(); this._render(); this._setStatus(`Updated ${r.name}`);
  }

  // ── Inspector panel ────────────────────────────────────────────────────
  // FIX: dirty-check selected room to avoid full DOM rebuild every frame

  _updateInspector() {
    const pane = document.getElementById('inspector-content'); if (!pane) return;
    if (this.selectedIndices.size === 0) {
      if (this._lastInspectorRoomIdx !== -1) {
        pane.innerHTML = '<p class="no-selection">No room selected.</p>';
        this._lastInspectorRoomIdx = -1;
      }
      return;
    }
    if (this.selectedIndices.size > 1) {
      if (this._lastInspectorRoomIdx !== -3) {
        pane.innerHTML = `<p class="no-selection">${this.selectedIndices.size} rooms selected.<br>Alt+arrows to move.<br>Q/E = width, A/D = height.</p>`;
        this._lastInspectorRoomIdx = -3;
      }
      return;
    }
    const ri = [...this.selectedIndices][0];
    // Only rebuild if a different room was selected
    if (ri === this._lastInspectorRoomIdx) return;
    this._lastInspectorRoomIdx = ri;

    const room = this.map.rooms[ri]; if (!room) return;
    pane.innerHTML = `
      <div class="inspector-field"><label>Name</label><input id="insp-name" type="text" value="${esc(room.name)}"/></div>
      <div class="inspector-field"><label>Pos</label><div class="inspector-row"><input id="insp-x" type="number" value="${room.x}" step="8"/><input id="insp-y" type="number" value="${room.y}" step="8"/></div></div>
      <div class="inspector-field"><label>Size</label><div class="inspector-row"><input id="insp-w" type="number" value="${room.width}" step="8" min="80"/><input id="insp-h" type="number" value="${room.height}" step="8" min="80"/></div></div>
      <div class="inspector-field"><label>Music</label><input id="insp-music" type="text" value="${esc(room.music || '')}"/></div>
      <div class="inspector-field"><label>Color</label><select id="insp-color">${ROOM_COLORS.map((c, i) => `<option value="${i}"${room.color === i ? ' selected' : ''}>${i}</option>`).join('')}</select></div>
      <div class="inspector-flags">
        <label><input id="insp-dark"       type="checkbox" ${room.dark       ? 'checked' : ''}/> Dark</label>
        <label><input id="insp-underwater" type="checkbox" ${room.underwater ? 'checked' : ''}/> Water</label>
        <label><input id="insp-space"      type="checkbox" ${room.space      ? 'checked' : ''}/> Space</label>
        ${room.hasCheckpoint ? '<span style="color:var(--warning);font-size:10px;margin-left:auto;">CP</span>' : ''}
      </div>
      <div class="inspector-field"><label>Entities <span class="count-badge">${room.entities.length}</span></label>
        <div class="entity-scroll">${room.entities.length ? room.entities.map(e => `<div class="entity-item" style="border-left:2px solid ${ENTITY_COLOR[e.name] || '#aaa'}">${esc(e.name)}</div>`).join('') : '<span class="empty-label">none</span>'}</div>
      </div>
      <div class="inspector-field"><label>Triggers <span class="count-badge">${room.triggers.length}</span></label>
        <div class="entity-scroll">${room.triggers.length ? room.triggers.map(t => `<div class="entity-item" style="border-left:2px solid #ff8800">${esc(t.name)}</div>`).join('') : '<span class="empty-label">none</span>'}</div>
      </div>
      <button id="insp-open-props" style="margin-top:6px;width:100%;background:#2a305e;border:1px solid #446;color:#aad;padding:4px;cursor:pointer;font-size:11px">Room Properties (Ctrl+Shift+T)</button>
    `;
    const upd = (id, setter) => {
      const el = document.getElementById(id); if (!el) return;
      el.addEventListener('change', () => { setter(el); this._lastInspectorRoomIdx = -2; this.map.pushHistory(); this._render(); });
    };
    upd('insp-name',       el => room.name = el.value);
    upd('insp-x',          el => { room.x = snap8(parseInt(el.value) || 0); });
    upd('insp-y',          el => { room.y = snap8(parseInt(el.value) || 0); });
    upd('insp-w',          el => room.resize(snap8(clamp(parseInt(el.value) || room.width,  80, 2048)), room.height));
    upd('insp-h',          el => room.resize(room.width, snap8(clamp(parseInt(el.value) || room.height, 80, 2048))));
    upd('insp-music',      el => room.music = el.value);
    upd('insp-color',      el => room.color = parseInt(el.value));
    upd('insp-dark',       el => room.dark        = el.checked);
    upd('insp-underwater', el => room.underwater  = el.checked);
    upd('insp-space',      el => room.space       = el.checked);
    // Debug inspector checkbox clicks
    ['insp-dark', 'insp-underwater', 'insp-space'].forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.addEventListener('click', (e) => console.log('Inspector checkbox clicked:', id, 'checked:', e.target.checked));
    });
    const propsBtn = document.getElementById('insp-open-props');
    if (propsBtn) {
      // Clone to remove any old listeners
      const newBtn = propsBtn.cloneNode(true);
      propsBtn.parentNode.replaceChild(newBtn, propsBtn);
      newBtn.addEventListener('click', () => this._openRoomPropsModal());
    }
  }

  // ── Room List panel ────────────────────────────────────────────────────

  _updateRoomList() {
    const pane = document.getElementById('rooms-content'); if (!pane) return;
    if (!this.map.rooms.length) {
      pane.innerHTML = '<p class="no-selection">No rooms yet.<br/>Click Generate to create rooms.</p>';
      return;
    }
    let html = `<div class="room-list-header"><span>${this.map.rooms.length} rooms</span><span>Click to focus</span></div>`;
    html += `<div class="room-list-actions"><button id="btn-select-all-rooms">Select All</button><button id="btn-fit-rooms">Fit View</button></div>`;
    html += '<ul class="room-list">';
    for (let i = 0; i < this.map.rooms.length; i++) {
      const r = this.map.rooms[i];
      const isSel = this.selectedIndices.has(i);
      const color = ROOM_COLORS[r.color % ROOM_COLORS.length] || '#4a5a7a';
      html += `<li class="room-item${isSel ? ' selected' : ''}" data-index="${i}">
        <span class="room-color" style="background:${color}"></span>
        <span class="room-name">${esc(r.name)}${r.hasCheckpoint ? ' <span class="checkpoint-badge">CP</span>' : ''}</span>
        <span class="room-pos">${r.x},${r.y}</span>
      </li>`;
    }
    html += '</ul>';
    pane.innerHTML = html;

    pane.querySelectorAll('.room-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const idx = parseInt(item.dataset.index);
        if (e.shiftKey) { this.selectedIndices.has(idx) ? this.selectedIndices.delete(idx) : this.selectedIndices.add(idx); }
        else { this.selectedIndices.clear(); this.selectedIndices.add(idx); }
        this._centerOnRoom(idx);
        this._render();
      });
    });
    document.getElementById('btn-select-all-rooms')?.addEventListener('click', () => {
      this.selectedIndices = new Set(this.map.selectAll()); this._render();
    });
    document.getElementById('btn-fit-rooms')?.addEventListener('click', () => {
      this.renderer.fitToScreen(this.map.rooms); this._render();
    });
  }

  _centerOnRoom(index) {
    const r = this.map.rooms[index]; if (!r) return;
    this.renderer.panX = (this.renderer.canvas.width  / 2 / this.renderer.zoom) - (r.x + r.width  / 2);
    this.renderer.panY = (this.renderer.canvas.height / 2 / this.renderer.zoom) - (r.y + r.height / 2);
  }

  // ── Topology panel ─────────────────────────────────────────────────────

  _updateTopology() {
    const div  = document.getElementById('topology-info'); if (!div) return;
    const meta = this.map.previewMetadata;
    if (!meta) { div.innerHTML = '<p class="no-selection">Generate a map to see topology.</p>'; return; }
    const nodes   = meta.nodes || [];
    const mainLen = (meta.mainPathNodeIds || []).length;
    const roles   = {};
    for (const n of nodes) roles[n.role] = (roles[n.role] || 0) + 1;
    div.innerHTML = `
      <div class="topo-row"><span class="topo-label">Rooms</span><span class="topo-value">${this.map.rooms.length}</span></div>
      <div class="topo-row"><span class="topo-label">Layout</span><span class="topo-value">${esc(meta.layoutMode || '—')}</span></div>
      <div class="topo-row"><span class="topo-label">Main path</span><span class="topo-path">${mainLen} nodes</span></div>
      ${Object.entries(roles).map(([r, n]) => `<div class="topo-row"><span class="topo-label">&nbsp;${r}</span><span class="topo-branch">${n}</span></div>`).join('')}
      <div class="topo-row" style="margin-top:5px"><span class="topo-label">Start</span><span class="topo-value">node ${meta.startNodeId ?? '—'}</span></div>
      <div class="topo-row"><span class="topo-label">Goal</span><span class="topo-value">node ${meta.goalNodeId ?? '—'}</span></div>
    `;
  }

  // ── Status bar ─────────────────────────────────────────────────────────

  _setStatus(msg) { this._statusMsg = msg; }

  _updateStatusBar() {
    const dirty = this.map.isDirty ? '*' : '';
    const fp    = this.map.filePath ? this.map.filePath.split(/[\\\/]/).pop() : 'Untitled';
    const el    = document.getElementById('status-bar');
    if (el) el.textContent = `${fp}${dirty}  ·  ${this._statusMsg}  ·  rooms:${this.map.rooms.length}  ·  sel:${this.selectedIndices.size}  ·  ${this.currentTool}`;
  }

  // ── Generator status ───────────────────────────────────────────────────

  async _checkGeneratorPath() {
    try {
      const info = await window.electronAPI.getGeneratorPath();
      const el   = document.getElementById('generator-status'); if (!el) return;
      el.textContent = info.exists ? '● Generator ready' : '✗ Generator not found';
      el.className   = `gen-status ${info.exists ? 'gen-ok' : 'gen-error'}`;
      el.title       = info.path;
    } catch (_) {}
  }

  // ── GAN ────────────────────────────────────────────────────────────────

  _setGanStatusBadge(cls, text, title = '') {
    const el = document.getElementById('gan-status'); if (!el) return;
    el.className   = `gen-status ${cls}`;
    el.textContent = text;
    el.title       = title;
  }

  _setGanStartButtonState(disabled, text, title) {
    const btn = document.getElementById('btn-gan-start'); if (!btn) return;
    btn.disabled = !!disabled;
    if (text)  btn.textContent = text;
    if (title) btn.title       = title;
  }

  _updateGanModelButton() {
    const btn = document.getElementById('btn-gan-model'); if (!btn) return;
    if (this._ganModelPath) {
      const parts = this._ganModelPath.split(/[\\/]/);
      btn.textContent = `Model: ${parts[parts.length - 1] || this._ganModelPath}`;
      btn.title       = this._ganModelPath;
    } else {
      btn.textContent = 'GAN Model…';
      btn.title       = 'Choose a GAN model checkpoint (.pt/.pth). Default: celeste-gan/checkpoints/celeste_gan.pt';
    }
  }

  async _pickGanModel() {
    try {
      const picked = await window.electronAPI.ganPickModel({ initialPath: this._ganModelPath });
      if (!picked?.path) return;
      this._ganModelPath = picked.path;
      this._updateGanModelButton();
      const parts = picked.path.split(/[\\/]/);
      this._setStatus(`GAN model: ${parts[parts.length - 1] || picked.path}`);
    } catch (err) {
      const msg = String(err?.error || err?.message || err).replace(/^Error invoking remote method 'gan-pick-model':\s*/i, '');
      this._setStatus(`GAN model selection failed: ${msg}`);
      alert(`Failed to select GAN model:\n\n${msg}`);
    }
  }

  _startGanStatusPolling() {
    this._refreshGanStatus();
    if (this._ganStatusTimer) clearInterval(this._ganStatusTimer);
    this._ganStatusTimer = setInterval(() => this._refreshGanStatus(), 5000);
    window.addEventListener('beforeunload', () => {
      clearInterval(this._ganStatusTimer); this._ganStatusTimer = null;
    }, { once: true });
  }

  async _refreshGanStatus() {
    if (this._ganStatusRefreshInFlight) return;
    this._ganStatusRefreshInFlight = true;
    try {
      if (this._ganStartInProgress) {
        this._setGanStatusBadge('gen-checking', '● GAN starting…', 'Launching local GAN server');
        this._setGanStartButtonState(true, 'Starting…', 'Launching local GAN HTTP server');
        return;
      }
      const health = await window.electronAPI.ganHealth({ port: 5555 });
      if (health?.status === 'ok' && health.model_loaded) {
        this._setGanStatusBadge('gen-ok',   '● GAN ready',            'GAN server online and model loaded');
        this._setGanStartButtonState(true, 'GAN Running',             'GAN server is already running');
      } else if (health?.status === 'ok') {
        this._setGanStatusBadge('gen-warn', '● GAN online (loading)', 'GAN server reachable but model not loaded');
        this._setGanStartButtonState(true, 'Loading…',               'GAN model still loading');
      } else {
        this._setGanStatusBadge('gen-error', health?.status === 'timeout' ? '✗ GAN timeout' : '✗ GAN offline', 'GAN server not reachable');
        this._setGanStartButtonState(false, 'Start GAN Server', 'Start local GAN HTTP server on port 5555');
      }
    } catch {
      this._setGanStatusBadge('gen-error', '✗ GAN offline', 'GAN server not reachable');
      this._setGanStartButtonState(false, 'Start GAN Server', 'Start local GAN HTTP server on port 5555');
    } finally {
      this._ganStatusRefreshInFlight = false;
    }
  }

  async _waitForGanReady(timeoutMs = 18000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const health = await window.electronAPI.ganHealth({ port: 5555 });
        if (health?.status === 'ok' && health.model_loaded) return true;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 450));
    }
    return false;
  }

  async _startGanServer() {
    if (this._ganStartInProgress) return;
    this._ganStartInProgress = true;
    this._setGanStatusBadge('gen-checking', '● GAN starting…', 'Launching local GAN server');
    this._setGanStartButtonState(true, 'Starting…', 'Launching local GAN HTTP server');
    this._setStatus('Starting GAN server…');
    try {
      let result = null;
      try {
        const startParams = { port: 5555 };
        if (this._ganModelPath) startParams.modelPath = this._ganModelPath;
        result = await window.electronAPI.ganStartServer(startParams);
      } catch (startErr) {
        const msg = String(startErr?.error || startErr?.message || startErr).replace(/^Error invoking remote method 'gan-start-server':\s*/i, '');
        if (/GAN model not found at:/i.test(msg)) {
          if (confirm('GAN model checkpoint not found.\n\nPick a .pt/.pth model file now?')) {
            await this._pickGanModel();
            if (!this._ganModelPath) throw startErr;
            result = await window.electronAPI.ganStartServer({ port: 5555, modelPath: this._ganModelPath });
          } else { throw startErr; }
        } else { throw startErr; }
      }
      const ready = await this._waitForGanReady(result?.warmingUp ? 28000 : 14000);
      await this._refreshGanStatus();
      this._setStatus(ready ? 'GAN server is ready' : result?.alreadyRunning ? 'GAN server already running' : 'GAN server started (loading…)');
    } catch (err) {
      const msg = String(err?.error || err?.message || err).replace(/^Error invoking remote method 'gan-start-server':\s*/i, '');
      this._setGanStatusBadge('gen-error', '✗ GAN offline', msg);
      this._setGanStartButtonState(false, 'Start GAN Server', 'Start local GAN HTTP server on port 5555');
      this._setStatus(`GAN start failed: ${msg}`);
      alert(`Failed to start GAN server:\n\n${msg}`);
    } finally {
      this._ganStartInProgress = false;
      await this._refreshGanStatus();
    }
  }
}
