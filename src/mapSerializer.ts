/**
 * Celeste Map Binary (.bin) Serializer
 * 
 * Converts a CelesteMap object back to the binary .bin format
 * that Celeste and Everest can load.
 */

import {
    CelesteMap,
    Room,
    TileGrid,
    ObjectTileGrid,
    Entity,
    Decal,
    Filler,
    StyleEntry,
} from './types';

// ─── Binary Writer ─────────────────────────────────────────────────────────────

class BinaryWriter {
    private chunks: Uint8Array[] = [];
    private lookup: Map<string, number> = new Map();
    private lookupList: string[] = [];

    /**
     * Build the lookup table by scanning the map for all string keys/values.
     */
    buildLookup(map: CelesteMap): void {
        this.lookup.clear();
        this.lookupList = [];

        const addString = (s: string) => {
            if (!this.lookup.has(s)) {
                this.lookup.set(s, this.lookupList.length);
                this.lookupList.push(s);
            }
        };

        // Element names
        addString('Map');
        addString('levels');
        addString('level');
        addString('solids');
        addString('bg');
        addString('objtiles');
        addString('entities');
        addString('triggers');
        addString('fgdecals');
        addString('bgdecals');
        addString('Filler');
        addString('rect');
        addString('Style');
        addString('Foregrounds');
        addString('Backgrounds');
        addString('parallax');
        addString('apply');
        addString('node');

        // Common attribute keys
        const commonKeys = [
            'name', 'x', 'y', 'width', 'height', 'w', 'h',
            'music', 'musicLayer1', 'musicLayer2', 'musicLayer3', 'musicLayer4',
            'altMusic', 'ambience', 'dark', 'underwater', 'space',
            'disableDownTransition', 'cameraOffsetX', 'cameraOffsetY',
            'windPattern', 'color', 'innerText',
            'id', 'texture', 'scaleX', 'scaleY', 'rotation',
            'scrollx', 'scrolly', 'speedx', 'speedy',
            'alpha', 'flipx', 'flipy', 'loopx', 'loopy',
            'blendmode', 'only', 'exclude', 'flag', 'notflag', 'tag',
        ];
        for (const k of commonKeys) {
            addString(k);
        }

        // Scan rooms for entity/trigger names and attribute keys
        for (const room of map.rooms) {
            addString(room.name);
            addString(room.music);
            addString(room.altMusic);
            addString(room.ambience);
            addString(room.windPattern);

            for (const entity of [...room.entities, ...room.triggers]) {
                addString(entity.name);
                for (const key of Object.keys(entity.attributes)) {
                    addString(key);
                    const val = entity.attributes[key];
                    if (typeof val === 'string') {
                        addString(val);
                    }
                }
            }

            for (const decal of [...room.decalsFg, ...room.decalsBg]) {
                addString(decal.texture);
                addString(decal.color);
            }
        }

        // Scan styles
        for (const style of [...map.stylesFg, ...map.stylesBg]) {
            if (style.name) { addString(style.name); }
            if (style.texture) { addString(style.texture); }
            for (const [key, value] of Object.entries(style)) {
                addString(key);
                if (typeof value === 'string') {
                    addString(value);
                }
            }
        }
    }

    // ─── Low-level write methods ───────────────────────────────────────

    private writeByte(val: number): void {
        this.chunks.push(new Uint8Array([val & 0xFF]));
    }

    private writeBytes(bytes: Uint8Array): void {
        this.chunks.push(bytes);
    }

    private writeBool(val: boolean): void {
        this.writeByte(val ? 1 : 0);
    }

    private writeUInt16(val: number): void {
        const buf = new ArrayBuffer(2);
        new DataView(buf).setUint16(0, val, true);
        this.chunks.push(new Uint8Array(buf));
    }

    private writeInt16(val: number): void {
        const buf = new ArrayBuffer(2);
        new DataView(buf).setInt16(0, val, true);
        this.chunks.push(new Uint8Array(buf));
    }

    private writeInt32(val: number): void {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setInt32(0, val, true);
        this.chunks.push(new Uint8Array(buf));
    }

    private writeFloat32(val: number): void {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, val, true);
        this.chunks.push(new Uint8Array(buf));
    }

    private write7BitInt(val: number): void {
        let v = val;
        while (v >= 0x80) {
            this.writeByte((v & 0x7F) | 0x80);
            v >>= 7;
        }
        this.writeByte(v & 0x7F);
    }

    private writeString(s: string): void {
        const encoded = new TextEncoder().encode(s);
        this.write7BitInt(encoded.length);
        this.writeBytes(encoded);
    }

    private writeLookupIndex(s: string): void {
        const idx = this.lookup.get(s);
        if (idx === undefined) {
            throw new Error(`String not in lookup table: '${s}'`);
        }
        this.writeUInt16(idx);
    }

    /**
     * Write a typed value. Determines the best type automatically.
     */
    private writeValue(key: string, value: any): void {
        this.writeLookupIndex(key);

        if (typeof value === 'boolean') {
            this.writeByte(0); // type = bool
            this.writeBool(value);
        } else if (typeof value === 'number') {
            if (Number.isInteger(value)) {
                if (value >= 0 && value <= 255) {
                    this.writeByte(1); // type = byte
                    this.writeByte(value);
                } else if (value >= -32768 && value <= 32767) {
                    this.writeByte(2); // type = int16
                    this.writeInt16(value);
                } else {
                    this.writeByte(3); // type = int32
                    this.writeInt32(value);
                }
            } else {
                this.writeByte(4); // type = float32
                this.writeFloat32(value);
            }
        } else if (typeof value === 'string') {
            // Check if the string is in the lookup table
            if (this.lookup.has(value)) {
                this.writeByte(5); // type = lookup string
                this.writeLookupIndex(value);
            } else {
                this.writeByte(6); // type = raw string
                this.writeString(value);
            }
        } else {
            // Fallback: serialize as string
            this.writeByte(6);
            this.writeString(String(value));
        }
    }

    /**
     * Write the RLE-encoded tile data value.
     */
    private writeRLEValue(key: string, tileString: string): void {
        this.writeLookupIndex(key);
        this.writeByte(7); // type = RLE

        // RLE encode: pairs of (count, char)
        const rleChunks: number[] = [];
        let i = 0;
        while (i < tileString.length) {
            const char = tileString[i];
            let count = 1;
            while (i + count < tileString.length && tileString[i + count] === char && count < 255) {
                count++;
            }
            rleChunks.push(count, char.charCodeAt(0));
            i += count;
        }

        this.writeInt16(rleChunks.length);
        for (const b of rleChunks) {
            this.writeByte(b);
        }
    }

    // ─── Element Serialization ─────────────────────────────────────────

    /**
     * Serialize the entire map to a binary buffer.
     */
    serialize(map: CelesteMap): ArrayBuffer {
        this.chunks = [];
        this.buildLookup(map);

        // Header
        this.writeString('CELESTE MAP');

        // Package name
        this.writeString(map.packageName);

        // Lookup table
        this.writeInt16(this.lookupList.length);
        for (const s of this.lookupList) {
            this.writeString(s);
        }

        // Root element
        this.writeMapElement(map);

        // Concatenate all chunks
        const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of this.chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result.buffer;
    }

    private writeMapElement(map: CelesteMap): void {
        // Element name
        this.writeLookupIndex('Map');

        // Attributes (none for root Map element)
        this.writeByte(0);

        // Count children: levels + (Filler if any) + Style
        let childCount = 1; // levels
        if (map.fillers.length > 0) { childCount++; }
        childCount++; // Style
        this.writeUInt16(childCount);

        // levels element
        this.writeLevelsElement(map.rooms);

        // Filler element
        if (map.fillers.length > 0) {
            this.writeFillerElement(map.fillers);
        }

        // Style element
        this.writeStyleElement(map.stylesFg, map.stylesBg);
    }

    private writeLevelsElement(rooms: Room[]): void {
        this.writeLookupIndex('levels');
        this.writeByte(0); // no attributes
        this.writeUInt16(rooms.length);

        for (const room of rooms) {
            this.writeRoomElement(room);
        }
    }

    private writeRoomElement(room: Room): void {
        this.writeLookupIndex('level');

        // Count attributes
        const attrs: [string, any][] = [
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

        this.writeByte(attrs.length);
        for (const [key, value] of attrs) {
            this.writeValue(key, value);
        }

        // Children: solids, bg, objtiles, entities, triggers, fgdecals, bgdecals
        let childCount = 0;
        if (room.tilesFg) { childCount++; }
        if (room.tilesBg) { childCount++; }
        if (room.objTiles) { childCount++; }
        childCount += 4; // entities, triggers, fgdecals, bgdecals always present
        this.writeUInt16(childCount);

        // Solids (foreground tiles)
        if (room.tilesFg) {
            this.writeTilesElement('solids', room.tilesFg);
        }

        // Background tiles
        if (room.tilesBg) {
            this.writeTilesElement('bg', room.tilesBg);
        }

        // Object tiles
        if (room.objTiles) {
            this.writeObjectTilesElement(room.objTiles);
        }

        // Entities
        this.writeEntitiesElement('entities', room.entities);

        // Triggers
        this.writeEntitiesElement('triggers', room.triggers);

        // Foreground decals
        this.writeDecalsElement('fgdecals', room.decalsFg);

        // Background decals
        this.writeDecalsElement('bgdecals', room.decalsBg);
    }

    private writeTilesElement(name: string, grid: TileGrid): void {
        this.writeLookupIndex(name);

        // Convert tile array back to newline-separated string
        const rows: string[] = [];
        for (let y = 0; y < grid.height; y++) {
            let row = '';
            for (let x = 0; x < grid.width; x++) {
                row += grid.tiles[y * grid.width + x] || '0';
            }
            rows.push(row);
        }
        const tileString = rows.join('\n');

        // One attribute: innerText (RLE encoded)
        this.writeByte(1);
        this.writeRLEValue('innerText', tileString);

        // No children
        this.writeUInt16(0);
    }

    private writeObjectTilesElement(grid: ObjectTileGrid): void {
        this.writeLookupIndex('objtiles');

        // Convert to comma-separated rows
        const rows: string[] = [];
        for (let y = 0; y < grid.height; y++) {
            const values: string[] = [];
            for (let x = 0; x < grid.width; x++) {
                values.push(String(grid.tiles[y * grid.width + x] ?? -1));
            }
            rows.push(values.join(','));
        }
        const innerText = rows.join('\n');

        this.writeByte(1);
        this.writeRLEValue('innerText', innerText);
        this.writeUInt16(0);
    }

    private writeEntitiesElement(name: string, entities: Entity[]): void {
        this.writeLookupIndex(name);
        this.writeByte(0); // no attributes
        this.writeUInt16(entities.length);

        for (const entity of entities) {
            this.writeEntityElement(entity);
        }
    }

    private writeEntityElement(entity: Entity): void {
        this.writeLookupIndex(entity.name);

        // Base attributes + custom attributes
        const baseAttrs: [string, any][] = [
            ['id', entity.id],
            ['x', entity.x],
            ['y', entity.y],
        ];
        if (entity.width !== 0) {
            baseAttrs.push(['width', entity.width]);
        }
        if (entity.height !== 0) {
            baseAttrs.push(['height', entity.height]);
        }

        const customAttrs = Object.entries(entity.attributes);
        const totalAttrs = baseAttrs.length + customAttrs.length;

        this.writeByte(totalAttrs);
        for (const [key, value] of baseAttrs) {
            this.writeValue(key, value);
        }
        for (const [key, value] of customAttrs) {
            this.writeValue(key, value);
        }

        // Nodes as children
        this.writeUInt16(entity.nodes.length);
        for (const node of entity.nodes) {
            this.writeLookupIndex('node');
            this.writeByte(2); // x, y attributes
            this.writeValue('x', node.x);
            this.writeValue('y', node.y);
            this.writeUInt16(0); // no children
        }
    }

    private writeDecalsElement(name: string, decals: Decal[]): void {
        this.writeLookupIndex(name);
        this.writeByte(0); // no attributes
        this.writeUInt16(decals.length);

        for (const decal of decals) {
            this.writeLookupIndex('decal');
            const attrs: [string, any][] = [
                ['texture', decal.texture],
                ['x', decal.x],
                ['y', decal.y],
                ['scaleX', decal.scaleX],
                ['scaleY', decal.scaleY],
            ];
            if (decal.rotation !== 0) {
                attrs.push(['rotation', decal.rotation]);
            }
            if (decal.color && decal.color !== 'ffffffff') {
                attrs.push(['color', decal.color]);
            }

            this.writeByte(attrs.length);
            for (const [key, value] of attrs) {
                this.writeValue(key, value);
            }
            this.writeUInt16(0); // no children
        }
    }

    private writeFillerElement(fillers: Filler[]): void {
        this.writeLookupIndex('Filler');
        this.writeByte(0); // no attributes
        this.writeUInt16(fillers.length);

        for (const filler of fillers) {
            this.writeLookupIndex('rect');
            this.writeByte(4); // x, y, w, h
            this.writeValue('x', filler.x);
            this.writeValue('y', filler.y);
            this.writeValue('w', filler.width);
            this.writeValue('h', filler.height);
            this.writeUInt16(0);
        }
    }

    private writeStyleElement(fg: StyleEntry[], bg: StyleEntry[]): void {
        this.writeLookupIndex('Style');
        this.writeByte(0);

        let childCount = 0;
        if (fg.length > 0 || true) { childCount++; } // Always write Foregrounds
        if (bg.length > 0 || true) { childCount++; } // Always write Backgrounds
        this.writeUInt16(childCount);

        // Foregrounds
        this.writeStyleGroupElement('Foregrounds', fg);

        // Backgrounds
        this.writeStyleGroupElement('Backgrounds', bg);
    }

    private writeStyleGroupElement(name: string, styles: StyleEntry[]): void {
        this.writeLookupIndex(name);
        this.writeByte(0);
        this.writeUInt16(styles.length);

        for (const style of styles) {
            if (style.type === 'parallax') {
                this.writeLookupIndex('parallax');
                const attrs: [string, any][] = [];
                if (style.texture) { attrs.push(['texture', style.texture]); }
                if (style.x !== undefined) { attrs.push(['x', style.x]); }
                if (style.y !== undefined) { attrs.push(['y', style.y]); }
                if (style.scrollX !== undefined) { attrs.push(['scrollx', style.scrollX]); }
                if (style.scrollY !== undefined) { attrs.push(['scrolly', style.scrollY]); }
                if (style.speedX) { attrs.push(['speedx', style.speedX]); }
                if (style.speedY) { attrs.push(['speedy', style.speedY]); }
                if (style.color && style.color !== 'ffffff') { attrs.push(['color', style.color]); }
                if (style.alpha !== undefined && style.alpha !== 1.0) { attrs.push(['alpha', style.alpha]); }
                if (style.flipX) { attrs.push(['flipx', style.flipX]); }
                if (style.flipY) { attrs.push(['flipy', style.flipY]); }
                if (style.loopX !== undefined) { attrs.push(['loopx', style.loopX]); }
                if (style.loopY !== undefined) { attrs.push(['loopy', style.loopY]); }
                if (style.blendMode && style.blendMode !== 'alphablend') { attrs.push(['blendmode', style.blendMode]); }
                if (style.only && style.only !== '*') { attrs.push(['only', style.only]); }
                if (style.exclude) { attrs.push(['exclude', style.exclude]); }
                if (style.flag) { attrs.push(['flag', style.flag]); }
                if (style.notFlag) { attrs.push(['notflag', style.notFlag]); }
                if (style.tag) { attrs.push(['tag', style.tag]); }

                this.writeByte(attrs.length);
                for (const [key, value] of attrs) {
                    this.writeValue(key, value);
                }
                this.writeUInt16(0);
            } else {
                // Effect
                this.writeLookupIndex(style.name ?? 'unknown');
                const skipKeys = new Set(['type', 'name', 'only', 'exclude', 'flag', 'notFlag', 'tag']);
                const attrs: [string, any][] = [];
                if (style.only && style.only !== '*') { attrs.push(['only', style.only]); }
                if (style.exclude) { attrs.push(['exclude', style.exclude]); }
                if (style.flag) { attrs.push(['flag', style.flag]); }
                if (style.notFlag) { attrs.push(['notflag', style.notFlag]); }
                if (style.tag) { attrs.push(['tag', style.tag]); }

                for (const [key, value] of Object.entries(style)) {
                    if (!skipKeys.has(key)) {
                        attrs.push([key, value]);
                    }
                }

                this.writeByte(attrs.length);
                for (const [key, value] of attrs) {
                    this.writeValue(key, value);
                }
                this.writeUInt16(0);
            }
        }
    }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Serialize a CelesteMap to binary .bin format.
 */
export function serializeMapBinary(map: CelesteMap): ArrayBuffer {
    const writer = new BinaryWriter();
    return writer.serialize(map);
}

/**
 * Export a CelesteMap to JSON format (for debugging/interoperability).
 */
export function serializeMapJson(map: CelesteMap): string {
    return JSON.stringify(map, null, 2);
}
