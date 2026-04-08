'use strict';

// ============================================================
// TILE / ROOM COLOURS
// ============================================================
const TILE_SIZE = 8;

const TILE_COLORS = {
  '1':'#43567e','2':'#744646','3':'#8b76c4','4':'#c57047',
  '5':'#999675','6':'#548c66','7':'#5a5f6c','8':'#4d7a81',
  '9':'#8a6a48','a':'#7c5c3d','b':'#6b7b55','c':'#7c6b4e',
  'd':'#5a7c6b','e':'#7c4a4a','f':'#4a5a7c','g':'#7c7c4a',
  'h':'#4a7c7c','i':'#6b564e','j':'#7c6b7c','k':'#5a6b7c',
};

const ROOM_COLORS = [
  '#4a5a7a','#7a4a4a','#7a6a4a','#4a7a4a',
  '#4a6a7a','#6a4a7a','#7a4a6a','#6a7a4a',
];

const ENTITY_COLOR = {
  player:'#00ff88',strawberry:'#ff4040',goldenBerry:'#ffd700',
  spring:'#00ffcc',booster:'#ff8800',refill:'#00aaff',checkpoint:'#ffff44',
  jumpThru:'#cc9955',spikesUp:'#ff5555',spikesDown:'#ff5555',
  spikesLeft:'#ff5555',spikesRight:'#ff5555',zipMover:'#8888ff',
  fallingBlock:'#cc7744',crumbleBlock:'#aa6644',moveBlock:'#4488cc',
  killbox:'#cc2222',tentacles:'#aa44cc',colorSwitch:'#44ccaa',
  bonfire:'#ff6622',flutterbird:'#88ccff',npc:'#ffcc88',
  friendlyGhost:'#ccaaff',oshiro:'#ff88aa',
  badelineBoost:'#8844cc',badeline:'#cc4488',seeker:'#cc4444',
  dreamBlock:'#224466',switchGate:'#44cc88',
  cassette:'#ff66aa',cassetteBlock:'#ff66aa',
  dreamBerry:'#6644cc',linkedZipMover:'#6688ff',
  customSpinner:'#aaeeff',customBooster:'#ffcc44',
  decal:'#888844',trigger:'#ff8800',
};

const TILE_PALETTE = ['1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'];

// ============================================================
// ENTITY CATALOGUE  (60+ types)
// ============================================================
const ENTITY_TYPES = [
  { name:'player',           w:8,  h:11, cat:'Spawn' },
  { name:'checkpoint',       w:36, h:36, cat:'Spawn' },
  { name:'strawberry',       w:14, h:14, cat:'Collectible' },
  { name:'goldenBerry',      w:14, h:14, cat:'Collectible' },
  { name:'cassette',         w:16, h:16, cat:'Collectible' },
  { name:'heartGem',         w:16, h:16, cat:'Collectible' },
  { name:'key',              w:12, h:12, cat:'Collectible' },
  { name:'berryFlying',      w:14, h:14, cat:'Collectible' },
  { name:'spring',           w:8,  h:6,  cat:'Aid' },
  { name:'booster',          w:18, h:18, cat:'Aid' },
  { name:'greenBooster',     w:18, h:18, cat:'Aid' },
  { name:'refill',           w:16, h:16, cat:'Aid' },
  { name:'twoDashRefill',    w:16, h:16, cat:'Aid' },
  { name:'feather',          w:16, h:16, cat:'Aid' },
  { name:'dreamBlock',       w:64, h:24, cat:'Aid', resizable:true },
  { name:'switchGate',       w:32, h:32, cat:'Aid', resizable:true },
  { name:'bumper',           w:24, h:24, cat:'Aid' },
  { name:'badelineBoost',    w:16, h:16, cat:'Aid' },
  { name:'puffer',           w:12, h:12, cat:'Aid' },
  { name:'jumpThru',         w:64, h:5,  cat:'Platform', resizable:true },
  { name:'fallingBlock',     w:48, h:8,  cat:'Platform', resizable:true },
  { name:'crumbleBlock',     w:16, h:8,  cat:'Platform', resizable:true },
  { name:'moveBlock',        w:24, h:24, cat:'Platform', resizable:true },
  { name:'zipMover',         w:16, h:16, cat:'Platform' },
  { name:'floatySpaceBlock', w:16, h:16, cat:'Platform', resizable:true },
  { name:'risingLava',       w:16, h:16, cat:'Platform' },
  { name:'sandwichLava',     w:16, h:16, cat:'Platform' },
  { name:'movingPlatform',   w:64, h:8,  cat:'Platform' },
  { name:'sinkingPlatform',  w:64, h:8,  cat:'Platform' },
  { name:'trapdoor',         w:32, h:16, cat:'Platform', resizable:true },
  { name:'spikesUp',         w:8,  h:4,  cat:'Hazard', resizable:true },
  { name:'spikesDown',       w:8,  h:4,  cat:'Hazard', resizable:true },
  { name:'spikesLeft',       w:4,  h:8,  cat:'Hazard', resizable:true },
  { name:'spikesRight',      w:4,  h:8,  cat:'Hazard', resizable:true },
  { name:'killbox',          w:64, h:16, cat:'Hazard', resizable:true },
  { name:'tentacles',        w:12, h:24, cat:'Hazard' },
  { name:'seeker',           w:12, h:12, cat:'Hazard' },
  { name:'eyebat',           w:16, h:16, cat:'Hazard' },
  { name:'bat',              w:8,  h:8,  cat:'Hazard' },
  { name:'fireBarrier',      w:16, h:16, cat:'Hazard', resizable:true },
  { name:'npc',              w:8,  h:16, cat:'NPC' },
  { name:'friendlyGhost',    w:16, h:16, cat:'NPC' },
  { name:'oshiro',           w:16, h:24, cat:'NPC' },
  { name:'badeline',         w:8,  h:16, cat:'NPC' },
  { name:'theo',             w:8,  h:16, cat:'NPC' },
  { name:'bird',             w:16, h:16, cat:'NPC' },
  { name:'flutterbird',      w:16, h:16, cat:'NPC' },
  { name:'granny',           w:16, h:16, cat:'NPC' },
  { name:'bonfire',          w:16, h:16, cat:'Env' },
  { name:'waterfall',        w:8,  h:32, cat:'Env', resizable:true },
  { name:'water',            w:32, h:32, cat:'Env', resizable:true },
  { name:'cassetteBlock',    w:32, h:16, cat:'Env', resizable:true },
  { name:'colorSwitch',      w:16, h:16, cat:'Env' },
  { name:'bigWaterfall',     w:8,  h:64, cat:'Env', resizable:true },
  { name:'glassBlock',       w:32, h:32, cat:'Env', resizable:true },
  { name:'darkChaser',       w:8,  h:16, cat:'Env' },
  { name:'dreamBerry',       w:14, h:14, cat:'CommunalHelper' },
  { name:'linkedZipMover',   w:16, h:16, cat:'CommunalHelper' },
  { name:'customSpinner',    w:16, h:16, cat:'FrostHelper' },
  { name:'customBooster',    w:18, h:18, cat:'FrostHelper' },
  { name:'coloredBumper',    w:24, h:24, cat:'MaxHelpingHand' },
  { name:'flagTogglePedestal',w:16,h:24, cat:'MaxHelpingHand' },
];

// ============================================================
// TRIGGER CATALOGUE  (30+ types)
// ============================================================
const TRIGGER_TYPES = [
  { name:'musicTrigger',             w:64, h:24, cat:'Audio' },
  { name:'musicFadeTrigger',         w:64, h:24, cat:'Audio' },
  { name:'ambienceParamTrigger',     w:64, h:24, cat:'Audio' },
  { name:'soundAreaTrigger',         w:64, h:24, cat:'Audio' },
  { name:'altMusicTrigger',          w:64, h:24, cat:'Audio' },
  { name:'cameraOffsetTrigger',      w:64, h:24, cat:'Camera' },
  { name:'cameraTargetTrigger',      w:64, h:24, cat:'Camera' },
  { name:'smoothCameraOffsetTrigger',w:64, h:24, cat:'Camera' },
  { name:'noRefillTrigger',          w:64, h:24, cat:'Gameplay' },
  { name:'windTrigger',              w:64, h:24, cat:'Gameplay' },
  { name:'windAttackTrigger',        w:64, h:24, cat:'Gameplay' },
  { name:'changeRespawnTrigger',     w:64, h:24, cat:'Gameplay' },
  { name:'oshiroTrigger',            w:64, h:24, cat:'Gameplay' },
  { name:'lightFadeTrigger',         w:64, h:24, cat:'Visual' },
  { name:'bloomFadeTrigger',         w:64, h:24, cat:'Visual' },
  { name:'colorGradeTrigger',        w:64, h:24, cat:'Visual' },
  { name:'blackholeStrength',        w:64, h:24, cat:'Visual' },
  { name:'roomNameTrigger',          w:64, h:24, cat:'Meta' },
  { name:'spawnFacingTrigger',       w:64, h:24, cat:'Meta' },
  { name:'minitextboxTrigger',       w:64, h:24, cat:'Meta' },
  { name:'eventTrigger',             w:64, h:24, cat:'Meta' },
  { name:'goldenBerryCollect',       w:64, h:24, cat:'Meta' },
  { name:'luaCutsceneTrigger',       w:64, h:24, cat:'Meta' },
  { name:'stopBoostTrigger',         w:64, h:24, cat:'Meta' },
  { name:'gravityTrigger',           w:64, h:24, cat:'Helper' },
  { name:'flagTrigger',              w:64, h:24, cat:'Helper' },
  { name:'stylegroundTrigger',       w:64, h:24, cat:'Helper' },
];

// ============================================================
// MOD BROWSER DATA
// ============================================================
const MOD_BROWSER = [
  { name:'Loenn (Map Editor)', desc:'Official visual Celeste map editor, full entity/trigger/plugin system.', url:'https://github.com/CelestialCartographers/Loenn', tag:'tool' },
  { name:'Ahorn (legacy)',     desc:'Predecessor to Loenn built on Maple. Useful for older mods.',           url:'https://github.com/CelestialCartographers/Ahorn', tag:'tool' },
  { name:'Everest',            desc:'Core mod loader/framework for Celeste. Required for all mods.',         url:'https://github.com/EverestAPI/Everest', tag:'framework' },
  { name:'Desolo Zantas',      desc:'20+ chapter Kirby-inspired campaign mod (MaggyHelper, D-sides, DX).',   url:'https://github.com/Magedeline/Celeste__Desolo_Zantas', tag:'campaign' },
  { name:'CommunalHelper',     desc:'Dream switches, rope blocks, community-built entity collection.',       url:'https://github.com/CommunalHelper/CommunalHelper', tag:'helper' },
  { name:'FrostHelper',        desc:'Custom spinners/boosters/springs, session flag utilities.',             url:'https://github.com/JaThePlayer/FrostHelper', tag:'helper' },
  { name:'MaxHelpingHand',     desc:'Colored bumpers, flag-gated objects, multi-node platforms.',            url:'https://github.com/max4805/MaxHelpingHand', tag:'helper' },
  { name:'VivHelper',          desc:'Custom actors, dash mechanics, death effects, movement helpers.',       url:'https://github.com/Viv-0/VivHelper', tag:'helper' },
  { name:'DJMapHelper',        desc:'Visual effects, custom music helpers, additional entities.',            url:'https://github.com/DJYoshi/DJMapHelper', tag:'helper' },
  { name:'SkinModHelper',      desc:'Character skin replacement framework used by Desolo Zantas.',          url:'https://github.com/AAA1459/SkinModHelper', tag:'helper' },
  { name:'AdventureHelper',    desc:'Dash panels, timed switches, inventory system, adventure mechanics.',   url:'https://github.com/StrawberryJam2021/AdventureHelper', tag:'helper' },
  { name:'Spring Collab 2020', desc:'Community jam collab with 100+ rooms and many helper integrations.',   url:'https://github.com/EverestAPI/SpringCollab2020', tag:'campaign' },
  { name:'Maple (map library)',desc:'Programmatic Celeste map generator / Ahorn data model layer.',         url:'https://github.com/CelestialCartographers/Maple', tag:'tool' },
  { name:'Mod Structure Wiki', desc:'Everest mod file layout, binary map format, mod structure guide.',     url:'https://github.com/EverestAPI/Resources/wiki/Mod-Structure', tag:'docs' },
];

// ============================================================
// RESIZE HANDLES
// ============================================================
const HANDLES = ['nw','n','ne','e','se','s','sw','w'];
const HANDLE_SIZE = 7;

function getHandlePos(room, dir) {
  const x = room.x, y = room.y, w = room.width, h = room.height;
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

const HANDLE_CURSOR = { nw:'nw-resize',n:'n-resize',ne:'ne-resize',e:'e-resize',se:'se-resize',s:'s-resize',sw:'sw-resize',w:'w-resize' };

function snap8(v) { return Math.round(v / 8) * 8; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ============================================================
// MAP MODEL
// ============================================================
class Room {
  constructor(d = {}) {
    this.name       = d.name       || 'room_0';
    this.x          = d.x    != null ? d.x    : 0;
    this.y          = d.y    != null ? d.y    : 0;
    this.width      = d.width      || 320;
    this.height     = d.height     || 184;
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
    const tw = Math.floor(newW / TILE_SIZE), th = Math.floor(newH / TILE_SIZE);
    const resize = (td) => {
      const out = [];
      for (let r = 0; r < th; r++) {
        const old = td.tiles[r] || '';
        out.push(Array.from({ length:tw }, (_,c) => old[c] || '0').join(''));
      }
      return { tiles: out };
    };
    this.tilesFg    = resize(this.tilesFg);
    this.tilesBg    = resize(this.tilesBg);
    this.width      = newW; this.height     = newH;
    this.tileWidth  = tw;   this.tileHeight = th;
  }
}

class MapModel {
  constructor() {
    this.rooms           = [];
    this.previewMetadata = null;
    this._history        = [];
    this._historyIdx     = -1;
    this._filePath       = null;
    this._dirty          = false;
    this._copyBuffer     = null;
  }
  get filePath() { return this._filePath; }
  get isDirty()  { return this._dirty; }

  loadFromGenerator(data) {
    this.rooms = data.rooms.map(r => new Room(r));
    this.previewMetadata = data.previewMetadata || null;
    this._filePath = null; this._dirty = true; this._resetHistory();
  }
  loadFromJSON(jsonStr, filePath = null) {
    const data = JSON.parse(jsonStr);
    if (Array.isArray(data.rooms)) {
      this.rooms = data.rooms.map(r => new Room(r));
      this.previewMetadata = data.previewMetadata || null;
    } else if (Array.isArray(data.levels)) {
      this.rooms = data.levels.map(l => this._convLevel(l));
      this.previewMetadata = null;
    } else throw new Error('Unknown map format');
    this._filePath = filePath; this._dirty = false; this._resetHistory();
  }
  _convLevel(l) {
    const w = l.width || 320, h = l.height || 184;
    const tw = Math.floor(w / TILE_SIZE), th = Math.floor(h / TILE_SIZE);
    const parseTiles = (str) => {
      const lines = (str || '').split('\n');
      return { tiles: Array.from({ length:th }, (_,r) => {
        const ln = lines[r] || '';
        return Array.from({ length:tw }, (_,c) => ln[c] || '0').join('');
      }) };
    };
    return new Room({ name:l.name||l.id||'room', x:l.xoffset||0, y:l.yoffset||0, width:w, height:h,
      tileWidth:tw, tileHeight:th, tilesFg:parseTiles(l.solids), tilesBg:parseTiles(l.bg),
      entities:l.entities||[], triggers:l.triggers||[], decalsFg:l.decals||[], color:l.c||0, music:l.music||'', dark:!!l.dark, underwater:!!l.underwater });
  }
  toJSON() { return JSON.stringify({ rooms:this.rooms, previewMetadata:this.previewMetadata }, null, 2); }

  _resetHistory() { this._history = [this.rooms.map(r => r.clone())]; this._historyIdx = 0; }
  pushHistory() {
    this._history = this._history.slice(0, this._historyIdx + 1);
    this._history.push(this.rooms.map(r => r.clone()));
    if (this._history.length > 80) this._history.shift(); else this._historyIdx++;
    this._dirty = true;
  }
  undo() { if (this._historyIdx > 0) { this._historyIdx--; this.rooms = this._history[this._historyIdx].map(r => r.clone()); return true; } return false; }
  redo() { if (this._historyIdx < this._history.length-1) { this._historyIdx++; this.rooms = this._history[this._historyIdx].map(r => r.clone()); return true; } return false; }

  setTile(ri, layer, row, col, t) {
    const room = this.rooms[ri]; if (!room) return;
    if (row < 0 || row >= room.tileHeight || col < 0 || col >= room.tileWidth) return;
    const td = layer === 'fg' ? room.tilesFg : room.tilesBg;
    if (!td.tiles[row]) td.tiles[row] = '0'.repeat(room.tileWidth);
    const s = td.tiles[row]; td.tiles[row] = s.slice(0,col) + t + s.slice(col+1);
  }
  addEntity(ri, def, lx, ly) {
    const r = this.rooms[ri]; if (!r) return;
    const maxId = r.entities.reduce((m,e) => Math.max(m, e.id||0), 0);
    r.entities.push({ name:def.name, id:maxId+1, x:lx, y:ly, width:def.w||8, height:def.h||8, nodes:[], attributes:{} });
    this.pushHistory();
  }
  addTrigger(ri, def, lx, ly) {
    const r = this.rooms[ri]; if (!r) return;
    r.triggers.push({ name:def.name, x:lx, y:ly, width:def.w||64, height:def.h||24, attributes:{} });
    this.pushHistory();
  }
  deleteEntityAt(ri, lx, ly) {
    const r = this.rooms[ri]; if (!r) return false;
    const idx = r.entities.findIndex(e => lx>=e.x && lx<=e.x+(e.width||8) && ly>=e.y && ly<=e.y+(e.height||8));
    if (idx >= 0) { r.entities.splice(idx, 1); this.pushHistory(); return true; }
    const tidx = r.triggers.findIndex(t => lx>=t.x && lx<=t.x+(t.width||64) && ly>=t.y && ly<=t.y+(t.height||24));
    if (tidx >= 0) { r.triggers.splice(tidx, 1); this.pushHistory(); return true; }
    return false;
  }
  addRoom(x, y, w, h) { const i = this.rooms.length; this.rooms.push(new Room({ name:`room_${i}`, x, y, width:w, height:h })); this.pushHistory(); return i; }
  deleteRoom(ri) { this.rooms.splice(ri, 1); this.pushHistory(); }
  moveRoom(ri, nx, ny) { const r = this.rooms[ri]; if (r) { r.x = nx; r.y = ny; } }
  replaceRoomTiles(ri, fgTiles, bgTiles, entities) {
    const r = this.rooms[ri]; if (!r) return;
    if (fgTiles)  r.tilesFg  = { tiles:[...fgTiles] };
    if (bgTiles)  r.tilesBg  = { tiles:[...bgTiles] };
    if (entities) r.entities = entities.map(e => ({ ...e }));
    this.pushHistory();
  }
  selectAll() { return this.rooms.map((_,i) => i); }
  copyRooms(indices) { this._copyBuffer = indices.map(i => this.rooms[i]).filter(Boolean).map(r => r.clone()); }
  pasteRooms(ox = 32, oy = 32) {
    if (!this._copyBuffer || !this._copyBuffer.length) return [];
    const start = this.rooms.length;
    this._copyBuffer.forEach(r => {
      const n = r.clone(); n.name = n.name + '_copy'; n.x = snap8(n.x + ox); n.y = snap8(n.y + oy);
      this.rooms.push(n);
    });
    this.pushHistory();
    return this._copyBuffer.map((_,i) => start + i);
  }
}

// ============================================================
// CANVAS RENDERER
// ============================================================
class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha:false });
    this.zoom = 1.0; this.panX = 60; this.panY = 60;
    this.showTopology = true; this.showGrid = true; this.showBg = true;
    this.showEntities = true; this.showTriggers = true;
  }
  worldToScreen(wx, wy) { return { x:(wx+this.panX)*this.zoom, y:(wy+this.panY)*this.zoom }; }
  screenToWorld(sx, sy) { return { x:sx/this.zoom-this.panX, y:sy/this.zoom-this.panY }; }
  zoomAt(sx, sy, dir) {
    const f = dir > 0 ? 1.15 : 1/1.15;
    const wx = sx/this.zoom-this.panX, wy = sy/this.zoom-this.panY;
    this.zoom = clamp(this.zoom*f, 0.1, 8);
    this.panX = sx/this.zoom-wx; this.panY = sy/this.zoom-wy;
  }
  fitToScreen(rooms) {
    if (!rooms || !rooms.length) return;
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    for (const r of rooms) { x0=Math.min(x0,r.x); y0=Math.min(y0,r.y); x1=Math.max(x1,r.x+r.width); y1=Math.max(y1,r.y+r.height); }
    const pad = 64;
    this.zoom = clamp(Math.min((this.canvas.width-pad*2)/(x1-x0),(this.canvas.height-pad*2)/(y1-y0)), 0.1, 4);
    this.panX = pad/this.zoom - x0; this.panY = pad/this.zoom - y0;
  }

  render(map, selectedIndices, hoverInfo, createPreview, rubberBand) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = '#12131f'; ctx.fillRect(0,0,W,H);
    this._worldGrid();
    if (!map || !map.rooms.length) {
      ctx.fillStyle='#3a3d5a'; ctx.font='13px monospace'; ctx.textAlign='center';
      ctx.fillText('No map loaded — Generate or File > Open', W/2, H/2); return;
    }
    for (let i = 0; i < map.rooms.length; i++) {
      const sel = selectedIndices instanceof Set ? selectedIndices.has(i) : (i === selectedIndices);
      this._room(map.rooms[i], sel);
      if (sel) this._resizeHandles(map.rooms[i]);
    }
    if (this.showTopology && map.previewMetadata) this._topology(map);
    if (hoverInfo)    this._hoverHL(hoverInfo);
    if (createPreview) this._createPreview(createPreview);
    if (rubberBand)   this._rubberBand(rubberBand);
  }

  _worldGrid() {
    const gs = 128*this.zoom; if (gs < 6) return;
    const ctx = this.ctx;
    const ox = ((this.panX*this.zoom)%gs+gs)%gs, oy = ((this.panY*this.zoom)%gs+gs)%gs;
    ctx.strokeStyle='rgba(255,255,255,0.025)'; ctx.lineWidth=1; ctx.beginPath();
    for (let x=ox; x<=this.canvas.width;  x+=gs) { ctx.moveTo(x,0); ctx.lineTo(x,this.canvas.height); }
    for (let y=oy; y<=this.canvas.height; y+=gs) { ctx.moveTo(0,y); ctx.lineTo(this.canvas.width,y);  }
    ctx.stroke();
  }
  _room(room, selected) {
    const ctx = this.ctx;
    const { x:sx, y:sy } = this.worldToScreen(room.x, room.y);
    const sw = room.width*this.zoom, sh = room.height*this.zoom;
    if (sx+sw<0||sx>this.canvas.width||sy+sh<0||sy>this.canvas.height) return;
    ctx.fillStyle='#0b0d1a'; ctx.fillRect(sx,sy,sw,sh);
    if (this.showBg)       this._tileLayer(room.tilesBg, sx, sy, 0.28);
    this._tileLayer(room.tilesFg, sx, sy, 1.0);
    if (this.showEntities) this._entities(room, sx, sy);
    if (this.showTriggers) this._triggers(room, sx, sy);
    if (this.showGrid && this.zoom > 2.0) this._tileGrid(room, sx, sy);
    const col = selected ? '#ffff55' : (ROOM_COLORS[room.color % ROOM_COLORS.length] || '#4a5a7a');
    ctx.strokeStyle=col; ctx.lineWidth=selected?2:1;
    ctx.strokeRect(sx+0.5, sy+0.5, sw-1, sh-1);
    if (this.zoom > 0.22) {
      const fs = clamp(10*this.zoom, 8, 11);
      ctx.fillStyle='rgba(180,190,220,0.45)'; ctx.font=`${fs}px monospace`; ctx.textAlign='left';
      ctx.fillText(room.name, sx+3, sy+fs+2);
    }
  }
  _resizeHandles(room) {
    const ctx = this.ctx;
    for (const dir of HANDLES) {
      const wp = getHandlePos(room, dir), sp = this.worldToScreen(wp.x, wp.y);
      const hs = HANDLE_SIZE;
      ctx.fillStyle='#ffffff'; ctx.strokeStyle='#333355'; ctx.lineWidth=1;
      ctx.fillRect(sp.x-hs/2, sp.y-hs/2, hs, hs); ctx.strokeRect(sp.x-hs/2, sp.y-hs/2, hs, hs);
    }
  }
  _tileLayer(td, sx, sy, alpha) {
    const ctx = this.ctx, ts = TILE_SIZE*this.zoom; if (ts < 0.3) return;
    ctx.globalAlpha = alpha;
    for (let row = 0; row < (td?td.tiles.length:0); row++) {
      const rowStr = td.tiles[row] || '';
      for (let col = 0; col < rowStr.length; col++) {
        const t = rowStr[col]; if (t==='0'||t===' ') continue;
        ctx.fillStyle = TILE_COLORS[t] || '#888'; ctx.fillRect(sx+col*ts, sy+row*ts, ts, ts);
      }
    }
    ctx.globalAlpha = 1;
  }
  _entities(room, sx, sy) {
    const ctx = this.ctx;
    for (const e of (room.entities||[])) {
      const ex=sx+e.x*this.zoom, ey=sy+e.y*this.zoom;
      const ew=Math.max(3,(e.width||8)*this.zoom), eh=Math.max(3,(e.height||8)*this.zoom);
      const col = ENTITY_COLOR[e.name] || '#aaaaaa';
      ctx.fillStyle=col+'2a'; ctx.fillRect(ex,ey,ew,eh);
      ctx.strokeStyle=col; ctx.lineWidth=1; ctx.strokeRect(ex+0.5,ey+0.5,ew-1,eh-1);
      if (this.zoom>1.8 && ew>14) {
        const fs=clamp(8*this.zoom,6,9);
        ctx.fillStyle=col; ctx.font=`${fs}px monospace`; ctx.textAlign='center';
        ctx.fillText(e.name.slice(0,14), ex+ew/2, ey+eh/2+fs/3);
      }
    }
  }
  _triggers(room, sx, sy) {
    const ctx = this.ctx;
    for (const t of (room.triggers||[])) {
      const tx=sx+t.x*this.zoom, ty=sy+t.y*this.zoom;
      const tw=Math.max(3,(t.width||64)*this.zoom), th=Math.max(3,(t.height||24)*this.zoom);
      ctx.fillStyle='rgba(255,136,0,0.08)'; ctx.fillRect(tx,ty,tw,th);
      ctx.strokeStyle='rgba(255,136,0,0.55)'; ctx.lineWidth=1;
      ctx.setLineDash([3,3]); ctx.strokeRect(tx+0.5,ty+0.5,tw-1,th-1); ctx.setLineDash([]);
      if (this.zoom>1.8 && tw>24) {
        const fs=clamp(7*this.zoom,6,8);
        ctx.fillStyle='rgba(255,170,80,0.9)'; ctx.font=`${fs}px monospace`; ctx.textAlign='left';
        ctx.fillText(t.name.slice(0,18), tx+3, ty+fs+2);
      }
    }
  }
  _tileGrid(room, sx, sy) {
    const ctx = this.ctx, ts = TILE_SIZE*this.zoom;
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=0.5; ctx.beginPath();
    for (let c=0; c<=room.tileWidth;  c++) { const x=sx+c*ts; ctx.moveTo(x,sy); ctx.lineTo(x,sy+room.height*this.zoom); }
    for (let r=0; r<=room.tileHeight; r++) { const y=sy+r*ts; ctx.moveTo(sx,y); ctx.lineTo(sx+room.width*this.zoom,y); }
    ctx.stroke();
  }
  _hoverHL(info) {
    const ctx = this.ctx;
    if (info.type==='tile') {
      const { room,row,col } = info, { x:sx,y:sy } = this.worldToScreen(room.x,room.y), ts=TILE_SIZE*this.zoom;
      ctx.fillStyle='rgba(255,255,255,0.18)'; ctx.fillRect(sx+col*ts,sy+row*ts,ts,ts);
      ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1; ctx.strokeRect(sx+col*ts+0.5,sy+row*ts+0.5,ts-1,ts-1);
    } else if (info.type==='room') {
      const { x:sx,y:sy }=this.worldToScreen(info.room.x,info.room.y);
      ctx.strokeStyle='rgba(255,255,255,0.22)'; ctx.lineWidth=1;
      ctx.setLineDash([4,4]); ctx.strokeRect(sx,sy,info.room.width*this.zoom,info.room.height*this.zoom); ctx.setLineDash([]);
    }
  }
  _createPreview(prev) {
    const ctx = this.ctx;
    const x1=Math.min(prev.x0,prev.x1), y1=Math.min(prev.y0,prev.y1);
    const x2=Math.max(prev.x0,prev.x1), y2=Math.max(prev.y0,prev.y1);
    const { x:sx,y:sy }=this.worldToScreen(x1,y1);
    const sw=(x2-x1)*this.zoom, sh=(y2-y1)*this.zoom; if (sw<1||sh<1) return;
    ctx.fillStyle='rgba(80,120,220,0.12)'; ctx.fillRect(sx,sy,sw,sh);
    ctx.strokeStyle='rgba(80,180,255,0.85)'; ctx.lineWidth=1.5;
    ctx.setLineDash([5,4]); ctx.strokeRect(sx+0.5,sy+0.5,sw-1,sh-1); ctx.setLineDash([]);
    const fs=10; ctx.font=`${fs}px monospace`; ctx.fillStyle='rgba(120,180,255,0.9)'; ctx.textAlign='center';
    ctx.fillText(`${snap8(x2-x1)} x ${snap8(y2-y1)}`, sx+sw/2, sy+sh/2+fs/3);
  }
  _rubberBand(rb) {
    const x1=Math.min(rb.x0,rb.x1), y1=Math.min(rb.y0,rb.y1);
    const x2=Math.max(rb.x0,rb.x1), y2=Math.max(rb.y0,rb.y1);
    const ctx = this.ctx;
    ctx.fillStyle='rgba(100,140,255,0.08)'; ctx.fillRect(x1,y1,x2-x1,y2-y1);
    ctx.strokeStyle='rgba(100,160,255,0.6)'; ctx.lineWidth=1;
    ctx.setLineDash([4,3]); ctx.strokeRect(x1+0.5,y1+0.5,x2-x1-1,y2-y1-1); ctx.setLineDash([]);
  }
  _topology(map) {
    const ctx = this.ctx, meta = map.previewMetadata;
    const nodes = meta.nodes||[], mainSet = new Set(meta.mainPathNodeIds||[]);
    for (const node of nodes) {
      const fr = map.rooms.find(r => r.name===node.roomName); if (!fr) continue;
      const fc = this.worldToScreen(fr.x+fr.width/2, fr.y+fr.height/2);
      for (const cid of (node.connections||[])) {
        const tn = nodes.find(n => n.id===cid); if (!tn) continue;
        const tr = map.rooms.find(r => r.name===tn.roomName); if (!tr) continue;
        const tc = this.worldToScreen(tr.x+tr.width/2, tr.y+tr.height/2);
        const isMain = mainSet.has(node.id) && mainSet.has(cid);
        ctx.strokeStyle = isMain ? 'rgba(255,200,50,0.55)' : 'rgba(80,130,255,0.32)';
        ctx.lineWidth = isMain ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(fc.x,fc.y); ctx.lineTo(tc.x,tc.y); ctx.stroke();
      }
    }
    for (const node of nodes) {
      const r = map.rooms.find(r => r.name===node.roomName); if (!r) continue;
      const c = this.worldToScreen(r.x+r.width/2, r.y+r.height/2);
      const nr = Math.max(3, 5*this.zoom);
      ctx.beginPath(); ctx.arc(c.x,c.y,nr,0,Math.PI*2);
      ctx.fillStyle = node.id===meta.startNodeId ? '#00ff88' : node.id===meta.goalNodeId ? '#ff4040' : mainSet.has(node.id) ? '#ffcc00' : '#5566cc';
      ctx.fill(); ctx.strokeStyle='rgba(0,0,0,0.55)'; ctx.lineWidth=1; ctx.stroke();
    }
  }

  getHandleAt(sx, sy, room) {
    if (!room) return null; const hs = HANDLE_SIZE + 3;
    for (const dir of HANDLES) {
      const wp = getHandlePos(room, dir), sp = this.worldToScreen(wp.x, wp.y);
      if (Math.abs(sx-sp.x) <= hs/2 && Math.abs(sy-sp.y) <= hs/2) return dir;
    }
    return null;
  }
  getRoomAt(sx, sy, rooms) {
    const w = this.screenToWorld(sx, sy);
    for (let i = rooms.length-1; i >= 0; i--) {
      const r = rooms[i];
      if (w.x>=r.x && w.x<r.x+r.width && w.y>=r.y && w.y<r.y+r.height) return i;
    }
    return -1;
  }
  getTileAt(sx, sy, room) {
    const w = this.screenToWorld(sx, sy);
    const col = Math.floor((w.x-room.x)/TILE_SIZE), row = Math.floor((w.y-room.y)/TILE_SIZE);
    return { col, row, valid: col>=0 && col<room.tileWidth && row>=0 && row<room.tileHeight };
  }
}

// ============================================================
// APP UI
// ============================================================
class AppUI {
  constructor() {
    this.map      = new MapModel();
    this.renderer = null;

    this.selectedIndices = new Set();
    this.currentTool     = 'select';
    this.currentTile     = '1';
    this.currentEntity   = ENTITY_TYPES[0];
    this.currentTrigger  = TRIGGER_TYPES[0];

    this._isPainting    = false;
    this._isDragging    = false;
    this._isResize      = false; this._resizeDir = null;
    this._isPanning     = false;
    this._isRubberBand  = false;
    this._isCreating    = false;

    this._panStart = null; this._panOrigin   = null;
    this._dragStart = null; this._dragOrigins = {};
    this._rbStart   = null; this._resizeOrigin = null;
    this._createStart = null; this._createPreview = null;
    this._rubberBand  = null;
    this._hoverInfo   = null;
    this._lastTileKey = null;
    this._statusMsg   = 'Ready';
    this._requestedRender = false;

    this._initDOM();
  }

  _initDOM() {
    const canvas = document.getElementById('map-canvas');
    this.renderer = new CanvasRenderer(canvas);
    this._resize(); window.addEventListener('resize', () => this._resize());

    // Tab bar
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const paneId = 'tab-' + btn.dataset.tab;
        const pane = document.getElementById(paneId);
        if (pane) pane.classList.add('active');
      });
    });

    // Canvas events
    canvas.addEventListener('wheel',       e => this._onWheel(e),    { passive:false });
    canvas.addEventListener('mousedown',   e => this._onMouseDown(e));
    canvas.addEventListener('mousemove',   e => this._onMouseMove(e));
    canvas.addEventListener('mouseup',     e => this._onMouseUp(e));
    canvas.addEventListener('mouseleave',  e => this._onMouseLeave(e));
    canvas.addEventListener('contextmenu', e => this._onCtxMenu(e));
    document.addEventListener('keydown',   e => this._onKeyDown(e));
    document.addEventListener('click',     () => this._hideCtxMenu());

    // Context menu
    document.getElementById('ctx-menu').addEventListener('click', e => {
      e.stopPropagation();
      const action = e.target.closest('[data-action]')?.dataset.action;
      this._hideCtxMenu();
      if (action) this._ctxAction(action);
    });

    // Tool buttons
    document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => this._setTool(b.dataset.tool)));

    // Build palettes + mod browser
    this._buildTilePalette();
    this._buildEntityPalette();
    this._buildTriggerPalette();
    this._buildModBrowser();

    // Toolbar / file
    document.getElementById('btn-new').addEventListener(   'click', () => this._newMap());
    document.getElementById('btn-open').addEventListener(  'click', () => this._openMap());
    document.getElementById('btn-save').addEventListener(  'click', () => this._saveMap());
    document.getElementById('btn-export').addEventListener('click', () => this._exportMap());
    document.getElementById('btn-fit').addEventListener(   'click', () => { this.renderer.fitToScreen(this.map.rooms); this._render(); });

    // PCG buttons
    document.getElementById('btn-add-pcg-room').addEventListener( 'click', () => this._addPcgRoom());
    document.getElementById('btn-regen-room').addEventListener(   'click', () => this._regenRoom());
    document.getElementById('btn-resize-pcg').addEventListener(   'click', () => this._resizePcgRoom());
    document.getElementById('btn-gan-fill').addEventListener(     'click', () => this._ganFillRoom());
    document.getElementById('btn-randomize-seed').addEventListener('click', () => { document.getElementById('gen-seed').value = Math.floor(Math.random()*4294967295); });
    document.getElementById('btn-generate').addEventListener(     'click', () => this._generate());

    // Toggles
    ['topology','grid','bg','entities','triggers'].forEach(key => {
      const el = document.getElementById('toggle-' + key); if (!el) return;
      el.addEventListener('change', e => { this.renderer['show' + key.charAt(0).toUpperCase() + key.slice(1)] = e.target.checked; this._render(); });
    });

    // Entity / trigger search
    const eSearch = document.getElementById('entity-search'); if (eSearch) eSearch.addEventListener('input', e => this._filterPalette('entity', e.target.value));
    const tSearch = document.getElementById('trigger-search'); if (tSearch) tSearch.addEventListener('input', e => this._filterPalette('trigger', e.target.value));

    // Room properties modal
    const closeBtn = document.getElementById('modal-close-btn'); if (closeBtn) closeBtn.addEventListener('click', () => this._closeModal());
    const cancelBtn = document.getElementById('mp-cancel'); if (cancelBtn) cancelBtn.addEventListener('click', () => this._closeModal());
    const applyBtn = document.getElementById('mp-apply'); if (applyBtn) applyBtn.addEventListener('click', () => this._applyRoomProps());

    this._checkGeneratorPath();
    this._render();
  }

  _resize() {
    const canvas = this.renderer.canvas, c = canvas.parentElement;
    canvas.width = c.clientWidth; canvas.height = c.clientHeight; this._render();
  }

  _render() {
    if (this._requestedRender) return; this._requestedRender = true;
    requestAnimationFrame(() => {
      this._requestedRender = false;
      this.renderer.render(this.map.rooms.length ? this.map : null, this.selectedIndices, this._hoverInfo,
        this._isCreating ? this._createPreview : null, this._isRubberBand ? this._rubberBand : null);
      this._updateInspector(); this._updateTopology(); this._updateStatusBar();
    });
  }

  // ── Tool management ──────────────────────────────────────
  _setTool(t) {
    this.currentTool = t;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    const show = (id, cond) => { const el = document.getElementById(id); if (el) el.style.display = cond ? 'block' : 'none'; };
    show('tile-palette-section',    t === 'fg' || t === 'bg');
    show('entity-palette-section',  t === 'entities');
    show('trigger-palette-section', t === 'triggers');
    const hints = { select:'Click/drag to select. Drag handles to resize. Shift = multi-select.', create:'Drag to draw a new room (T).', fg:'Paint foreground tiles. Right-drag = erase.', bg:'Paint background tiles.', entities:'Click room to place entity.', triggers:'Click room to place trigger.', erase:'Click to erase tiles/entities.' };
    const hint = document.getElementById('tool-hint'); if (hint) hint.textContent = hints[t] || '';
    if (t !== 'select') { this.selectedIndices.clear(); this._render(); }
  }

  // ── Palettes ─────────────────────────────────────────────
  _buildTilePalette() {
    const pal = document.getElementById('tile-palette'); if (!pal) return; pal.innerHTML = '';
    for (const t of TILE_PALETTE) {
      const b = document.createElement('button'); b.className='tile-btn'; b.dataset.tile=t; b.title=`Tile ${t}`; b.textContent=t;
      b.style.background = TILE_COLORS[t] || '#888';
      b.addEventListener('click', () => { this.currentTile=t; pal.querySelectorAll('.tile-btn').forEach(x => x.classList.toggle('active', x.dataset.tile===t)); });
      if (t === this.currentTile) b.classList.add('active');
      pal.appendChild(b);
    }
    const er = document.createElement('button'); er.className='tile-btn eraser'; er.dataset.tile='0'; er.title='Erase'; er.textContent='x';
    er.addEventListener('click', () => { this.currentTile='0'; pal.querySelectorAll('.tile-btn').forEach(x => x.classList.toggle('active', x.dataset.tile==='0')); });
    pal.appendChild(er);
  }
  _buildEntityPalette() { this._buildObjPalette('entity', ENTITY_TYPES, 'entity-palette', et => { this.currentEntity = et; }); }
  _buildTriggerPalette() { this._buildObjPalette('trigger', TRIGGER_TYPES, 'trigger-palette', tt => { this.currentTrigger = tt; }); }
  _buildObjPalette(kind, list, containerId, onSelect) {
    const pal = document.getElementById(containerId); if (!pal) return; pal.innerHTML = '';
    let lastCat = null;
    for (const item of list) {
      if (item.cat !== lastCat) {
        const hdr = document.createElement('div'); hdr.className='palette-cat'; hdr.textContent=item.cat; pal.appendChild(hdr); lastCat = item.cat;
      }
      const b = document.createElement('button'); b.className=`${kind}-btn`; b.textContent=item.name; b.dataset.name=item.name;
      const col = (kind==='entity' ? ENTITY_COLOR[item.name] : '#ff8800') || '#aaa';
      b.style.cssText += `;border-left:3px solid ${col};color:${col}`;
      b.addEventListener('click', () => { onSelect(item); pal.querySelectorAll(`.${kind}-btn`).forEach(x => x.classList.toggle('active', x===b)); });
      pal.appendChild(b);
    }
  }
  _filterPalette(kind, query) {
    const q = query.toLowerCase();
    const sel = kind==='entity' ? '#entity-palette' : '#trigger-palette';
    document.querySelectorAll(`${sel} .${kind}-btn`).forEach(b => { b.style.display = !q || b.dataset.name.toLowerCase().includes(q) ? '' : 'none'; });
    document.querySelectorAll(`${sel} .palette-cat`).forEach(hdr => {
      let next = hdr.nextElementSibling, hasVis = false;
      while (next && !next.classList.contains('palette-cat')) { if (next.style.display !== 'none') hasVis = true; next = next.nextElementSibling; }
      hdr.style.display = hasVis ? '' : 'none';
    });
  }
  _buildModBrowser() {
    const div = document.getElementById('mod-browser'); if (!div) return; div.innerHTML = '';
    const tagColors = { tool:'#5278cc',framework:'#cc7744',campaign:'#44cc88',helper:'#cc44aa',docs:'#888' };
    for (const mod of MOD_BROWSER) {
      const tc = tagColors[mod.tag]||'#888';
      const card = document.createElement('div'); card.className = 'mod-card';
      card.innerHTML = `<div class="mod-name">${esc(mod.name)} <span class="mod-tag" style="background:${tc}22;color:${tc}">${esc(mod.tag)}</span></div><div class="mod-desc">${esc(mod.desc)}</div><a class="mod-link">${esc(mod.url.replace('https://github.com/',''))}</a>`;
      card.querySelector('.mod-link').addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.openExternal) window.electronAPI.openExternal(mod.url);
        else window.open(mod.url, '_blank');
      });
      div.appendChild(card);
    }
  }

  // ── Canvas events ─────────────────────────────────────────
  _pos(e) { const r=this.renderer.canvas.getBoundingClientRect(); return { x:e.clientX-r.left, y:e.clientY-r.top }; }

  _onWheel(e) { e.preventDefault(); const p=this._pos(e); this.renderer.zoomAt(p.x,p.y,-e.deltaY); this._render(); }

  _onMouseDown(e) {
    const pos = this._pos(e);
    if (e.button===2) return;  // right-click handled by contextmenu event
    if (e.button===1 || (e.button===0 && e.altKey)) {
      this._isPanning=true; this._panStart=pos; this._panOrigin={x:this.renderer.panX,y:this.renderer.panY};
      this.renderer.canvas.classList.add('panning'); return;
    }
    if (e.button !== 0) return;
    const { rooms } = this.map;

    if (this.currentTool==='create') {
      const w=this.renderer.screenToWorld(pos.x,pos.y);
      this._isCreating=true; this._createStart={x:snap8(w.x),y:snap8(w.y)};
      this._createPreview={x0:this._createStart.x,y0:this._createStart.y,x1:this._createStart.x+80,y1:this._createStart.y+80}; return;
    }

    if (this.currentTool==='select') {
      if (this.selectedIndices.size===1) {
        const handle = this.renderer.getHandleAt(pos.x,pos.y, rooms[[...this.selectedIndices][0]]);
        if (handle) {
          this._isResize=true; this._resizeDir=handle; this._dragStart=pos;
          const r=rooms[[...this.selectedIndices][0]]; this._resizeOrigin={x:r.x,y:r.y,width:r.width,height:r.height}; return;
        }
      }
      const ri = this.renderer.getRoomAt(pos.x,pos.y,rooms);
      if (ri >= 0) {
        if (e.shiftKey) { if (this.selectedIndices.has(ri)) this.selectedIndices.delete(ri); else this.selectedIndices.add(ri); }
        else { if (!this.selectedIndices.has(ri)) { this.selectedIndices.clear(); this.selectedIndices.add(ri); } }
        this._isDragging=true; this._dragStart=pos; this._dragOrigins={};
        for (const idx of this.selectedIndices) { const r=rooms[idx]; this._dragOrigins[idx]={x:r.x,y:r.y}; }
      } else {
        if (!e.shiftKey) this.selectedIndices.clear();
        this._isRubberBand=true; this._rbStart=pos; this._rubberBand={x0:pos.x,y0:pos.y,x1:pos.x,y1:pos.y};
      }
      this._render(); return;
    }

    if (this.currentTool==='fg'||this.currentTool==='bg'||this.currentTool==='erase') {
      const ri=this.renderer.getRoomAt(pos.x,pos.y,rooms);
      if (ri>=0) { this.selectedIndices.clear(); this.selectedIndices.add(ri); this._isPainting=true; this._paintTile(pos,ri); }
      return;
    }
    if (this.currentTool==='entities') { const ri=this.renderer.getRoomAt(pos.x,pos.y,rooms); if (ri>=0) this._placeEntity(pos,ri); return; }
    if (this.currentTool==='triggers') { const ri=this.renderer.getRoomAt(pos.x,pos.y,rooms); if (ri>=0) this._placeTrigger(pos,ri); return; }
  }

  _onMouseMove(e) {
    const pos = this._pos(e);

    if (this._isPanning) {
      const dx=(pos.x-this._panStart.x)/this.renderer.zoom, dy=(pos.y-this._panStart.y)/this.renderer.zoom;
      this.renderer.panX=this._panOrigin.x+dx; this.renderer.panY=this._panOrigin.y+dy; this._render(); return;
    }
    if (this._isCreating && this._createStart) {
      const w=this.renderer.screenToWorld(pos.x,pos.y);
      const cx=snap8(Math.max(w.x,this._createStart.x+80)), cy=snap8(Math.max(w.y,this._createStart.y+80));
      this._createPreview={x0:this._createStart.x,y0:this._createStart.y,x1:cx,y1:cy}; this._render(); return;
    }
    if (this._isResize && this._resizeDir) {
      const si=[...this.selectedIndices][0], room=this.map.rooms[si]; if (!room) return;
      const dx=(pos.x-this._dragStart.x)/this.renderer.zoom, dy=(pos.y-this._dragStart.y)/this.renderer.zoom;
      const o=this._resizeOrigin, dir=this._resizeDir;
      let nx=o.x,ny=o.y,nw=o.width,nh=o.height;
      if (dir.includes('w')) { nx=snap8(o.x+dx); nw=snap8(Math.max(80,o.width-dx)); }
      if (dir.includes('e')) { nw=snap8(Math.max(80,o.width+dx)); }
      if (dir.includes('n')) { ny=snap8(o.y+dy);  nh=snap8(Math.max(80,o.height-dy)); }
      if (dir.includes('s')) { nh=snap8(Math.max(80,o.height+dy)); }
      room.x=nx; room.y=ny; room.resize(nw,nh);
      this._setStatus(`Resize ${room.name}: ${nw}x${nh}`); this._render(); return;
    }
    if (this._isDragging) {
      const dx=(pos.x-this._dragStart.x)/this.renderer.zoom, dy=(pos.y-this._dragStart.y)/this.renderer.zoom;
      for (const idx of this.selectedIndices) { const o=this._dragOrigins[idx]; if (o) this.map.moveRoom(idx,snap8(o.x+dx),snap8(o.y+dy)); }
      this._render(); return;
    }
    if (this._isRubberBand) {
      this._rubberBand={x0:this._rbStart.x,y0:this._rbStart.y,x1:pos.x,y1:pos.y};
      const w1=this.renderer.screenToWorld(Math.min(this._rbStart.x,pos.x),Math.min(this._rbStart.y,pos.y));
      const w2=this.renderer.screenToWorld(Math.max(this._rbStart.x,pos.x),Math.max(this._rbStart.y,pos.y));
      this.selectedIndices.clear();
      for (let i=0;i<this.map.rooms.length;i++) { const r=this.map.rooms[i]; if (r.x<w2.x&&r.x+r.width>w1.x&&r.y<w2.y&&r.y+r.height>w1.y) this.selectedIndices.add(i); }
      this._render(); return;
    }
    if (this._isPainting) { const ri=this.renderer.getRoomAt(pos.x,pos.y,this.map.rooms); if (ri>=0) this._paintTile(pos,ri); }
    this._updateHover(pos);
    const w=this.renderer.screenToWorld(pos.x,pos.y);
    this._setStatus(`(${Math.floor(w.x)}, ${Math.floor(w.y)})  x${this.renderer.zoom.toFixed(2)}`);
  }

  _onMouseUp(e) {
    if (this._isCreating && this._createPreview) {
      const p=this._createPreview;
      const x=Math.min(p.x0,p.x1), y=Math.min(p.y0,p.y1);
      const w=snap8(Math.max(80,Math.abs(p.x1-p.x0))), h=snap8(Math.max(80,Math.abs(p.y1-p.y0)));
      const ri=this.map.addRoom(x,y,w,h); this.selectedIndices.clear(); this.selectedIndices.add(ri);
      this._isCreating=false; this._createPreview=null; this._createStart=null;
      this._setStatus(`Created ${this.map.rooms[ri].name} (${w}x${h})`);
      this._render(); return;
    }
    if (this._isResize)     { this.map.pushHistory(); this._isResize=false; this._resizeDir=null; this._resizeOrigin=null; }
    if (this._isDragging)   { this.map.pushHistory(); this._isDragging=false; this._dragOrigins={}; }
    if (this._isPainting)   { this.map.pushHistory(); this._isPainting=false; this._lastTileKey=null; }
    if (this._isRubberBand) { this._isRubberBand=false; this._rubberBand=null; }
    this._isPanning=false; this.renderer.canvas.classList.remove('panning');
    this._render();
  }

  _onMouseLeave(e) {
    this._isPainting=this._isDragging=this._isPanning=this._isRubberBand=this._isCreating=this._isResize=false;
    this._hoverInfo=this._createPreview=this._rubberBand=null; this.renderer.canvas.classList.remove('panning'); this._render();
  }

  _updateHover(pos) {
    const ri=this.renderer.getRoomAt(pos.x,pos.y,this.map.rooms);
    if (ri<0) { if (this._hoverInfo) { this._hoverInfo=null; this._render(); } this.renderer.canvas.style.cursor=''; return; }
    const room=this.map.rooms[ri];
    if (this.currentTool==='fg'||this.currentTool==='bg'||this.currentTool==='erase') {
      const tile=this.renderer.getTileAt(pos.x,pos.y,room);
      if (tile.valid && (!this._hoverInfo||this._hoverInfo.row!==tile.row||this._hoverInfo.col!==tile.col)) { this._hoverInfo={type:'tile',room,row:tile.row,col:tile.col}; this._render(); }
    } else if (this.currentTool==='select') {
      if (!this._hoverInfo||this._hoverInfo.room!==room) { this._hoverInfo={type:'room',room}; this._render(); }
      if (this.selectedIndices.size===1) {
        const handle=this.renderer.getHandleAt(pos.x,pos.y,this.map.rooms[[...this.selectedIndices][0]]);
        this.renderer.canvas.style.cursor = handle ? HANDLE_CURSOR[handle] : 'default';
      }
    } else { if (this._hoverInfo) { this._hoverInfo=null; this._render(); } }
  }

  // ── Edit ops ──────────────────────────────────────────────
  _paintTile(pos, ri) {
    const room=this.map.rooms[ri], tile=this.renderer.getTileAt(pos.x,pos.y,room); if (!tile.valid) return;
    const key=`${ri}:${tile.row}:${tile.col}`; if (key===this._lastTileKey) return; this._lastTileKey=key;
    const layer=this.currentTool==='bg' ? 'bg' : 'fg';
    const brush=this.currentTool==='erase' ? '0' : this.currentTile;
    this.map.setTile(ri,layer,tile.row,tile.col,brush); this._render();
  }
  _placeEntity(pos, ri) {
    const r=this.map.rooms[ri], w=this.renderer.screenToWorld(pos.x,pos.y);
    this.map.addEntity(ri,this.currentEntity,snap8(w.x-r.x),snap8(w.y-r.y)); this._render();
  }
  _placeTrigger(pos, ri) {
    const r=this.map.rooms[ri], w=this.renderer.screenToWorld(pos.x,pos.y);
    this.map.addTrigger(ri,this.currentTrigger,snap8(w.x-r.x),snap8(w.y-r.y)); this._render();
  }

  // ── Keyboard ──────────────────────────────────────────────
  _onKeyDown(e) {
    const ctrl = e.ctrlKey||e.metaKey;
    if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') { if (e.key==='Escape') e.target.blur(); return; }

    if (ctrl&&e.key==='z'&&!e.shiftKey) { e.preventDefault(); if (this.map.undo()) { this._setStatus('Undo'); this._render(); } return; }
    if (ctrl&&(e.key==='y'||(e.key==='z'&&e.shiftKey))) { e.preventDefault(); if (this.map.redo()) { this._setStatus('Redo'); this._render(); } return; }
    if (ctrl&&e.key==='s') { e.preventDefault(); this._saveMap(); return; }
    if (ctrl&&e.key==='o') { e.preventDefault(); this._openMap(); return; }
    if (ctrl&&e.key==='n') { e.preventDefault(); this._newMap(); return; }
    if (ctrl&&!e.shiftKey&&e.key==='t') { e.preventDefault(); this._setTool('create'); return; }
    if (ctrl&&e.shiftKey &&e.key==='T') { e.preventDefault(); this._openRoomPropsModal(); return; }
    if (ctrl&&e.key==='a') { e.preventDefault(); this.selectedIndices=new Set(this.map.selectAll()); this._render(); return; }
    if (ctrl&&e.key==='c') { e.preventDefault(); this.map.copyRooms([...this.selectedIndices]); this._setStatus(`Copied ${this.selectedIndices.size}`); return; }
    if (ctrl&&e.key==='v') { e.preventDefault(); const p=this.map.pasteRooms(32,32); if (p.length) { this.selectedIndices=new Set(p); this._render(); } return; }

    const toolMap = { v:'select',t:'create',f:'fg',b:'bg',e:'entities',g:'triggers',x:'erase' };
    if (!ctrl&&!e.altKey&&toolMap[e.key]) { this._setTool(toolMap[e.key]); return; }
    if (e.key==='F'&&e.shiftKey) { e.preventDefault(); this.renderer.fitToScreen(this.map.rooms); this._render(); return; }
    if (e.key==='Escape') { this.selectedIndices.clear(); this._isCreating=false; this._createPreview=null; this._render(); return; }

    if (e.key==='Delete'&&this.currentTool==='select'&&this.selectedIndices.size>0) {
      if (!confirm(`Delete ${this.selectedIndices.size} room(s)?`)) return;
      [...this.selectedIndices].sort((a,b)=>b-a).forEach(i=>this.map.deleteRoom(i));
      this.selectedIndices.clear(); this._render(); return;
    }

    // Alt+arrows: move room 8px
    if (e.altKey && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const step=e.shiftKey?1:8;
      const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;
      const dy=e.key==='ArrowUp'  ?-step:e.key==='ArrowDown' ?step:0;
      for (const i of this.selectedIndices) { const r=this.map.rooms[i]; if (r) { r.x+=dx; r.y+=dy; } }
      this.map.pushHistory(); this._render(); return;
    }

    // Q/E/A/D resize
    if (!ctrl&&!e.altKey&&this.selectedIndices.size===1) {
      const step=8, i=[...this.selectedIndices][0], room=this.map.rooms[i]; if (!room) return;
      let changed=false;
      if (e.key==='q') { room.resize(Math.max(80,room.width-step),room.height); changed=true; }
      if (e.key==='e') { room.resize(room.width+step,room.height); changed=true; }
      if (e.key==='a') { room.resize(room.width,Math.max(80,room.height-step)); changed=true; }
      if (e.key==='d') { room.resize(room.width,room.height+step); changed=true; }
      if (changed) { this.map.pushHistory(); this._setStatus(`Resized: ${room.width}x${room.height}`); this._render(); }
    }
  }

  // ── Context menu ──────────────────────────────────────────
  _onCtxMenu(e) {
    e.preventDefault();
    this._isPanning=false; this.renderer.canvas.classList.remove('panning');
    const pos=this._pos(e);
    const ri=this.renderer.getRoomAt(pos.x,pos.y,this.map.rooms);
    if (ri<0) { this._hideCtxMenu(); return; }
    if (!this.selectedIndices.has(ri)) { this.selectedIndices.clear(); this.selectedIndices.add(ri); this._render(); }
    const menu=document.getElementById('ctx-menu');
    menu.style.left=`${e.clientX}px`; menu.style.top=`${e.clientY}px`; menu.style.display='block';
  }
  _hideCtxMenu() { const m=document.getElementById('ctx-menu'); if (m) m.style.display='none'; }
  _ctxAction(action) {
    switch (action) {
      case 'props':      this._openRoomPropsModal(); break;
      case 'regen':      this._regenRoom(); break;
      case 'resize-pcg': this._resizePcgRoom(); break;
      case 'gan-fill':   this._ganFillRoom(); break;
      case 'copy':       this.map.copyRooms([...this.selectedIndices]); this._setStatus('Copied'); break;
      case 'paste':      { const p=this.map.pasteRooms(32,32); if (p.length) { this.selectedIndices=new Set(p); this._render(); } break; }
      case 'delete':
        if (this.selectedIndices.size&&confirm(`Delete ${this.selectedIndices.size} room(s)?`)) {
          [...this.selectedIndices].sort((a,b)=>b-a).forEach(i=>this.map.deleteRoom(i));
          this.selectedIndices.clear(); this._render();
        }
        break;
    }
  }

  // ── PCG ops ───────────────────────────────────────────────
  _genParams() {
    return {
      mode:       document.getElementById('gen-mode')?.value     || 'normal',
      layout:     document.getElementById('gen-layout')?.value   || 'linear',
      archetype:  document.getElementById('gen-archetype')?.value || 'forest',
      kit:        document.getElementById('gen-kit')?.value      || 'default',
      seed:       document.getElementById('gen-seed')?.value     || '',
      roomWidth:  parseInt(document.getElementById('gen-room-w')?.value)  || 320,
      roomHeight: parseInt(document.getElementById('gen-room-h')?.value)  || 184,
    };
  }

  async _generate() {
    const btn=document.getElementById('btn-generate'); btn.disabled=true; btn.textContent='Generating...';
    this._setStatus('Generating...');
    const params={ ...this._genParams(), clusterWidth:parseInt(document.getElementById('gen-cluster-w')?.value)||3, clusterHeight:parseInt(document.getElementById('gen-cluster-h')?.value)||2 };
    try {
      const data=await window.electronAPI.generateMap(params);
      this.map.loadFromGenerator(data); this.renderer.fitToScreen(this.map.rooms); this.selectedIndices.clear(); this._render();
      const summary=data.summary||`${data.rooms.length} rooms`;
      document.getElementById('gen-summary').textContent=summary; this._setStatus(summary);
      if (data.seedLabel) { const n=data.seedLabel.replace(/\D/g,''); if (n) document.getElementById('gen-seed').value=n; }
    } catch(err) {
      const msg=err?.error||err?.message||String(err);
      this._setStatus(`Error: ${msg}`); document.getElementById('gen-summary').textContent=`Error: ${msg}`; alert(`Generator error:\n\n${msg}`);
    } finally { btn.disabled=false; btn.textContent='Generate'; }
  }

  async _addPcgRoom() {
    this._setStatus('Generating single room...');
    try {
      const data=await window.electronAPI.generateSingleRoom(this._genParams());
      if (!data.rooms||!data.rooms[0]) throw new Error('No room returned');
      let maxX=0; for (const r of this.map.rooms) maxX=Math.max(maxX,r.x+r.width);
      const src=data.rooms[0]; src.x=maxX+32; src.y=0;
      const room=new Room(src), ri=this.map.rooms.length;
      this.map.rooms.push(room); this.map.pushHistory();
      this.selectedIndices.clear(); this.selectedIndices.add(ri);
      this.renderer.fitToScreen(this.map.rooms); this._render(); this._setStatus(`Added ${room.name} via PCG`);
    } catch(err) { const msg=err?.error||err?.message||String(err); this._setStatus(`PCG Error: ${msg}`); alert(msg); }
  }

  async _regenRoom() {
    if (this.selectedIndices.size!==1) { this._setStatus('Select exactly one room to regenerate'); return; }
    const ri=[...this.selectedIndices][0], room=this.map.rooms[ri]; if (!room) return;
    this._setStatus('Regenerating room...');
    try {
      const data=await window.electronAPI.generateSingleRoom({ ...this._genParams(), roomWidth:room.width, roomHeight:room.height });
      if (!data.rooms||!data.rooms[0]) throw new Error('No room returned');
      const src=data.rooms[0];
      this.map.replaceRoomTiles(ri,src.tilesFg?.tiles,src.tilesBg?.tiles,src.entities);
      this._render(); this._setStatus(`Regenerated ${room.name}`);
    } catch(err) { const msg=err?.error||err?.message||String(err); this._setStatus(`PCG Error: ${msg}`); alert(msg); }
  }

  async _resizePcgRoom() {
    if (this.selectedIndices.size!==1) { this._setStatus('Select one room first'); return; }
    const ri=[...this.selectedIndices][0], room=this.map.rooms[ri]; if (!room) return;
    const wStr=prompt('New width (px, multiple of 8):',String(room.width));
    const hStr=prompt('New height (px, multiple of 8):',String(room.height));
    if (!wStr||!hStr) return;
    const nw=snap8(clamp(parseInt(wStr)||room.width,80,2048));
    const nh=snap8(clamp(parseInt(hStr)||room.height,80,2048));
    room.resize(nw,nh); this.map.pushHistory(); this._render(); this._setStatus('Resized, regenerating...');
    await this._regenRoom();
  }

  async _ganFillRoom() {
    if (this.selectedIndices.size !== 1) { this._setStatus('Select exactly one room for GAN fill'); return; }
    const ri = [...this.selectedIndices][0], room = this.map.rooms[ri];
    if (!room) return;
    this._setStatus('GAN filling room...');
    const kit = document.getElementById('gen-kit')?.value || 'house';
    try {
      const result = await window.electronAPI.ganFillRoom({
        width: room.width,
        height: room.height,
        kit,
        temperature: 1.0,
      });
      if (result.error) throw new Error(result.error);
      if (!result.tiles || !result.tiles.length) throw new Error('No tiles returned');
      this.map.pushHistory();
      room.tilesFg = { tiles: result.tiles };
      this._render();
      this._setStatus(`GAN filled ${room.name} (${result.width}×${result.height} tiles)`);
    } catch (err) {
      const msg = err?.error || err?.message || String(err);
      this._setStatus(`GAN Error: ${msg}`);
      alert(`GAN Fill failed:\n\n${msg}`);
    }
  }

  // ── File ops ──────────────────────────────────────────────
  async _newMap() {
    if (this.map.isDirty&&this.map.rooms.length>0&&!confirm('Discard unsaved changes?')) return;
    this.map=new MapModel(); this.selectedIndices.clear();
    document.getElementById('gen-summary').textContent=''; this._render(); this._setStatus('New map');
  }
  async _openMap() {
    try {
      const r=await window.electronAPI.openMap(); if (!r) return;
      this.map.loadFromJSON(r.content,r.filePath); this.renderer.fitToScreen(this.map.rooms); this.selectedIndices.clear(); this._render(); this._setStatus(`Opened: ${r.filePath}`);
    } catch(err) { alert(`Failed to open:\n${err.message||err}`); }
  }
  async _saveMap() {
    try {
      const path=await window.electronAPI.saveMap(this.map.toJSON(),this.map.filePath);
      if (path) { this.map._filePath=path; this.map._dirty=false; this._render(); this._setStatus(`Saved: ${path}`); }
    } catch(err) { alert(`Failed to save:\n${err.message||err}`); }
  }
  async _exportMap() {
    try { const p=await window.electronAPI.saveMap(this.map.toJSON(),null); if (p) this._setStatus(`Exported: ${p}`); }
    catch(err) { alert(`Failed to export:\n${err.message||err}`); }
  }

  // ── Room props modal ──────────────────────────────────────
  _openRoomPropsModal() {
    if (this.selectedIndices.size!==1) return;
    const ri=[...this.selectedIndices][0], r=this.map.rooms[ri]; if (!r) return;
    const set=(id,v)=>{ const el=document.getElementById(id); if(el){ if(el.type==='checkbox') el.checked=!!v; else el.value=v??''; } };
    set('mp-name',r.name); set('mp-x',r.x); set('mp-y',r.y); set('mp-w',r.width); set('mp-h',r.height);
    set('mp-music',r.music); set('mp-ambience',r.ambience); set('mp-wind',r.wind); set('mp-color',r.color);
    set('mp-dark',r.dark); set('mp-underwater',r.underwater); set('mp-space',r.space);
    set('mp-hasCheckpoint',r.hasCheckpoint); set('mp-delayAltMusic',r.delayAltMusic);
    document.getElementById('modal-room-props').style.display='flex';
  }
  _closeModal() { document.getElementById('modal-room-props').style.display='none'; }
  _applyRoomProps() {
    if (this.selectedIndices.size!==1) { this._closeModal(); return; }
    const ri=[...this.selectedIndices][0], r=this.map.rooms[ri]; if (!r) return;
    const get=(id)=>{ const el=document.getElementById(id); return el ? (el.type==='checkbox'?el.checked:el.value) : ''; };
    const nw=snap8(clamp(parseInt(get('mp-w'))||r.width,80,2048));
    const nh=snap8(clamp(parseInt(get('mp-h'))||r.height,80,2048));
    if (nw!==r.width||nh!==r.height) r.resize(nw,nh);
    r.name=get('mp-name')||r.name; r.x=snap8(parseInt(get('mp-x'))||r.x); r.y=snap8(parseInt(get('mp-y'))||r.y);
    r.music=get('mp-music'); r.ambience=get('mp-ambience'); r.wind=get('mp-wind'); r.color=parseInt(get('mp-color'))||0;
    r.dark=get('mp-dark'); r.underwater=get('mp-underwater'); r.space=get('mp-space');
    r.hasCheckpoint=get('mp-hasCheckpoint'); r.delayAltMusic=get('mp-delayAltMusic');
    this.map.pushHistory(); this._closeModal(); this._render(); this._setStatus(`Updated ${r.name}`);
  }

  // ── Inspector panel ───────────────────────────────────────
  _updateInspector() {
    const pane=document.getElementById('inspector-content'); if(!pane) return;
    if (this.selectedIndices.size===0) { pane.innerHTML='<p class="no-selection">No room selected.</p>'; return; }
    if (this.selectedIndices.size>1) { pane.innerHTML=`<p class="no-selection">${this.selectedIndices.size} rooms selected.<br>Alt+arrows to move.<br>Q/E = width, A/D = height.</p>`; return; }
    const ri=[...this.selectedIndices][0], room=this.map.rooms[ri]; if (!room) return;
    pane.innerHTML=`
      <div class="inspector-field"><label>Name</label><input id="insp-name" type="text" value="${esc(room.name)}"/></div>
      <div class="inspector-field"><label>Pos</label><div class="inspector-row"><input id="insp-x" type="number" value="${room.x}" step="8"/><input id="insp-y" type="number" value="${room.y}" step="8"/></div></div>
      <div class="inspector-field"><label>Size</label><div class="inspector-row"><input id="insp-w" type="number" value="${room.width}" step="8" min="80"/><input id="insp-h" type="number" value="${room.height}" step="8" min="80"/></div></div>
      <div class="inspector-field"><label>Music</label><input id="insp-music" type="text" value="${esc(room.music||'')}"/></div>
      <div class="inspector-field"><label>Color</label><select id="insp-color">${ROOM_COLORS.map((c,i)=>`<option value="${i}"${room.color===i?' selected':''}>${i}</option>`).join('')}</select></div>
      <div class="inspector-flags">
        <label><input id="insp-dark" type="checkbox" ${room.dark?'checked':''}/> Dark</label>
        <label><input id="insp-underwater" type="checkbox" ${room.underwater?'checked':''}/> Water</label>
        <label><input id="insp-space" type="checkbox" ${room.space?'checked':''}/> Space</label>
      </div>
      <div class="inspector-field"><label>Entities <span class="count-badge">${room.entities.length}</span></label>
        <div class="entity-scroll">${room.entities.length?room.entities.map(e=>`<div class="entity-item" style="border-left:2px solid ${ENTITY_COLOR[e.name]||'#aaa'}">${esc(e.name)}</div>`).join(''):'<span class="empty-label">none</span>'}</div>
      </div>
      <div class="inspector-field"><label>Triggers <span class="count-badge">${room.triggers.length}</span></label>
        <div class="entity-scroll">${room.triggers.length?room.triggers.map(t=>`<div class="entity-item" style="border-left:2px solid #ff8800">${esc(t.name)}</div>`).join(''):'<span class="empty-label">none</span>'}</div>
      </div>
      <button id="insp-open-props" style="margin-top:6px;width:100%;background:#2a305e;border:1px solid #446;color:#aad;padding:4px;cursor:pointer;font-size:11px">Room Properties (Ctrl+Shift+T)</button>
    `;
    const upd=(id,setter)=>{ const el=document.getElementById(id); if(el) el.addEventListener('change',()=>{ setter(el); this.map.pushHistory(); this._render(); }); };
    upd('insp-name',        el=>room.name=el.value);
    upd('insp-x',           el=>{ room.x=snap8(parseInt(el.value)||0); });
    upd('insp-y',           el=>{ room.y=snap8(parseInt(el.value)||0); });
    upd('insp-w',           el=>room.resize(snap8(clamp(parseInt(el.value)||room.width,80,2048)),room.height));
    upd('insp-h',           el=>room.resize(room.width,snap8(clamp(parseInt(el.value)||room.height,80,2048))));
    upd('insp-music',       el=>room.music=el.value);
    upd('insp-color',       el=>room.color=parseInt(el.value));
    upd('insp-dark',        el=>room.dark=el.checked);
    upd('insp-underwater',  el=>room.underwater=el.checked);
    upd('insp-space',       el=>room.space=el.checked);
    const pb=document.getElementById('insp-open-props'); if (pb) pb.addEventListener('click',()=>this._openRoomPropsModal());
  }

  // ── Topology panel ────────────────────────────────────────
  _updateTopology() {
    const div=document.getElementById('topology-info'); if (!div) return;
    const meta=this.map.previewMetadata;
    if (!meta) { div.innerHTML='<p class="no-selection">Generate a map to see topology.</p>'; return; }
    const nodes=meta.nodes||[], mainLen=(meta.mainPathNodeIds||[]).length;
    const roles={};  for (const n of nodes) roles[n.role]=(roles[n.role]||0)+1;
    div.innerHTML=`
      <div class="topo-row"><span class="topo-label">Rooms</span><span class="topo-value">${this.map.rooms.length}</span></div>
      <div class="topo-row"><span class="topo-label">Layout</span><span class="topo-value">${esc(meta.layoutMode||'—')}</span></div>
      <div class="topo-row"><span class="topo-label">Main path</span><span class="topo-path">${mainLen} nodes</span></div>
      ${Object.entries(roles).map(([r,n])=>`<div class="topo-row"><span class="topo-label">&nbsp;${r}</span><span class="topo-branch">${n}</span></div>`).join('')}
      <div class="topo-row" style="margin-top:5px"><span class="topo-label">Start</span><span class="topo-value">node ${meta.startNodeId??'—'}</span></div>
      <div class="topo-row"><span class="topo-label">Goal</span><span class="topo-value">node ${meta.goalNodeId??'—'}</span></div>
    `;
  }

  // ── Status bar ────────────────────────────────────────────
  _setStatus(msg) { this._statusMsg=msg; }
  _updateStatusBar() {
    const dirty=this.map.isDirty?'*':'';
    const fp=this.map.filePath?this.map.filePath.split(/[\\\/]/).pop():'Untitled';
    const el=document.getElementById('status-bar'); if (el) el.textContent=`${fp}${dirty}  ·  ${this._statusMsg}  ·  rooms:${this.map.rooms.length}  ·  sel:${this.selectedIndices.size}  ·  ${this.currentTool}`;
  }

  async _checkGeneratorPath() {
    try {
      const info=await window.electronAPI.getGeneratorPath();
      const el=document.getElementById('generator-status'); if (!el) return;
      el.textContent=info.exists?'● Generator ready':'✗ Generator not found';
      el.className=`gen-status ${info.exists?'gen-ok':'gen-error'}`; el.title=info.path;
    } catch(_) {}
  }
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  window._app = new AppUI();
});