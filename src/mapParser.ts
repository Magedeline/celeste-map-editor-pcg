/**
 * Celeste Map Binary (.bin) Parser
 * 
 * Reads the Celeste map binary format and produces a CelesteMap object.
 * 
 * Binary format (from Lönn source):
 * - Header: "CELESTE MAP" (7-bit length-prefixed string)
 * - Package name (7-bit length-prefixed string)
 * - Lookup table count (signed int16)
 * - Lookup strings (7-bit length-prefixed strings)
 * - Element tree (recursive structure)
 * 
 * Value types: 0=bool, 1=byte, 2=int16, 3=int32, 4=float32,
 *              5=lookup string, 6=raw string, 7=RLE string
 */

import {
    BinaryElement,
    CelesteMap,
    Room,
    TileGrid,
    ObjectTileGrid,
    Entity,
    EntityNode,
    Decal,
    Filler,
    StyleEntry,
} from './types';

// ─── Binary Reader ─────────────────────────────────────────────────────────────

class BinaryReader {
    private data: DataView;
    private uint8: Uint8Array;
    private pos: number = 0;
    public lookup: string[] = [];

    constructor(buffer: ArrayBuffer) {
        this.data = new DataView(buffer);
        this.uint8 = new Uint8Array(buffer);
    }

    get position(): number {
        return this.pos;
    }

    get length(): number {
        return this.data.byteLength;
    }

    readByte(): number {
        const val = this.uint8[this.pos];
        this.pos += 1;
        return val;
    }

    readBytes(n: number): Uint8Array {
        const slice = this.uint8.slice(this.pos, this.pos + n);
        this.pos += n;
        return slice;
    }

    readBool(): boolean {
        return this.readByte() !== 0;
    }

    readUInt16(): number {
        const val = this.data.getUint16(this.pos, true); // little-endian
        this.pos += 2;
        return val;
    }

    readInt16(): number {
        const val = this.data.getInt16(this.pos, true);
        this.pos += 2;
        return val;
    }

    readInt32(): number {
        const val = this.data.getInt32(this.pos, true);
        this.pos += 4;
        return val;
    }

    readFloat32(): number {
        const val = this.data.getFloat32(this.pos, true);
        this.pos += 4;
        return val;
    }

    /** Read a 7-bit encoded variable-length integer (.NET BinaryReader style) */
    read7BitInt(): number {
        let result = 0;
        let shift = 0;
        while (true) {
            const b = this.uint8[this.pos];
            this.pos += 1;
            result |= (b & 0x7F) << shift;
            if ((b & 0x80) === 0) {
                break;
            }
            shift += 7;
        }
        return result;
    }

    /** Read a variable-length string (7-bit int length prefix, then UTF-8 bytes) */
    readString(): string {
        const length = this.read7BitInt();
        if (length === 0) {
            return '';
        }
        const bytes = this.readBytes(length);
        return new TextDecoder('utf-8').decode(bytes);
    }

    /** Read a lookup table string (uint16 index) */
    readLookupString(): string {
        const idx = this.readUInt16();
        if (idx < this.lookup.length) {
            return this.lookup[idx];
        }
        return `?${idx}`;
    }

    /** Read a run-length encoded string (used for tile data in Celeste) */
    readRLE(): string {
        const byteCount = this.readInt16();

        if (byteCount < 0) {
            // Negative means raw string of -byteCount length
            const bytes = this.readBytes(-byteCount);
            return new TextDecoder('utf-8').decode(bytes);
        }

        // Positive: RLE encoded as (count, char) pairs
        const parts: string[] = [];
        let bytesRead = 0;
        while (bytesRead < byteCount) {
            const times = this.readByte();
            const char = String.fromCharCode(this.readByte());
            parts.push(char.repeat(times));
            bytesRead += 2;
        }
        return parts.join('');
    }

    /** Read a typed value based on the type byte */
    readValue(): any {
        const type = this.readByte();
        switch (type) {
            case 0: return this.readBool();
            case 1: return this.readByte();
            case 2: return this.readInt16();
            case 3: return this.readInt32();
            case 4: return this.readFloat32();
            case 5: return this.readLookupString();
            case 6: return this.readString();
            case 7: return this.readRLE();
            default:
                throw new Error(`Unknown value type ${type} at position ${this.pos - 1}`);
        }
    }

    /** Parse a binary element node recursively */
    parseElement(depth: number = 0, maxDepth: number = 200): BinaryElement {
        if (depth > maxDepth) {
            return { __name: 'DEPTH_LIMIT', __children: [] };
        }

        const name = this.readLookupString();
        const element: BinaryElement = { __name: name, __children: [] };

        // Read attributes
        const attrCount = this.readByte();
        for (let i = 0; i < attrCount; i++) {
            const key = this.readLookupString();
            const value = this.readValue();
            element[key] = value;
        }

        // Read children
        const childCount = this.readUInt16();
        for (let i = 0; i < childCount; i++) {
            element.__children.push(this.parseElement(depth + 1, maxDepth));
        }

        return element;
    }
}

// ─── Map Parser ────────────────────────────────────────────────────────────────

/**
 * Parse a Celeste .bin map file buffer into a CelesteMap object.
 */
export function parseMapBinary(buffer: ArrayBuffer): CelesteMap {
    const reader = new BinaryReader(buffer);

    // Read and validate header
    const header = reader.readString();
    if (header !== 'CELESTE MAP') {
        throw new Error(`Invalid map header: expected 'CELESTE MAP', got '${header}'`);
    }

    // Read package name
    const packageName = reader.readString();

    // Read lookup table
    const lookupCount = reader.readInt16();
    for (let i = 0; i < lookupCount; i++) {
        reader.lookup.push(reader.readString());
    }

    // Parse the element tree
    const root = reader.parseElement();

    // Convert to structured CelesteMap
    return convertBinaryToMap(packageName, root);
}

// ─── Conversion from Binary Elements to CelesteMap ─────────────────────────────

function convertBinaryToMap(packageName: string, root: BinaryElement): CelesteMap {
    const map: CelesteMap = {
        packageName,
        rooms: [],
        fillers: [],
        stylesFg: [],
        stylesBg: [],
    };

    for (const child of root.__children) {
        switch (child.__name) {
            case 'levels':
                for (const roomEl of child.__children) {
                    map.rooms.push(convertRoom(roomEl));
                }
                break;

            case 'Filler':
                for (const fillerEl of child.__children) {
                    if (fillerEl.__name === 'rect') {
                        map.fillers.push({
                            x: fillerEl.x ?? 0,
                            y: fillerEl.y ?? 0,
                            width: fillerEl.w ?? 0,
                            height: fillerEl.h ?? 0,
                        });
                    }
                }
                break;

            case 'Style':
                for (const styleChild of child.__children) {
                    if (styleChild.__name === 'Foregrounds') {
                        map.stylesFg = convertStyles(styleChild);
                    } else if (styleChild.__name === 'Backgrounds') {
                        map.stylesBg = convertStyles(styleChild);
                    }
                }
                break;
        }
    }

    return map;
}

function convertRoom(el: BinaryElement): Room {
    const pixelW = el.width ?? 320;
    const pixelH = el.height ?? 184;
    const tileW = Math.floor(pixelW / 8);
    const tileH = Math.floor(pixelH / 8);

    const room: Room = {
        name: el.name ?? 'unnamed',
        x: el.x ?? 0,
        y: el.y ?? 0,
        width: pixelW,
        height: pixelH,
        tileWidth: tileW,
        tileHeight: tileH,

        music: el.music ?? '',
        musicLayer1: el.musicLayer1 ?? true,
        musicLayer2: el.musicLayer2 ?? true,
        musicLayer3: el.musicLayer3 ?? true,
        musicLayer4: el.musicLayer4 ?? true,
        altMusic: el.altMusic ?? '',
        ambience: el.ambience ?? '',

        dark: el.dark ?? false,
        underwater: el.underwater ?? false,
        space: el.space ?? false,
        disableDownTransition: el.disableDownTransition ?? false,
        cameraOffsetX: el.cameraOffsetX ?? 0,
        cameraOffsetY: el.cameraOffsetY ?? 0,
        windPattern: el.windPattern ?? 'None',
        color: el.color ?? 0,

        tilesFg: null,
        tilesBg: null,
        objTiles: null,
        entities: [],
        triggers: [],
        decalsFg: [],
        decalsBg: [],
    };

    for (const child of el.__children) {
        switch (child.__name) {
            case 'solids':
                room.tilesFg = convertTiles(child, tileW, tileH);
                break;
            case 'bg':
                room.tilesBg = convertTiles(child, tileW, tileH);
                break;
            case 'objtiles':
                room.objTiles = convertObjectTiles(child);
                break;
            case 'entities':
                for (const ent of child.__children) {
                    room.entities.push(convertEntity(ent));
                }
                break;
            case 'triggers':
                for (const trig of child.__children) {
                    room.triggers.push(convertEntity(trig));
                }
                break;
            case 'fgdecals':
                for (const dec of child.__children) {
                    room.decalsFg.push(convertDecal(dec));
                }
                break;
            case 'bgdecals':
                for (const dec of child.__children) {
                    room.decalsBg.push(convertDecal(dec));
                }
                break;
        }
    }

    return room;
}

function convertTiles(el: BinaryElement, width: number, height: number): TileGrid {
    const innerText: string = el.innerText ?? '';
    const rows = parseTileString(innerText, width, height);

    const tiles: string[] = [];
    for (const row of rows) {
        for (let i = 0; i < width; i++) {
            tiles.push(i < row.length ? row[i] : '0');
        }
    }

    return { width, height, tiles };
}

function parseTileString(tileStr: string, width: number, height: number): string[] {
    if (!tileStr) {
        return Array.from({ length: height }, () => '0'.repeat(width));
    }
    const rows = tileStr.split('\n').filter(r => r.length > 0);
    while (rows.length < height) {
        rows.push('0'.repeat(width));
    }
    return rows.slice(0, height);
}

function convertObjectTiles(el: BinaryElement): ObjectTileGrid {
    const innerText: string = el.innerText ?? '';
    const rows = innerText ? innerText.split('\n').filter(r => r.length > 0) : [];

    let width = 0;
    const height = rows.length;
    const tiles: number[] = [];

    for (const row of rows) {
        const values = row.split(',');
        width = Math.max(width, values.length);
        for (const v of values) {
            const trimmed = v.trim();
            tiles.push(trimmed ? parseInt(trimmed, 10) : -1);
        }
    }

    return { width, height, tiles };
}

function convertEntity(el: BinaryElement): Entity {
    const entity: Entity = {
        name: el.__name ?? 'unknown',
        id: el.id ?? 0,
        x: el.x ?? 0,
        y: el.y ?? 0,
        width: el.width ?? 0,
        height: el.height ?? 0,
        nodes: [],
        attributes: {},
    };

    // Extract nodes from children
    for (const child of el.__children) {
        if (child.__name === 'node') {
            entity.nodes.push({ x: child.x ?? 0, y: child.y ?? 0 });
        }
    }

    // Extract other attributes
    const skipKeys = new Set(['__name', '__children', 'id', 'x', 'y', 'width', 'height']);
    for (const [key, value] of Object.entries(el)) {
        if (!skipKeys.has(key)) {
            entity.attributes[key] = value;
        }
    }

    return entity;
}

function convertDecal(el: BinaryElement): Decal {
    let texture: string = el.texture ?? '';
    texture = texture.replace(/\\/g, '/');
    if (texture.toLowerCase().endsWith('.png')) {
        texture = texture.slice(0, -4);
    }
    if (!texture.startsWith('decals/')) {
        texture = 'decals/' + texture;
    }

    return {
        texture,
        x: el.x ?? 0,
        y: el.y ?? 0,
        scaleX: el.scaleX ?? 1.0,
        scaleY: el.scaleY ?? 1.0,
        rotation: el.rotation ?? 0,
        color: el.color ?? 'ffffffff',
    };
}

function convertStyles(el: BinaryElement): StyleEntry[] {
    const styles: StyleEntry[] = [];

    for (const child of el.__children) {
        if (child.__name === 'parallax') {
            const style: StyleEntry = {
                type: 'parallax',
                texture: child.texture ?? '',
                x: child.x ?? 0,
                y: child.y ?? 0,
                scrollX: child.scrollx ?? 1.0,
                scrollY: child.scrolly ?? 1.0,
                speedX: child.speedx ?? 0,
                speedY: child.speedy ?? 0,
                color: child.color ?? 'ffffff',
                alpha: child.alpha ?? 1.0,
                flipX: child.flipx ?? false,
                flipY: child.flipy ?? false,
                loopX: child.loopx ?? true,
                loopY: child.loopy ?? true,
                blendMode: child.blendmode ?? 'alphablend',
                only: child.only ?? '*',
                exclude: child.exclude ?? '',
                flag: child.flag ?? '',
                notFlag: child.notflag ?? '',
                tag: child.tag ?? '',
            };
            styles.push(style);
        } else if (child.__name === 'apply') {
            // Apply containers have nested styles that inherit properties
            const nested = convertStyles(child);
            for (const s of nested) {
                for (const [key, value] of Object.entries(child)) {
                    if (!key.startsWith('__') && !(key in s)) {
                        s[key] = value;
                    }
                }
                styles.push(s);
            }
        } else {
            // Effects
            const style: StyleEntry = {
                type: 'effect',
                name: child.__name,
                only: child.only ?? '*',
                exclude: child.exclude ?? '',
                flag: child.flag ?? '',
                notFlag: child.notflag ?? '',
                tag: child.tag ?? '',
            };
            const skip = new Set(['__name', '__children', 'only', 'exclude', 'flag', 'notflag', 'tag']);
            for (const [key, value] of Object.entries(child)) {
                if (!skip.has(key)) {
                    style[key] = value;
                }
            }
            styles.push(style);
        }
    }

    return styles;
}

// ─── Factory for creating empty maps ───────────────────────────────────────────

/**
 * Create a new empty Celeste map.
 */
export function createEmptyMap(packageName: string = 'newmap'): CelesteMap {
    return {
        packageName,
        rooms: [createEmptyRoom('lvl_00', 0, 0, 320, 184)],
        fillers: [],
        stylesFg: [],
        stylesBg: [],
    };
}

/**
 * Create a new empty room.
 */
export function createEmptyRoom(
    name: string,
    x: number,
    y: number,
    width: number = 320,
    height: number = 184,
): Room {
    const tileW = Math.floor(width / 8);
    const tileH = Math.floor(height / 8);

    return {
        name,
        x,
        y,
        width,
        height,
        tileWidth: tileW,
        tileHeight: tileH,

        music: '',
        musicLayer1: true,
        musicLayer2: true,
        musicLayer3: true,
        musicLayer4: true,
        altMusic: '',
        ambience: '',

        dark: false,
        underwater: false,
        space: false,
        disableDownTransition: false,
        cameraOffsetX: 0,
        cameraOffsetY: 0,
        windPattern: 'None',
        color: 0,

        tilesFg: {
            width: tileW,
            height: tileH,
            tiles: new Array(tileW * tileH).fill('0'),
        },
        tilesBg: {
            width: tileW,
            height: tileH,
            tiles: new Array(tileW * tileH).fill('0'),
        },
        objTiles: null,

        entities: [],
        triggers: [],
        decalsFg: [],
        decalsBg: [],
    };
}
