'use strict';

const { TextDecoder, TextEncoder } = require('util');

const utf8Decoder = new TextDecoder('utf-8');
const utf8Encoder = new TextEncoder();

function toArrayBuffer(input) {
  if (input instanceof ArrayBuffer) {
    return input;
  }
  if (ArrayBuffer.isView(input)) {
    const view = input;
    return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
  }
  throw new Error('Expected ArrayBuffer, Buffer, or TypedArray input.');
}

function normalizeTileChar(value) {
  if (typeof value === 'string' && value.length > 0) return value[0];
  return '0';
}

function normalizeInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function normalizeFloat(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  return fallback;
}

function splitRows(raw, expectedHeight) {
  const rows = String(raw || '').split('\n').filter((row) => row.length > 0);
  while (rows.length < expectedHeight) rows.push('');
  return rows.slice(0, expectedHeight);
}

function flatTilesToRows(grid, fallbackWidth, fallbackHeight) {
  if (!grid) return null;

  const width = normalizeInt(grid.width, fallbackWidth);
  const height = normalizeInt(grid.height, fallbackHeight);

  if (width <= 0 || height <= 0 || !Array.isArray(grid.tiles)) {
    return null;
  }

  if (
    grid.tiles.length === height &&
    grid.tiles.every((row) => typeof row === 'string')
  ) {
    return {
      tiles: grid.tiles.map((row) => {
        const src = typeof row === 'string' ? row : '';
        return Array.from({ length: width }, (_, col) => src[col] || '0').join('');
      }),
    };
  }

  const rows = [];
  for (let row = 0; row < height; row++) {
    let line = '';
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      line += normalizeTileChar(grid.tiles[index]);
    }
    rows.push(line);
  }

  return { tiles: rows };
}

function rowsToFlatCharGrid(layer, width, height) {
  if (!layer) return null;

  if (typeof layer === 'string') {
    const rows = splitRows(layer, height);
    const tiles = [];
    for (let row = 0; row < height; row++) {
      const line = rows[row] || '';
      for (let col = 0; col < width; col++) {
        tiles.push(line[col] || '0');
      }
    }
    return { width, height, tiles };
  }

  if (!Array.isArray(layer.tiles)) {
    return null;
  }

  if (layer.tiles.length === width * height) {
    return {
      width,
      height,
      tiles: layer.tiles.map((value) => normalizeTileChar(value)),
    };
  }

  if (layer.tiles.length === height && layer.tiles.every((row) => typeof row === 'string')) {
    const tiles = [];
    for (let row = 0; row < height; row++) {
      const line = layer.tiles[row] || '';
      for (let col = 0; col < width; col++) {
        tiles.push(line[col] || '0');
      }
    }
    return { width, height, tiles };
  }

  // Best-effort flattening for unknown layouts.
  const tiles = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      tiles.push(normalizeTileChar(layer.tiles[index]));
    }
  }
  return { width, height, tiles };
}

function parseObjectGridFromString(raw) {
  const lines = String(raw || '').split('\n').filter((line) => line.length > 0);
  const height = lines.length;
  let width = 0;
  const values = [];

  for (const line of lines) {
    const cols = line.split(',');
    width = Math.max(width, cols.length);
    for (const col of cols) {
      const trimmed = col.trim();
      values.push(trimmed ? parseInt(trimmed, 10) : -1);
    }
  }

  return { width, height, tiles: values };
}

function normalizeObjectGrid(layer, width, height) {
  if (!layer) return null;

  if (typeof layer === 'string') {
    return parseObjectGridFromString(layer);
  }

  if (!Array.isArray(layer.tiles)) {
    return null;
  }

  const gridWidth = normalizeInt(layer.width, width);
  const gridHeight = normalizeInt(layer.height, height);

  if (gridWidth <= 0 || gridHeight <= 0) return null;

  if (layer.tiles.length === gridHeight && layer.tiles.every((row) => typeof row === 'string')) {
    const values = [];
    for (let row = 0; row < gridHeight; row++) {
      const cols = String(layer.tiles[row] || '').split(',');
      for (let col = 0; col < gridWidth; col++) {
        const trimmed = (cols[col] || '').trim();
        values.push(trimmed ? parseInt(trimmed, 10) : -1);
      }
    }
    return { width: gridWidth, height: gridHeight, tiles: values };
  }

  const values = [];
  for (let i = 0; i < gridWidth * gridHeight; i++) {
    values.push(normalizeInt(layer.tiles[i], -1));
  }
  return { width: gridWidth, height: gridHeight, tiles: values };
}

class BinaryReader {
  constructor(arrayBuffer) {
    this.data = new DataView(arrayBuffer);
    this.uint8 = new Uint8Array(arrayBuffer);
    this.pos = 0;
    this.lookup = [];
  }

  readByte() {
    const value = this.uint8[this.pos];
    this.pos += 1;
    return value;
  }

  readBytes(count) {
    const bytes = this.uint8.slice(this.pos, this.pos + count);
    this.pos += count;
    return bytes;
  }

  readBool() {
    return this.readByte() !== 0;
  }

  readUInt16() {
    const value = this.data.getUint16(this.pos, true);
    this.pos += 2;
    return value;
  }

  readInt16() {
    const value = this.data.getInt16(this.pos, true);
    this.pos += 2;
    return value;
  }

  readInt32() {
    const value = this.data.getInt32(this.pos, true);
    this.pos += 4;
    return value;
  }

  readFloat32() {
    const value = this.data.getFloat32(this.pos, true);
    this.pos += 4;
    return value;
  }

  read7BitInt() {
    let value = 0;
    let shift = 0;
    while (true) {
      const byte = this.uint8[this.pos];
      this.pos += 1;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return value;
  }

  readString() {
    const length = this.read7BitInt();
    if (length === 0) return '';
    const bytes = this.readBytes(length);
    return utf8Decoder.decode(bytes);
  }

  readLookupString() {
    const index = this.readUInt16();
    if (index < this.lookup.length) return this.lookup[index];
    return `?${index}`;
  }

  readRLE() {
    const count = this.readInt16();
    if (count < 0) {
      const bytes = this.readBytes(-count);
      return utf8Decoder.decode(bytes);
    }

    const output = [];
    let consumed = 0;
    while (consumed < count) {
      const runLength = this.readByte();
      const ch = String.fromCharCode(this.readByte());
      output.push(ch.repeat(runLength));
      consumed += 2;
    }
    return output.join('');
  }

  readValue() {
    const valueType = this.readByte();
    switch (valueType) {
      case 0:
        return this.readBool();
      case 1:
        return this.readByte();
      case 2:
        return this.readInt16();
      case 3:
        return this.readInt32();
      case 4:
        return this.readFloat32();
      case 5:
        return this.readLookupString();
      case 6:
        return this.readString();
      case 7:
        return this.readRLE();
      default:
        throw new Error(`Unknown value type ${valueType} at byte ${this.pos - 1}`);
    }
  }

  parseElement(depth = 0, maxDepth = 200) {
    if (depth > maxDepth) return { __name: 'DEPTH_LIMIT', __children: [] };

    const element = {
      __name: this.readLookupString(),
      __children: [],
    };

    const attributeCount = this.readByte();
    for (let i = 0; i < attributeCount; i++) {
      const key = this.readLookupString();
      element[key] = this.readValue();
    }

    const childCount = this.readUInt16();
    for (let i = 0; i < childCount; i++) {
      element.__children.push(this.parseElement(depth + 1, maxDepth));
    }

    return element;
  }
}

function parseTileGrid(element, width, height) {
  const rows = splitRows(element.innerText || '', height);
  const tiles = [];

  for (let row = 0; row < height; row++) {
    const line = rows[row] || '';
    for (let col = 0; col < width; col++) {
      tiles.push(line[col] || '0');
    }
  }

  return { width, height, tiles };
}

function parseObjectTileGrid(element) {
  return parseObjectGridFromString(element.innerText || '');
}

function parseEntity(element) {
  const entity = {
    name: element.__name || 'unknown',
    id: normalizeInt(element.id, 0),
    x: normalizeInt(element.x, 0),
    y: normalizeInt(element.y, 0),
    width: normalizeInt(element.width, 0),
    height: normalizeInt(element.height, 0),
    nodes: [],
    attributes: {},
  };

  for (const child of element.__children || []) {
    if (child.__name === 'node') {
      entity.nodes.push({
        x: normalizeInt(child.x, 0),
        y: normalizeInt(child.y, 0),
      });
    }
  }

  const reserved = new Set(['__name', '__children', 'id', 'x', 'y', 'width', 'height']);
  for (const [key, value] of Object.entries(element)) {
    if (reserved.has(key)) continue;
    entity.attributes[key] = value;
  }

  return entity;
}

function parseDecal(element) {
  let texture = typeof element.texture === 'string' ? element.texture.replace(/\\/g, '/') : '';
  if (texture.toLowerCase().endsWith('.png')) {
    texture = texture.slice(0, -4);
  }

  return {
    texture,
    x: normalizeInt(element.x, 0),
    y: normalizeInt(element.y, 0),
    scaleX: normalizeFloat(element.scaleX, 1),
    scaleY: normalizeFloat(element.scaleY, 1),
    rotation: normalizeFloat(element.rotation, 0),
    color: typeof element.color === 'string' ? element.color : 'ffffffff',
  };
}

function parseStyleEntries(styleRoot) {
  const entries = [];

  for (const child of styleRoot.__children || []) {
    if (child.__name === 'parallax') {
      entries.push({
        type: 'parallax',
        texture: child.texture || '',
        x: normalizeFloat(child.x, 0),
        y: normalizeFloat(child.y, 0),
        scrollX: normalizeFloat(child.scrollx, 1),
        scrollY: normalizeFloat(child.scrolly, 1),
        speedX: normalizeFloat(child.speedx, 0),
        speedY: normalizeFloat(child.speedy, 0),
        color: child.color || 'ffffff',
        alpha: normalizeFloat(child.alpha, 1),
        flipX: normalizeBool(child.flipx, false),
        flipY: normalizeBool(child.flipy, false),
        loopX: normalizeBool(child.loopx, true),
        loopY: normalizeBool(child.loopy, true),
        blendMode: child.blendmode || 'alphablend',
        only: child.only || '*',
        exclude: child.exclude || '',
        flag: child.flag || '',
        notFlag: child.notflag || '',
        tag: child.tag || '',
      });
      continue;
    }

    if (child.__name === 'apply') {
      const nested = parseStyleEntries(child);
      for (const entry of nested) {
        for (const [key, value] of Object.entries(child)) {
          if (key.startsWith('__')) continue;
          if (!(key in entry)) entry[key] = value;
        }
        entries.push(entry);
      }
      continue;
    }

    const styleEntry = {
      type: 'effect',
      name: child.__name,
      only: child.only || '*',
      exclude: child.exclude || '',
      flag: child.flag || '',
      notFlag: child.notflag || '',
      tag: child.tag || '',
    };

    const reserved = new Set(['__name', '__children', 'only', 'exclude', 'flag', 'notflag', 'tag']);
    for (const [key, value] of Object.entries(child)) {
      if (reserved.has(key)) continue;
      styleEntry[key] = value;
    }

    entries.push(styleEntry);
  }

  return entries;
}

function parseRoom(element) {
  const width = normalizeInt(element.width, 320);
  const height = normalizeInt(element.height, 184);
  const tileWidth = Math.max(1, normalizeInt(element.tileWidth, Math.floor(width / 8)));
  const tileHeight = Math.max(1, normalizeInt(element.tileHeight, Math.floor(height / 8)));

  const room = {
    name: element.name || 'unnamed',
    x: normalizeInt(element.x, 0),
    y: normalizeInt(element.y, 0),
    width,
    height,
    tileWidth,
    tileHeight,
    music: element.music || '',
    musicLayer1: normalizeBool(element.musicLayer1, true),
    musicLayer2: normalizeBool(element.musicLayer2, true),
    musicLayer3: normalizeBool(element.musicLayer3, true),
    musicLayer4: normalizeBool(element.musicLayer4, true),
    altMusic: element.altMusic || element.alt_music || '',
    ambience: element.ambience || '',
    dark: normalizeBool(element.dark, false),
    underwater: normalizeBool(element.underwater, false),
    space: normalizeBool(element.space, false),
    disableDownTransition: normalizeBool(element.disableDownTransition, false),
    cameraOffsetX: normalizeInt(element.cameraOffsetX, 0),
    cameraOffsetY: normalizeInt(element.cameraOffsetY, 0),
    windPattern: element.windPattern || element.wind || 'None',
    color: normalizeInt(element.color, normalizeInt(element.c, 0)),
    musicProgress: element.musicProgress || element.music_progress || '',
    ambienceProgress: element.ambienceProgress || element.ambience_progress || '',
    delayAltMusicFade: normalizeBool(element.delayAltMusicFade, normalizeBool(element.delay_alt_music_fade, false)),
    whisper: normalizeBool(element.whisper, false),
    tilesFg: null,
    tilesBg: null,
    fgTiles: null,
    objTiles: null,
    bgTiles: null,
    entities: [],
    triggers: [],
    decalsFg: [],
    decalsBg: [],
  };

  for (const child of element.__children || []) {
    switch (child.__name) {
      case 'solids':
        room.tilesFg = parseTileGrid(child, tileWidth, tileHeight);
        break;
      case 'bg':
        room.tilesBg = parseTileGrid(child, tileWidth, tileHeight);
        break;
      case 'fgtiles':
        room.fgTiles = parseObjectTileGrid(child);
        break;
      case 'objtiles':
        room.objTiles = parseObjectTileGrid(child);
        break;
      case 'bgtiles':
        room.bgTiles = parseObjectTileGrid(child);
        break;
      case 'entities':
        for (const entity of child.__children || []) room.entities.push(parseEntity(entity));
        break;
      case 'triggers':
        for (const trigger of child.__children || []) room.triggers.push(parseEntity(trigger));
        break;
      case 'fgdecals':
        for (const decal of child.__children || []) room.decalsFg.push(parseDecal(decal));
        break;
      case 'bgdecals':
        for (const decal of child.__children || []) room.decalsBg.push(parseDecal(decal));
        break;
      default:
        break;
    }
  }

  return room;
}

function parseRoot(packageName, rootElement) {
  const map = {
    packageName,
    rooms: [],
    fillers: [],
    stylesFg: [],
    stylesBg: [],
  };

  for (const child of rootElement.__children || []) {
    switch (child.__name) {
      case 'levels':
        for (const level of child.__children || []) {
          map.rooms.push(parseRoom(level));
        }
        break;
      case 'Filler':
        for (const filler of child.__children || []) {
          if (filler.__name !== 'rect') continue;
          map.fillers.push({
            x: normalizeInt(filler.x, 0),
            y: normalizeInt(filler.y, 0),
            width: normalizeInt(filler.w, 0),
            height: normalizeInt(filler.h, 0),
          });
        }
        break;
      case 'Style':
        for (const styleGroup of child.__children || []) {
          if (styleGroup.__name === 'Foregrounds') {
            map.stylesFg = parseStyleEntries(styleGroup);
          } else if (styleGroup.__name === 'Backgrounds') {
            map.stylesBg = parseStyleEntries(styleGroup);
          }
        }
        break;
      default:
        break;
    }
  }

  return map;
}

function parseMapBinary(input) {
  const arrayBuffer = toArrayBuffer(input);
  const reader = new BinaryReader(arrayBuffer);

  const header = reader.readString();
  if (header !== 'CELESTE MAP') {
    throw new Error(`Invalid map header: expected 'CELESTE MAP', got '${header}'`);
  }

  const packageName = reader.readString();
  const lookupLength = reader.readInt16();

  for (let i = 0; i < lookupLength; i++) {
    reader.lookup.push(reader.readString());
  }

  const root = reader.parseElement();
  return parseRoot(packageName, root);
}

class BinaryWriter {
  constructor() {
    this.chunks = [];
    this.lookup = new Map();
    this.lookupList = [];
  }

  addLookup(value) {
    if (typeof value !== 'string') return;
    if (value.length === 0) return;
    if (this.lookup.has(value)) return;
    this.lookup.set(value, this.lookupList.length);
    this.lookupList.push(value);
  }

  buildLookup(map) {
    this.lookup.clear();
    this.lookupList = [];

    const fixed = [
      'Map',
      'levels',
      'level',
      'solids',
      'bg',
      'fgtiles',
      'objtiles',
      'bgtiles',
      'entities',
      'triggers',
      'fgdecals',
      'bgdecals',
      'decal',
      'Filler',
      'rect',
      'Style',
      'Foregrounds',
      'Backgrounds',
      'parallax',
      'apply',
      'node',
    ];

    for (const item of fixed) this.addLookup(item);

    const commonAttributes = [
      'name',
      'x',
      'y',
      'width',
      'height',
      'w',
      'h',
      'music',
      'musicLayer1',
      'musicLayer2',
      'musicLayer3',
      'musicLayer4',
      'altMusic',
      'alt_music',
      'ambience',
      'dark',
      'underwater',
      'space',
      'disableDownTransition',
      'cameraOffsetX',
      'cameraOffsetY',
      'windPattern',
      'color',
      'c',
      'musicProgress',
      'ambienceProgress',
      'delayAltMusicFade',
      'delay_alt_music_fade',
      'whisper',
      'innerText',
      'id',
      'texture',
      'scaleX',
      'scaleY',
      'rotation',
      'scrollx',
      'scrolly',
      'speedx',
      'speedy',
      'alpha',
      'flipx',
      'flipy',
      'loopx',
      'loopy',
      'blendmode',
      'only',
      'exclude',
      'flag',
      'notflag',
      'tag',
    ];

    for (const item of commonAttributes) this.addLookup(item);

    for (const room of map.rooms || []) {
      this.addLookup(room.name);
      this.addLookup(room.music);
      this.addLookup(room.altMusic);
      this.addLookup(room.ambience);
      this.addLookup(room.windPattern);
      this.addLookup(room.musicProgress);
      this.addLookup(room.ambienceProgress);

      for (const entity of [...(room.entities || []), ...(room.triggers || [])]) {
        this.addLookup(entity.name);
        for (const key of Object.keys(entity.attributes || {})) {
          this.addLookup(key);
          const value = entity.attributes[key];
          if (typeof value === 'string') this.addLookup(value);
        }
      }

      for (const decal of [...(room.decalsFg || []), ...(room.decalsBg || [])]) {
        this.addLookup(decal.texture);
        this.addLookup(decal.color);
      }
    }

    for (const style of [...(map.stylesFg || []), ...(map.stylesBg || [])]) {
      if (style.name) this.addLookup(style.name);
      if (style.texture) this.addLookup(style.texture);
      for (const [key, value] of Object.entries(style)) {
        this.addLookup(key);
        if (typeof value === 'string') this.addLookup(value);
      }
    }
  }

  writeByte(value) {
    this.chunks.push(new Uint8Array([value & 0xff]));
  }

  writeBytes(value) {
    this.chunks.push(value);
  }

  writeBool(value) {
    this.writeByte(value ? 1 : 0);
  }

  writeUInt16(value) {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setUint16(0, value, true);
    this.chunks.push(new Uint8Array(buffer));
  }

  writeInt16(value) {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, value, true);
    this.chunks.push(new Uint8Array(buffer));
  }

  writeInt32(value) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setInt32(0, value, true);
    this.chunks.push(new Uint8Array(buffer));
  }

  writeFloat32(value) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.chunks.push(new Uint8Array(buffer));
  }

  write7BitInt(value) {
    let next = value >>> 0;
    while (next >= 0x80) {
      this.writeByte((next & 0x7f) | 0x80);
      next >>= 7;
    }
    this.writeByte(next & 0x7f);
  }

  writeString(value) {
    const bytes = utf8Encoder.encode(String(value));
    this.write7BitInt(bytes.length);
    this.writeBytes(bytes);
  }

  writeLookupIndex(value) {
    const index = this.lookup.get(value);
    if (index === undefined) {
      throw new Error(`String not in lookup table: '${value}'`);
    }
    this.writeUInt16(index);
  }

  writeValue(key, value) {
    this.writeLookupIndex(key);

    if (typeof value === 'boolean') {
      this.writeByte(0);
      this.writeBool(value);
      return;
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= 0 && value <= 255) {
          this.writeByte(1);
          this.writeByte(value);
        } else if (value >= -32768 && value <= 32767) {
          this.writeByte(2);
          this.writeInt16(value);
        } else {
          this.writeByte(3);
          this.writeInt32(value);
        }
      } else {
        this.writeByte(4);
        this.writeFloat32(value);
      }
      return;
    }

    const asString = String(value ?? '');
    if (this.lookup.has(asString)) {
      this.writeByte(5);
      this.writeLookupIndex(asString);
    } else {
      this.writeByte(6);
      this.writeString(asString);
    }
  }

  writeRLEValue(key, value) {
    this.writeLookupIndex(key);
    this.writeByte(7);

    const text = String(value || '');
    const pairs = [];
    let index = 0;

    while (index < text.length) {
      const ch = text[index];
      let count = 1;
      while (index + count < text.length && text[index + count] === ch && count < 255) {
        count += 1;
      }
      pairs.push(count, ch.charCodeAt(0));
      index += count;
    }

    this.writeInt16(pairs.length);
    for (const pair of pairs) this.writeByte(pair);
  }

  serialize(map) {
    this.chunks = [];
    this.buildLookup(map);

    this.writeString('CELESTE MAP');
    this.writeString(map.packageName);

    this.writeInt16(this.lookupList.length);
    for (const str of this.lookupList) this.writeString(str);

    this.writeMapElement(map);

    const totalBytes = this.chunks.reduce((sum, part) => sum + part.length, 0);
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const part of this.chunks) {
      combined.set(part, offset);
      offset += part.length;
    }

    return combined.buffer;
  }

  writeMapElement(map) {
    this.writeLookupIndex('Map');
    this.writeByte(0);

    let childCount = 2; // levels + style
    if ((map.fillers || []).length > 0) childCount += 1;

    this.writeUInt16(childCount);
    this.writeLevelsElement(map.rooms || []);

    if ((map.fillers || []).length > 0) {
      this.writeFillerElement(map.fillers);
    }

    this.writeStyleElement(map.stylesFg || [], map.stylesBg || []);
  }

  writeLevelsElement(rooms) {
    this.writeLookupIndex('levels');
    this.writeByte(0);
    this.writeUInt16(rooms.length);
    for (const room of rooms) this.writeRoomElement(room);
  }

  writeRoomElement(room) {
    this.writeLookupIndex('level');

    const attributes = [
      ['name', room.name],
      ['x', room.x],
      ['y', room.y],
      ['width', room.width],
      ['height', room.height],
      ['music', room.music],
      ['musicLayer1', room.musicLayer1],
      ['musicLayer2', room.musicLayer2],
      ['musicLayer3', room.musicLayer3],
      ['musicLayer4', room.musicLayer4],
      ['altMusic', room.altMusic],
      ['ambience', room.ambience],
      ['dark', room.dark],
      ['underwater', room.underwater],
      ['space', room.space],
      ['disableDownTransition', room.disableDownTransition],
      ['cameraOffsetX', room.cameraOffsetX],
      ['cameraOffsetY', room.cameraOffsetY],
      ['windPattern', room.windPattern],
      ['color', room.color],
    ];

    if (room.musicProgress) attributes.push(['musicProgress', room.musicProgress]);
    if (room.ambienceProgress) attributes.push(['ambienceProgress', room.ambienceProgress]);
    if (room.delayAltMusicFade) attributes.push(['delayAltMusicFade', room.delayAltMusicFade]);
    if (room.whisper) attributes.push(['whisper', room.whisper]);

    this.writeByte(attributes.length);
    for (const [key, value] of attributes) {
      this.writeValue(key, value);
    }

    let childCount = 4; // entities/triggers/fgdecals/bgdecals
    if (room.tilesFg) childCount += 1;
    if (room.tilesBg) childCount += 1;
    if (room.fgTiles) childCount += 1;
    if (room.objTiles) childCount += 1;
    if (room.bgTiles) childCount += 1;

    this.writeUInt16(childCount);

    if (room.tilesFg) this.writeTileLayerElement('solids', room.tilesFg);
    if (room.tilesBg) this.writeTileLayerElement('bg', room.tilesBg);
    if (room.fgTiles) this.writeObjectTileLayerElement('fgtiles', room.fgTiles);
    if (room.objTiles) this.writeObjectTileLayerElement('objtiles', room.objTiles);
    if (room.bgTiles) this.writeObjectTileLayerElement('bgtiles', room.bgTiles);

    this.writeEntitiesElement('entities', room.entities || []);
    this.writeEntitiesElement('triggers', room.triggers || []);
    this.writeDecalsElement('fgdecals', room.decalsFg || []);
    this.writeDecalsElement('bgdecals', room.decalsBg || []);
  }

  writeTileLayerElement(name, layer) {
    this.writeLookupIndex(name);

    const rows = [];
    for (let row = 0; row < layer.height; row++) {
      let line = '';
      for (let col = 0; col < layer.width; col++) {
        line += normalizeTileChar(layer.tiles[row * layer.width + col]);
      }
      rows.push(line);
    }

    this.writeByte(1);
    this.writeRLEValue('innerText', rows.join('\n'));
    this.writeUInt16(0);
  }

  writeObjectTileLayerElement(name, layer) {
    this.writeLookupIndex(name);

    const rows = [];
    for (let row = 0; row < layer.height; row++) {
      const values = [];
      for (let col = 0; col < layer.width; col++) {
        values.push(String(normalizeInt(layer.tiles[row * layer.width + col], -1)));
      }
      rows.push(values.join(','));
    }

    this.writeByte(1);
    this.writeRLEValue('innerText', rows.join('\n'));
    this.writeUInt16(0);
  }

  writeEntitiesElement(name, entities) {
    this.writeLookupIndex(name);
    this.writeByte(0);
    this.writeUInt16(entities.length);
    for (const entity of entities) this.writeEntityElement(entity);
  }

  writeEntityElement(entity) {
    this.writeLookupIndex(entity.name);

    const base = [
      ['id', normalizeInt(entity.id, 0)],
      ['x', normalizeInt(entity.x, 0)],
      ['y', normalizeInt(entity.y, 0)],
    ];

    if (normalizeInt(entity.width, 0) !== 0) base.push(['width', normalizeInt(entity.width, 0)]);
    if (normalizeInt(entity.height, 0) !== 0) base.push(['height', normalizeInt(entity.height, 0)]);

    const custom = Object.entries(entity.attributes || {});
    this.writeByte(base.length + custom.length);

    for (const [key, value] of base) this.writeValue(key, value);
    for (const [key, value] of custom) this.writeValue(key, value);

    const nodes = Array.isArray(entity.nodes) ? entity.nodes : [];
    this.writeUInt16(nodes.length);
    for (const node of nodes) {
      this.writeLookupIndex('node');
      this.writeByte(2);
      this.writeValue('x', normalizeInt(node.x, 0));
      this.writeValue('y', normalizeInt(node.y, 0));
      this.writeUInt16(0);
    }
  }

  writeDecalsElement(name, decals) {
    this.writeLookupIndex(name);
    this.writeByte(0);
    this.writeUInt16(decals.length);

    for (const decal of decals) {
      this.writeLookupIndex('decal');

      const attributes = [
        ['texture', decal.texture || ''],
        ['x', normalizeInt(decal.x, 0)],
        ['y', normalizeInt(decal.y, 0)],
        ['scaleX', normalizeFloat(decal.scaleX, 1)],
        ['scaleY', normalizeFloat(decal.scaleY, 1)],
      ];

      if (normalizeFloat(decal.rotation, 0) !== 0) {
        attributes.push(['rotation', normalizeFloat(decal.rotation, 0)]);
      }

      if (decal.color && decal.color !== 'ffffffff') {
        attributes.push(['color', decal.color]);
      }

      this.writeByte(attributes.length);
      for (const [key, value] of attributes) this.writeValue(key, value);
      this.writeUInt16(0);
    }
  }

  writeFillerElement(fillers) {
    this.writeLookupIndex('Filler');
    this.writeByte(0);
    this.writeUInt16(fillers.length);

    for (const filler of fillers) {
      this.writeLookupIndex('rect');
      this.writeByte(4);
      this.writeValue('x', normalizeInt(filler.x, 0));
      this.writeValue('y', normalizeInt(filler.y, 0));
      this.writeValue('w', normalizeInt(filler.width, 0));
      this.writeValue('h', normalizeInt(filler.height, 0));
      this.writeUInt16(0);
    }
  }

  writeStyleElement(stylesFg, stylesBg) {
    this.writeLookupIndex('Style');
    this.writeByte(0);
    this.writeUInt16(2);
    this.writeStyleGroupElement('Foregrounds', stylesFg);
    this.writeStyleGroupElement('Backgrounds', stylesBg);
  }

  writeStyleGroupElement(name, entries) {
    this.writeLookupIndex(name);
    this.writeByte(0);
    this.writeUInt16(entries.length);

    for (const style of entries) {
      if (style.type === 'parallax') {
        this.writeLookupIndex('parallax');
        const attributes = [];

        if (style.texture) attributes.push(['texture', style.texture]);
        if (style.x !== undefined) attributes.push(['x', style.x]);
        if (style.y !== undefined) attributes.push(['y', style.y]);
        if (style.scrollX !== undefined) attributes.push(['scrollx', style.scrollX]);
        if (style.scrollY !== undefined) attributes.push(['scrolly', style.scrollY]);
        if (style.speedX) attributes.push(['speedx', style.speedX]);
        if (style.speedY) attributes.push(['speedy', style.speedY]);
        if (style.color && style.color !== 'ffffff') attributes.push(['color', style.color]);
        if (style.alpha !== undefined && style.alpha !== 1) attributes.push(['alpha', style.alpha]);
        if (style.flipX) attributes.push(['flipx', style.flipX]);
        if (style.flipY) attributes.push(['flipy', style.flipY]);
        if (style.loopX !== undefined) attributes.push(['loopx', style.loopX]);
        if (style.loopY !== undefined) attributes.push(['loopy', style.loopY]);
        if (style.blendMode && style.blendMode !== 'alphablend') attributes.push(['blendmode', style.blendMode]);
        if (style.only && style.only !== '*') attributes.push(['only', style.only]);
        if (style.exclude) attributes.push(['exclude', style.exclude]);
        if (style.flag) attributes.push(['flag', style.flag]);
        if (style.notFlag) attributes.push(['notflag', style.notFlag]);
        if (style.tag) attributes.push(['tag', style.tag]);

        this.writeByte(attributes.length);
        for (const [key, value] of attributes) this.writeValue(key, value);
        this.writeUInt16(0);
        continue;
      }

      this.writeLookupIndex(style.name || 'unknown');

      const reserved = new Set(['type', 'name', 'only', 'exclude', 'flag', 'notFlag', 'tag']);
      const attributes = [];

      if (style.only && style.only !== '*') attributes.push(['only', style.only]);
      if (style.exclude) attributes.push(['exclude', style.exclude]);
      if (style.flag) attributes.push(['flag', style.flag]);
      if (style.notFlag) attributes.push(['notflag', style.notFlag]);
      if (style.tag) attributes.push(['tag', style.tag]);

      for (const [key, value] of Object.entries(style)) {
        if (reserved.has(key)) continue;
        attributes.push([key, value]);
      }

      this.writeByte(attributes.length);
      for (const [key, value] of attributes) this.writeValue(key, value);
      this.writeUInt16(0);
    }
  }
}

function serializeMapBinary(map) {
  const writer = new BinaryWriter();
  return writer.serialize(map);
}

function normalizeEntityForBinary(entity, index) {
  return {
    name: String(entity?.name || 'unknown'),
    id: normalizeInt(entity?.id, index + 1),
    x: normalizeInt(entity?.x, 0),
    y: normalizeInt(entity?.y, 0),
    width: normalizeInt(entity?.width, 0),
    height: normalizeInt(entity?.height, 0),
    nodes: Array.isArray(entity?.nodes)
      ? entity.nodes.map((node) => ({ x: normalizeInt(node?.x, 0), y: normalizeInt(node?.y, 0) }))
      : [],
    attributes: (entity && typeof entity.attributes === 'object' && !Array.isArray(entity.attributes))
      ? { ...entity.attributes }
      : {},
  };
}

function normalizeDecalForBinary(decal) {
  return {
    texture: String(decal?.texture || ''),
    x: normalizeInt(decal?.x, 0),
    y: normalizeInt(decal?.y, 0),
    scaleX: normalizeFloat(decal?.scaleX, 1),
    scaleY: normalizeFloat(decal?.scaleY, 1),
    rotation: normalizeFloat(decal?.rotation, 0),
    color: typeof decal?.color === 'string' ? decal.color : 'ffffffff',
  };
}

function normalizeRoomForBinary(room, index) {
  const width = Math.max(8, normalizeInt(room?.width, 320));
  const height = Math.max(8, normalizeInt(room?.height, 184));
  const tileWidth = Math.max(1, normalizeInt(room?.tileWidth, Math.floor(width / 8)));
  const tileHeight = Math.max(1, normalizeInt(room?.tileHeight, Math.floor(height / 8)));

  const tilesFg = rowsToFlatCharGrid(room?.tilesFg || room?.solids, tileWidth, tileHeight);
  const tilesBg = rowsToFlatCharGrid(room?.tilesBg || room?.bg, tileWidth, tileHeight);
  const fgTiles = normalizeObjectGrid(room?.fgTiles, tileWidth, tileHeight);
  const objTiles = normalizeObjectGrid(room?.objTiles || room?.objtiles, tileWidth, tileHeight);
  const bgTiles = normalizeObjectGrid(room?.bgTiles || room?.bgtiles, tileWidth, tileHeight);

  return {
    name: String(room?.name || room?.id || `room_${index}`),
    x: normalizeInt(room?.x ?? room?.xoffset, 0),
    y: normalizeInt(room?.y ?? room?.yoffset, 0),
    width,
    height,
    tileWidth,
    tileHeight,
    music: String(room?.music || ''),
    musicLayer1: normalizeBool(room?.musicLayer1, true),
    musicLayer2: normalizeBool(room?.musicLayer2, true),
    musicLayer3: normalizeBool(room?.musicLayer3, true),
    musicLayer4: normalizeBool(room?.musicLayer4, true),
    altMusic: String(room?.altMusic || room?.alt_music || ''),
    ambience: String(room?.ambience || ''),
    dark: normalizeBool(room?.dark, false),
    underwater: normalizeBool(room?.underwater, false),
    space: normalizeBool(room?.space, false),
    disableDownTransition: normalizeBool(room?.disableDownTransition, false),
    cameraOffsetX: normalizeInt(room?.cameraOffsetX, 0),
    cameraOffsetY: normalizeInt(room?.cameraOffsetY, 0),
    windPattern: String(room?.windPattern || room?.wind || 'None'),
    color: normalizeInt(room?.color ?? room?.c, 0),
    musicProgress: String(room?.musicProgress || room?.music_progress || ''),
    ambienceProgress: String(room?.ambienceProgress || room?.ambience_progress || ''),
    delayAltMusicFade: normalizeBool(room?.delayAltMusicFade ?? room?.delay_alt_music_fade, false),
    whisper: normalizeBool(room?.whisper, false),
    tilesFg,
    tilesBg,
    fgTiles,
    objTiles,
    bgTiles,
    entities: Array.isArray(room?.entities)
      ? room.entities.map((entity, entityIndex) => normalizeEntityForBinary(entity, entityIndex))
      : [],
    triggers: Array.isArray(room?.triggers)
      ? room.triggers.map((trigger, triggerIndex) => normalizeEntityForBinary(trigger, triggerIndex))
      : [],
    decalsFg: Array.isArray(room?.decalsFg)
      ? room.decalsFg.map((decal) => normalizeDecalForBinary(decal))
      : [],
    decalsBg: Array.isArray(room?.decalsBg)
      ? room.decalsBg.map((decal) => normalizeDecalForBinary(decal))
      : [],
  };
}

function createBinaryMapFromEditor(editorMap, packageNameFallback) {
  const map = editorMap && typeof editorMap === 'object' ? editorMap : {};
  const roomsInput = Array.isArray(map.rooms)
    ? map.rooms
    : (Array.isArray(map.levels) ? map.levels : []);

  const packageName = String(
    map.packageName ||
    map.package ||
    packageNameFallback ||
    'newmap'
  ).trim();

  return {
    packageName: packageName || 'newmap',
    rooms: roomsInput.map((room, index) => normalizeRoomForBinary(room, index)),
    fillers: Array.isArray(map.fillers)
      ? map.fillers.map((filler) => ({
          x: normalizeInt(filler?.x, 0),
          y: normalizeInt(filler?.y, 0),
          width: normalizeInt(filler?.width, 0),
          height: normalizeInt(filler?.height, 0),
        }))
      : [],
    stylesFg: Array.isArray(map.stylesFg) ? map.stylesFg.map((entry) => ({ ...entry })) : [],
    stylesBg: Array.isArray(map.stylesBg) ? map.stylesBg.map((entry) => ({ ...entry })) : [],
  };
}

function normalizeRoomForEditor(room) {
  const width = normalizeInt(room.width, 320);
  const height = normalizeInt(room.height, 184);
  const tileWidth = Math.max(1, normalizeInt(room.tileWidth, Math.floor(width / 8)));
  const tileHeight = Math.max(1, normalizeInt(room.tileHeight, Math.floor(height / 8)));

  return {
    name: room.name,
    x: room.x,
    y: room.y,
    width,
    height,
    tileWidth,
    tileHeight,
    music: room.music,
    musicLayer1: room.musicLayer1,
    musicLayer2: room.musicLayer2,
    musicLayer3: room.musicLayer3,
    musicLayer4: room.musicLayer4,
    altMusic: room.altMusic,
    ambience: room.ambience,
    dark: room.dark,
    underwater: room.underwater,
    space: room.space,
    disableDownTransition: room.disableDownTransition,
    cameraOffsetX: room.cameraOffsetX,
    cameraOffsetY: room.cameraOffsetY,
    wind: room.windPattern === 'None' ? '' : room.windPattern,
    windPattern: room.windPattern,
    color: room.color,
    musicProgress: room.musicProgress,
    ambienceProgress: room.ambienceProgress,
    delayAltMusicFade: room.delayAltMusicFade,
    whisper: room.whisper,
    tilesFg: flatTilesToRows(room.tilesFg, tileWidth, tileHeight),
    tilesBg: flatTilesToRows(room.tilesBg, tileWidth, tileHeight),
    fgTiles: room.fgTiles || null,
    objTiles: room.objTiles || null,
    bgTiles: room.bgTiles || null,
    entities: Array.isArray(room.entities) ? room.entities.map((entity) => ({ ...entity })) : [],
    triggers: Array.isArray(room.triggers) ? room.triggers.map((trigger) => ({ ...trigger })) : [],
    decalsFg: Array.isArray(room.decalsFg) ? room.decalsFg.map((decal) => ({ ...decal })) : [],
    decalsBg: Array.isArray(room.decalsBg) ? room.decalsBg.map((decal) => ({ ...decal })) : [],
  };
}

function createEditorMapFromBinary(binaryMap) {
  return {
    packageName: binaryMap.packageName || 'newmap',
    rooms: Array.isArray(binaryMap.rooms)
      ? binaryMap.rooms.map((room) => normalizeRoomForEditor(room))
      : [],
    fillers: Array.isArray(binaryMap.fillers) ? binaryMap.fillers.map((filler) => ({ ...filler })) : [],
    stylesFg: Array.isArray(binaryMap.stylesFg) ? binaryMap.stylesFg.map((entry) => ({ ...entry })) : [],
    stylesBg: Array.isArray(binaryMap.stylesBg) ? binaryMap.stylesBg.map((entry) => ({ ...entry })) : [],
  };
}

module.exports = {
  parseMapBinary,
  serializeMapBinary,
  createEditorMapFromBinary,
  createBinaryMapFromEditor,
};
