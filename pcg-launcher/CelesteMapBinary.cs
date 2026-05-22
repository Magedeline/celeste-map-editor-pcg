using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace CelestePcgLauncher;

internal static class CelesteMapJsonConverter
{
    public static CelesteMapData ParseMap(string rawJson, string? packageNameFallback)
    {
        using var document = JsonDocument.Parse(rawJson);
        var root = document.RootElement;

        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("JSON root must be an object.");
        }

        var hasRooms = TryGetArrayProperty(root, "rooms", out var roomsElement);
        if (!hasRooms && !TryGetArrayProperty(root, "levels", out roomsElement))
        {
            throw new InvalidOperationException("JSON must contain either a rooms array or a levels array.");
        }

        var packageName = GetOptionalString(root, "packageName");
        if (string.IsNullOrWhiteSpace(packageName))
        {
            packageName = GetOptionalString(root, "package");
        }
        if (string.IsNullOrWhiteSpace(packageName))
        {
            packageName = packageNameFallback;
        }
        if (string.IsNullOrWhiteSpace(packageName))
        {
            throw new InvalidOperationException("A Celeste package name is required to build map.bin.");
        }

        return new CelesteMapData
        {
            PackageName = packageName.Trim(),
            Rooms = roomsElement.EnumerateArray().Select(ParseRoom).ToList(),
            Fillers = ParseArray(root, "fillers", ParseFiller),
            StylesFg = ParseArray(root, "stylesFg", ParseStyle),
            StylesBg = ParseArray(root, "stylesBg", ParseStyle),
            PreviewMetadata = ParsePreviewMetadata(root),
        };
    }

    private static bool TryGetArrayProperty(JsonElement element, string propertyName, out JsonElement arrayElement)
    {
        if (element.TryGetProperty(propertyName, out arrayElement) && arrayElement.ValueKind == JsonValueKind.Array)
        {
            return true;
        }

        arrayElement = default;
        return false;
    }

    private static PreviewMetadataData? ParsePreviewMetadata(JsonElement root)
    {
        if (!root.TryGetProperty("previewMetadata", out var element) || element.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return new PreviewMetadataData
        {
            LayoutMode = GetOptionalString(element, "layoutMode") ?? "grid",
            Archetype = GetOptionalString(element, "archetype") ?? "linearAscent",
            StartNodeId = GetOptionalInt(element, "startNodeId") ?? 0,
            GoalNodeId = GetOptionalInt(element, "goalNodeId") ?? 0,
            MainPathNodeIds = ParseArray(element, "mainPathNodeIds", ToInt32),
            Nodes = ParseArray(element, "nodes", ParsePreviewNode),
        };
    }

    private static PreviewNodeData ParsePreviewNode(JsonElement element)
    {
        return new PreviewNodeData
        {
            Id = GetRequiredInt(element, "id"),
            RoomName = GetRequiredString(element, "roomName"),
            Row = GetRequiredInt(element, "row"),
            Column = GetRequiredInt(element, "column"),
            Role = GetOptionalString(element, "role") ?? "path",
            Connections = ParseArray(element, "connections", ToInt32),
            Phase = GetOptionalString(element, "phase") ?? "build",
            Segment = GetOptionalInt(element, "segment") ?? 0,
        };
    }

    private static RoomData ParseRoom(JsonElement element)
    {
        var name = GetOptionalString(element, "name") ?? GetOptionalString(element, "id");
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new InvalidOperationException("Missing required room name/id value.");
        }

        var x = GetOptionalInt(element, "x") ?? GetOptionalInt(element, "xoffset");
        if (!x.HasValue)
        {
            throw new InvalidOperationException("Missing required numeric property 'x'/'xoffset'.");
        }

        var y = GetOptionalInt(element, "y") ?? GetOptionalInt(element, "yoffset");
        if (!y.HasValue)
        {
            throw new InvalidOperationException("Missing required numeric property 'y'/'yoffset'.");
        }

        var width = GetRequiredInt(element, "width");
        var height = GetRequiredInt(element, "height");
        var tileWidth = GetOptionalInt(element, "tileWidth") ?? Math.Max(1, width / 8);
        var tileHeight = GetOptionalInt(element, "tileHeight") ?? Math.Max(1, height / 8);

        var tilesFg = ParseTileGrid(element, "tilesFg", tileWidth, tileHeight)
            ?? ParseTileGridFromStringProperty(element, "solids", tileWidth, tileHeight);
        var tilesBg = ParseTileGrid(element, "tilesBg", tileWidth, tileHeight)
            ?? ParseTileGridFromStringProperty(element, "bg", tileWidth, tileHeight);
        var fgTiles = ParseObjectTileGrid(element, "fgTiles", tileWidth, tileHeight)
            ?? ParseObjectTileGridFromStringProperty(element, "fgtiles", tileWidth, tileHeight);
        var objTiles = ParseObjectTileGrid(element, "objTiles", tileWidth, tileHeight)
            ?? ParseObjectTileGridFromStringProperty(element, "objtiles", tileWidth, tileHeight);
        var bgTiles = ParseObjectTileGrid(element, "bgTiles", tileWidth, tileHeight)
            ?? ParseObjectTileGridFromStringProperty(element, "bgtiles", tileWidth, tileHeight);

        var decalsFg = ParseArray(element, "decalsFg", ParseDecal);
        if (decalsFg.Count == 0)
        {
            decalsFg = ParseArray(element, "decals", ParseDecal);
        }

        return new RoomData
        {
            Name = name,
            X = x.Value,
            Y = y.Value,
            Width = width,
            Height = height,
            TileWidth = tileWidth,
            TileHeight = tileHeight,
            Music = GetOptionalString(element, "music") ?? string.Empty,
            MusicLayer1 = GetOptionalBool(element, "musicLayer1") ?? true,
            MusicLayer2 = GetOptionalBool(element, "musicLayer2") ?? true,
            MusicLayer3 = GetOptionalBool(element, "musicLayer3") ?? true,
            MusicLayer4 = GetOptionalBool(element, "musicLayer4") ?? true,
            AltMusic = GetOptionalString(element, "altMusic") ?? GetOptionalString(element, "alt_music") ?? string.Empty,
            Ambience = GetOptionalString(element, "ambience") ?? string.Empty,
            Dark = GetOptionalBool(element, "dark") ?? false,
            Underwater = GetOptionalBool(element, "underwater") ?? false,
            Space = GetOptionalBool(element, "space") ?? false,
            DisableDownTransition = GetOptionalBool(element, "disableDownTransition") ?? false,
            CameraOffsetX = GetOptionalInt(element, "cameraOffsetX") ?? 0,
            CameraOffsetY = GetOptionalInt(element, "cameraOffsetY") ?? 0,
            WindPattern = GetOptionalString(element, "windPattern") ?? "None",
            Color = GetOptionalInt(element, "color") ?? GetOptionalInt(element, "c") ?? 0,
            MusicProgress = GetOptionalString(element, "musicProgress") ?? GetOptionalString(element, "music_progress") ?? string.Empty,
            AmbienceProgress = GetOptionalString(element, "ambienceProgress") ?? GetOptionalString(element, "ambience_progress") ?? string.Empty,
            DelayAltMusicFade = GetOptionalBool(element, "delayAltMusicFade") ?? GetOptionalBool(element, "delay_alt_music_fade") ?? false,
            Whisper = GetOptionalBool(element, "whisper") ?? false,
            TilesFg = tilesFg,
            TilesBg = tilesBg,
            FgTiles = fgTiles,
            ObjTiles = objTiles,
            BgTiles = bgTiles,
            Entities = ParseArray(element, "entities", ParseEntity),
            Triggers = ParseArray(element, "triggers", ParseEntity),
            DecalsFg = decalsFg,
            DecalsBg = ParseArray(element, "decalsBg", ParseDecal),
        };
    }

    private static TileGridData? ParseTileGrid(JsonElement room, string propertyName, int fallbackWidth, int fallbackHeight)
    {
        if (!room.TryGetProperty(propertyName, out var element) || element.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        var width = GetOptionalInt(element, "width") ?? fallbackWidth;
        var height = GetOptionalInt(element, "height") ?? fallbackHeight;
        if (!element.TryGetProperty("tiles", out var tilesElement) || tilesElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException($"{propertyName}.tiles must be an array.");
        }

        var rawTiles = tilesElement.EnumerateArray()
            .Select(tile => tile.ValueKind == JsonValueKind.String ? tile.GetString() ?? string.Empty : tile.ToString())
            .ToList();

        if (rawTiles.Count == width * height)
        {
            return new TileGridData
            {
                Width = width,
                Height = height,
                Tiles = rawTiles.Select(tile => string.IsNullOrEmpty(tile) ? '0' : tile[0]).ToList(),
            };
        }

        if (rawTiles.Count == height)
        {
            var flattened = new List<char>(width * height);
            foreach (var row in rawTiles)
            {
                for (var column = 0; column < width; column++)
                {
                    flattened.Add(column < row.Length ? row[column] : '0');
                }
            }

            return new TileGridData
            {
                Width = width,
                Height = height,
                Tiles = flattened,
            };
        }

        throw new InvalidOperationException($"{propertyName}.tiles must either contain {width * height} flat tile entries or {height} row strings.");
    }

    private static ObjectTileGridData? ParseObjectTileGrid(JsonElement room, string propertyName, int fallbackWidth, int fallbackHeight)
    {
        if (!room.TryGetProperty(propertyName, out var element) || element.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        var width = GetOptionalInt(element, "width") ?? fallbackWidth;
        var height = GetOptionalInt(element, "height") ?? fallbackHeight;
        if (!element.TryGetProperty("tiles", out var tilesElement) || tilesElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException($"{propertyName}.tiles must be an array.");
        }

        return new ObjectTileGridData
        {
            Width = width,
            Height = height,
            Tiles = tilesElement.EnumerateArray().Select(ToInt32).ToList(),
        };
    }

    private static TileGridData? ParseTileGridFromStringProperty(JsonElement room, string propertyName, int fallbackWidth, int fallbackHeight)
    {
        if (!room.TryGetProperty(propertyName, out var element) || element.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        var raw = element.ValueKind == JsonValueKind.String ? element.GetString() ?? string.Empty : element.ToString();
        var rows = SplitRows(raw, fallbackHeight);
        var flattened = new List<char>(fallbackWidth * fallbackHeight);

        foreach (var row in rows)
        {
            for (var column = 0; column < fallbackWidth; column++)
            {
                flattened.Add(column < row.Length ? row[column] : '0');
            }
        }

        return new TileGridData
        {
            Width = fallbackWidth,
            Height = fallbackHeight,
            Tiles = flattened,
        };
    }

    private static ObjectTileGridData? ParseObjectTileGridFromStringProperty(JsonElement room, string propertyName, int fallbackWidth, int fallbackHeight)
    {
        if (!room.TryGetProperty(propertyName, out var element) || element.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        var raw = element.ValueKind == JsonValueKind.String ? element.GetString() ?? string.Empty : element.ToString();
        var rows = SplitRows(raw, fallbackHeight);
        var flattened = new List<int>(fallbackWidth * fallbackHeight);

        foreach (var row in rows)
        {
            var values = row.Split(',', StringSplitOptions.TrimEntries);
            for (var column = 0; column < fallbackWidth; column++)
            {
                if (column < values.Length
                    && int.TryParse(values[column], NumberStyles.Integer, CultureInfo.InvariantCulture, out var value))
                {
                    flattened.Add(value);
                }
                else
                {
                    flattened.Add(-1);
                }
            }
        }

        return new ObjectTileGridData
        {
            Width = fallbackWidth,
            Height = fallbackHeight,
            Tiles = flattened,
        };
    }

    private static List<string> SplitRows(string raw, int expectedRows)
    {
        var rows = raw.Replace("\r", string.Empty).Split('\n').ToList();

        while (rows.Count > expectedRows && rows[^1].Length == 0)
        {
            rows.RemoveAt(rows.Count - 1);
        }

        if (rows.Count > expectedRows)
        {
            rows = rows.Take(expectedRows).ToList();
        }

        while (rows.Count < expectedRows)
        {
            rows.Add(string.Empty);
        }

        return rows;
    }

    private static EntityData ParseEntity(JsonElement element)
    {
        var attributes = new Dictionary<string, object?>(StringComparer.Ordinal);
        if (element.TryGetProperty("attributes", out var attributesElement) && attributesElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in attributesElement.EnumerateObject())
            {
                attributes[property.Name] = ConvertJsonValue(property.Value);
            }
        }

        return new EntityData
        {
            Name = GetRequiredString(element, "name"),
            Id = GetOptionalInt(element, "id") ?? 0,
            X = GetRequiredInt(element, "x"),
            Y = GetRequiredInt(element, "y"),
            Width = GetOptionalInt(element, "width") ?? 0,
            Height = GetOptionalInt(element, "height") ?? 0,
            Nodes = ParseArray(element, "nodes", ParseNode),
            Attributes = attributes,
        };
    }

    private static EntityNodeData ParseNode(JsonElement element)
    {
        return new EntityNodeData
        {
            X = GetRequiredInt(element, "x"),
            Y = GetRequiredInt(element, "y"),
        };
    }

    private static DecalData ParseDecal(JsonElement element)
    {
        return new DecalData
        {
            Texture = GetRequiredString(element, "texture"),
            X = GetRequiredInt(element, "x"),
            Y = GetRequiredInt(element, "y"),
            ScaleX = GetOptionalFloat(element, "scaleX") ?? 1f,
            ScaleY = GetOptionalFloat(element, "scaleY") ?? 1f,
            Rotation = GetOptionalFloat(element, "rotation") ?? 0f,
            Color = GetOptionalString(element, "color") ?? "ffffffff",
        };
    }

    private static FillerData ParseFiller(JsonElement element)
    {
        return new FillerData
        {
            X = GetRequiredInt(element, "x"),
            Y = GetRequiredInt(element, "y"),
            Width = GetRequiredInt(element, "width"),
            Height = GetRequiredInt(element, "height"),
        };
    }

    private static StyleEntryData ParseStyle(JsonElement element)
    {
        var style = new StyleEntryData
        {
            Type = GetOptionalString(element, "type") ?? "effect",
            Name = GetOptionalString(element, "name"),
            Texture = GetOptionalString(element, "texture"),
            X = GetOptionalFloat(element, "x"),
            Y = GetOptionalFloat(element, "y"),
            ScrollX = GetOptionalFloat(element, "scrollX") ?? GetOptionalFloat(element, "scrollx"),
            ScrollY = GetOptionalFloat(element, "scrollY") ?? GetOptionalFloat(element, "scrolly"),
            SpeedX = GetOptionalFloat(element, "speedX") ?? GetOptionalFloat(element, "speedx"),
            SpeedY = GetOptionalFloat(element, "speedY") ?? GetOptionalFloat(element, "speedy"),
            Color = GetOptionalString(element, "color"),
            Alpha = GetOptionalFloat(element, "alpha"),
            FlipX = GetOptionalBool(element, "flipX") ?? GetOptionalBool(element, "flipx"),
            FlipY = GetOptionalBool(element, "flipY") ?? GetOptionalBool(element, "flipy"),
            LoopX = GetOptionalBool(element, "loopX") ?? GetOptionalBool(element, "loopx"),
            LoopY = GetOptionalBool(element, "loopY") ?? GetOptionalBool(element, "loopy"),
            BlendMode = GetOptionalString(element, "blendMode") ?? GetOptionalString(element, "blendmode"),
            Only = GetOptionalString(element, "only"),
            Exclude = GetOptionalString(element, "exclude"),
            Flag = GetOptionalString(element, "flag"),
            NotFlag = GetOptionalString(element, "notFlag") ?? GetOptionalString(element, "notflag"),
            Tag = GetOptionalString(element, "tag"),
        };

        foreach (var property in element.EnumerateObject())
        {
            if (StyleEntryData.KnownKeys.Contains(property.Name))
            {
                continue;
            }

            style.ExtraAttributes[property.Name] = ConvertJsonValue(property.Value);
        }

        return style;
    }

    private static List<T> ParseArray<T>(JsonElement element, string propertyName, Func<JsonElement, T> parser)
    {
        if (!element.TryGetProperty(propertyName, out var arrayElement) || arrayElement.ValueKind == JsonValueKind.Null)
        {
            return new List<T>();
        }
        if (arrayElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException($"{propertyName} must be an array.");
        }

        return arrayElement.EnumerateArray().Select(parser).ToList();
    }

    private static object? ConvertJsonValue(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt32(out var integerValue) ? integerValue : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            _ => element.GetRawText(),
        };
    }

    private static string GetRequiredString(JsonElement element, string propertyName)
    {
        var value = GetOptionalString(element, propertyName);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Missing required string property '{propertyName}'.");
        }

        return value;
    }

    private static string? GetOptionalString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.String ? property.GetString() : property.ToString();
    }

    private static int GetRequiredInt(JsonElement element, string propertyName)
    {
        var value = GetOptionalInt(element, propertyName);
        if (!value.HasValue)
        {
            throw new InvalidOperationException($"Missing required numeric property '{propertyName}'.");
        }

        return value.Value;
    }

    private static int? GetOptionalInt(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return ToInt32(property);
    }

    private static bool? GetOptionalBool(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return property.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String when bool.TryParse(property.GetString(), out var boolValue) => boolValue,
            _ => throw new InvalidOperationException($"Property '{propertyName}' must be a boolean."),
        };
    }

    private static float? GetOptionalFloat(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number => property.GetSingle(),
            JsonValueKind.String when float.TryParse(property.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var floatValue) => floatValue,
            _ => throw new InvalidOperationException($"Property '{propertyName}' must be numeric."),
        };
    }

    private static int ToInt32(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var integerValue) => integerValue,
            JsonValueKind.Number => checked((int)Math.Round(element.GetDouble(), MidpointRounding.AwayFromZero)),
            JsonValueKind.String when int.TryParse(element.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedInteger) => parsedInteger,
            JsonValueKind.String when double.TryParse(element.GetString(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsedDouble) => checked((int)Math.Round(parsedDouble, MidpointRounding.AwayFromZero)),
            _ => throw new InvalidOperationException("Expected a numeric JSON value."),
        };
    }
}

internal enum MapBinSchemaMode
{
    ExtensionFriendly,
    StrictVanilla,
}

internal static class CelesteMapBinarySerializer
{
    public static byte[] Serialize(CelesteMapData map, MapBinSchemaMode schemaMode)
    {
        var writer = new BinaryWriter(schemaMode);
        return writer.Serialize(map);
    }

    private sealed class BinaryWriter
    {
        private readonly List<byte> _buffer = new();
        private readonly Dictionary<string, int> _lookup = new(StringComparer.Ordinal);
        private readonly List<string> _lookupList = new();
        private readonly MapBinSchemaMode _schemaMode;

        public BinaryWriter(MapBinSchemaMode schemaMode)
        {
            _schemaMode = schemaMode;
        }

        public byte[] Serialize(CelesteMapData map)
        {
            _buffer.Clear();
            BuildLookup(map);

            WriteString("CELESTE MAP");
            WriteString(map.PackageName);
            WriteInt16(_lookupList.Count);
            foreach (var item in _lookupList)
            {
                WriteString(item);
            }

            WriteMapElement(map);
            return _buffer.ToArray();
        }

        private void BuildLookup(CelesteMapData map)
        {
            _lookup.Clear();
            _lookupList.Clear();

            void AddString(string value)
            {
                if (!_lookup.ContainsKey(value))
                {
                    _lookup[value] = _lookupList.Count;
                    _lookupList.Add(value);
                }
            }

            foreach (var item in new[]
            {
                "Map", "levels", "level", "solids", "bg", "fgtiles", "objtiles", "bgtiles", "entities", "triggers",
                "fgdecals", "bgdecals", "decal", "Filler", "rect", "Style", "Foregrounds",
                "Backgrounds", "parallax", "apply", "node"
            })
            {
                AddString(item);
            }

            foreach (var item in new[]
            {
                "name", "x", "y", "width", "height", "w", "h", "music", "musicLayer1",
                "musicLayer2", "musicLayer3", "musicLayer4", "altMusic", "alt_music", "ambience", "dark",
                "underwater", "space", "disableDownTransition", "cameraOffsetX", "cameraOffsetY",
                "windPattern", "color", "c", "musicProgress", "ambienceProgress", "delayAltMusicFade",
                "whisper", "innerText", "id", "texture", "scaleX", "scaleY",
                "rotation", "scrollx", "scrolly", "speedx", "speedy", "alpha", "flipx", "flipy",
                "loopx", "loopy", "blendmode", "only", "exclude", "flag", "notflag", "tag"
            })
            {
                AddString(item);
            }

            foreach (var room in map.Rooms)
            {
                AddString(room.Name);
                AddString(room.Music);
                AddString(room.AltMusic);
                AddString(room.Ambience);
                AddString(room.WindPattern);

                foreach (var entity in room.Entities.Concat(room.Triggers))
                {
                    AddString(entity.Name);
                    foreach (var attribute in entity.Attributes)
                    {
                        AddString(attribute.Key);
                        if (attribute.Value is string stringValue)
                        {
                            AddString(stringValue);
                        }
                    }
                }

                foreach (var decal in room.DecalsFg.Concat(room.DecalsBg))
                {
                    AddString(decal.Texture);
                    AddString(decal.Color);
                }
            }

            foreach (var style in map.StylesFg.Concat(map.StylesBg))
            {
                if (!string.IsNullOrWhiteSpace(style.Name)) AddString(style.Name);
                if (!string.IsNullOrWhiteSpace(style.Texture)) AddString(style.Texture);
                foreach (var attribute in style.ToAttributeDictionary())
                {
                    AddString(attribute.Key);
                    if (attribute.Value is string stringValue)
                    {
                        AddString(stringValue);
                    }
                }
            }
        }

        private void WriteMapElement(CelesteMapData map)
        {
            WriteLookupIndex("Map");
            WriteByte(0);

            var childCount = 2;
            if (map.Fillers.Count > 0)
            {
                childCount++;
            }

            WriteUInt16(childCount);
            WriteLevelsElement(map.Rooms);
            if (map.Fillers.Count > 0)
            {
                WriteFillerElement(map.Fillers);
            }
            WriteStyleElement(map.StylesFg, map.StylesBg);
        }

        private void WriteLevelsElement(IReadOnlyList<RoomData> rooms)
        {
            WriteLookupIndex("levels");
            WriteByte(0);
            WriteUInt16(rooms.Count);
            foreach (var room in rooms)
            {
                WriteRoomElement(room);
            }
        }

        private void WriteRoomElement(RoomData room)
        {
            WriteLookupIndex("level");

            if (_schemaMode == MapBinSchemaMode.StrictVanilla)
            {
                WriteStrictVanillaRoomElement(room);
                return;
            }

            WriteExtensionFriendlyRoomElement(room);
        }

        private void WriteExtensionFriendlyRoomElement(RoomData room)
        {
            var attributes = new List<KeyValuePair<string, object?>>
            {
                new("name", room.Name),
                new("x", room.X),
                new("y", room.Y),
                new("width", room.Width),
                new("height", room.Height),
                new("music", room.Music),
                new("musicLayer1", room.MusicLayer1),
                new("musicLayer2", room.MusicLayer2),
                new("musicLayer3", room.MusicLayer3),
                new("musicLayer4", room.MusicLayer4),
                new("altMusic", room.AltMusic),
                new("ambience", room.Ambience),
                new("dark", room.Dark),
                new("underwater", room.Underwater),
                new("space", room.Space),
                new("disableDownTransition", room.DisableDownTransition),
                new("cameraOffsetX", room.CameraOffsetX),
                new("cameraOffsetY", room.CameraOffsetY),
                new("windPattern", room.WindPattern),
                new("color", room.Color),
            };

            WriteByte(attributes.Count);
            foreach (var attribute in attributes)
            {
                WriteValue(attribute.Key, attribute.Value);
            }

            var childCount = 4;
            if (room.TilesFg is not null) childCount++;
            if (room.TilesBg is not null) childCount++;
            if (room.ObjTiles is not null) childCount++;

            WriteUInt16(childCount);

            if (room.TilesFg is not null)
            {
                WriteTilesElement("solids", room.TilesFg);
            }

            if (room.TilesBg is not null)
            {
                WriteTilesElement("bg", room.TilesBg);
            }

            if (room.ObjTiles is not null)
            {
                WriteObjectTilesElement("objtiles", room.ObjTiles, writeAllRowsWhenPresent: true);
            }

            WriteEntitiesElement("entities", room.Entities);
            WriteEntitiesElement("triggers", room.Triggers);
            WriteDecalsElement("fgdecals", room.DecalsFg);
            WriteDecalsElement("bgdecals", room.DecalsBg);
        }

        private void WriteStrictVanillaRoomElement(RoomData room)
        {
            var attributes = new List<KeyValuePair<string, object?>>
            {
                new("name", room.Name),
                new("x", room.X),
                new("y", room.Y),
                new("width", room.Width),
                new("height", room.Height),
                new("music", room.Music),
                new("musicLayer1", room.MusicLayer1),
                new("musicLayer2", room.MusicLayer2),
                new("musicLayer3", room.MusicLayer3),
                new("musicLayer4", room.MusicLayer4),
                new("alt_music", room.AltMusic),
                new("ambience", room.Ambience),
                new("dark", room.Dark),
                new("underwater", room.Underwater),
                new("space", room.Space),
                new("disableDownTransition", room.DisableDownTransition),
                new("cameraOffsetX", room.CameraOffsetX),
                new("cameraOffsetY", room.CameraOffsetY),
                new("windPattern", room.WindPattern),
                new("c", room.Color),
                new("musicProgress", room.MusicProgress),
                new("ambienceProgress", room.AmbienceProgress),
                new("delayAltMusicFade", room.DelayAltMusicFade),
                new("whisper", room.Whisper),
            };

            WriteByte(attributes.Count);
            foreach (var attribute in attributes)
            {
                WriteValue(attribute.Key, attribute.Value);
            }

            var childCount = 8;
            if (room.Triggers.Count > 0) childCount++;

            WriteUInt16(childCount);

            WriteTilesElement("bg", room.TilesBg);
            WriteObjectTilesElement("fgtiles", room.FgTiles, writeAllRowsWhenPresent: false);
            WriteTilesElement("solids", room.TilesFg);
            WriteObjectTilesElement("objtiles", room.ObjTiles, writeAllRowsWhenPresent: false);
            WriteObjectTilesElement("bgtiles", room.BgTiles, writeAllRowsWhenPresent: false);
            WriteDecalsElement("fgdecals", room.DecalsFg);
            if (room.Triggers.Count > 0)
            {
                WriteEntitiesElement("triggers", room.Triggers);
            }
            WriteEntitiesElement("entities", room.Entities);
            WriteDecalsElement("bgdecals", room.DecalsBg);
        }

        private void WriteTilesElement(string name, TileGridData? grid)
        {
            WriteLookupIndex(name);
            WriteByte(1);

            var innerText = string.Empty;
            if (grid is not null)
            {
                var rows = new List<string>(grid.Height);
                for (var row = 0; row < grid.Height; row++)
                {
                    rows.Add(new string(grid.Tiles.Skip(row * grid.Width).Take(grid.Width).ToArray()));
                }

                innerText = string.Join('\n', rows);
            }

            WriteRleValue("innerText", innerText);
            WriteUInt16(0);
        }

        private void WriteObjectTilesElement(string name, ObjectTileGridData? grid, bool writeAllRowsWhenPresent)
        {
            WriteLookupIndex(name);
            WriteByte(1);

            var innerText = string.Empty;
            if (grid is not null
                && grid.Width > 0
                && grid.Height > 0
                && (writeAllRowsWhenPresent || grid.Tiles.Any(tile => tile >= 0)))
            {
                var rows = new List<string>(grid.Height);
                for (var row = 0; row < grid.Height; row++)
                {
                    var values = new List<string>(grid.Width);
                    for (var column = 0; column < grid.Width; column++)
                    {
                        var index = row * grid.Width + column;
                        var tile = index < grid.Tiles.Count ? grid.Tiles[index] : -1;
                        values.Add(tile.ToString(CultureInfo.InvariantCulture));
                    }

                    rows.Add(string.Join(',', values));
                }

                innerText = string.Join('\n', rows);
            }

            WriteRleValue("innerText", innerText);
            WriteUInt16(0);
        }

        private void WriteEntitiesElement(string name, IReadOnlyList<EntityData> entities)
        {
            WriteLookupIndex(name);
            WriteByte(0);
            WriteUInt16(entities.Count);
            foreach (var entity in entities)
            {
                WriteEntityElement(entity);
            }
        }

        private void WriteEntityElement(EntityData entity)
        {
            WriteLookupIndex(entity.Name);

            var baseAttributes = new List<KeyValuePair<string, object?>>
            {
                new("id", entity.Id),
                new("x", entity.X),
                new("y", entity.Y),
            };
            if (entity.Width != 0) baseAttributes.Add(new("width", entity.Width));
            if (entity.Height != 0) baseAttributes.Add(new("height", entity.Height));

            WriteByte(baseAttributes.Count + entity.Attributes.Count);
            foreach (var attribute in baseAttributes)
            {
                WriteValue(attribute.Key, attribute.Value);
            }
            foreach (var attribute in entity.Attributes)
            {
                WriteValue(attribute.Key, attribute.Value);
            }

            WriteUInt16(entity.Nodes.Count);
            foreach (var node in entity.Nodes)
            {
                WriteLookupIndex("node");
                WriteByte(2);
                WriteValue("x", node.X);
                WriteValue("y", node.Y);
                WriteUInt16(0);
            }
        }

        private void WriteDecalsElement(string name, IReadOnlyList<DecalData> decals)
        {
            WriteLookupIndex(name);
            WriteByte(0);
            WriteUInt16(decals.Count);

            foreach (var decal in decals)
            {
                WriteLookupIndex("decal");
                var texture = _schemaMode == MapBinSchemaMode.StrictVanilla
                    ? NormalizeDecalTexture(decal.Texture)
                    : decal.Texture;
                var color = _schemaMode == MapBinSchemaMode.StrictVanilla
                    ? NormalizeColorHex(decal.Color, "ffffffff")
                    : decal.Color;
                var attributes = new List<KeyValuePair<string, object?>>
                {
                    new("texture", texture),
                    new("x", decal.X),
                    new("y", decal.Y),
                    new("scaleX", decal.ScaleX),
                    new("scaleY", decal.ScaleY),
                };
                if (Math.Abs(decal.Rotation) > float.Epsilon) attributes.Add(new("rotation", decal.Rotation));
                if (!string.Equals(color, "ffffffff", StringComparison.OrdinalIgnoreCase)) attributes.Add(new("color", color));

                WriteByte(attributes.Count);
                foreach (var attribute in attributes)
                {
                    WriteValue(attribute.Key, attribute.Value);
                }
                WriteUInt16(0);
            }
        }

        private static string NormalizeDecalTexture(string texture)
        {
            var normalized = (texture ?? string.Empty).Trim().Replace('\\', '/');
            if (normalized.StartsWith("decals/", StringComparison.OrdinalIgnoreCase))
            {
                normalized = normalized["decals/".Length..];
            }

            if (string.IsNullOrEmpty(normalized))
            {
                return normalized;
            }

            if (!normalized.EndsWith(".png", StringComparison.OrdinalIgnoreCase))
            {
                normalized += ".png";
            }

            return normalized;
        }

        private static string NormalizeColorHex(string color, string fallback)
        {
            if (string.IsNullOrWhiteSpace(color))
            {
                return fallback;
            }

            return color.Trim().TrimStart('#').ToLowerInvariant();
        }

        private void WriteFillerElement(IReadOnlyList<FillerData> fillers)
        {
            WriteLookupIndex("Filler");
            WriteByte(0);
            WriteUInt16(fillers.Count);
            foreach (var filler in fillers)
            {
                WriteLookupIndex("rect");
                WriteByte(4);
                WriteValue("x", filler.X);
                WriteValue("y", filler.Y);
                WriteValue("w", filler.Width);
                WriteValue("h", filler.Height);
                WriteUInt16(0);
            }
        }

        private void WriteStyleElement(IReadOnlyList<StyleEntryData> fg, IReadOnlyList<StyleEntryData> bg)
        {
            WriteLookupIndex("Style");
            WriteByte(0);
            WriteUInt16(2);
            WriteStyleGroupElement("Foregrounds", fg);
            WriteStyleGroupElement("Backgrounds", bg);
        }

        private void WriteStyleGroupElement(string name, IReadOnlyList<StyleEntryData> styles)
        {
            WriteLookupIndex(name);
            WriteByte(0);
            WriteUInt16(styles.Count);

            foreach (var style in styles)
            {
                if (string.Equals(style.Type, "parallax", StringComparison.OrdinalIgnoreCase))
                {
                    WriteLookupIndex("parallax");
                    var attributes = new List<KeyValuePair<string, object?>>();
                    if (!string.IsNullOrWhiteSpace(style.Texture)) attributes.Add(new("texture", style.Texture));
                    if (style.X.HasValue) attributes.Add(new("x", style.X.Value));
                    if (style.Y.HasValue) attributes.Add(new("y", style.Y.Value));
                    if (style.ScrollX.HasValue) attributes.Add(new("scrollx", style.ScrollX.Value));
                    if (style.ScrollY.HasValue) attributes.Add(new("scrolly", style.ScrollY.Value));
                    if (style.SpeedX.HasValue && Math.Abs(style.SpeedX.Value) > float.Epsilon) attributes.Add(new("speedx", style.SpeedX.Value));
                    if (style.SpeedY.HasValue && Math.Abs(style.SpeedY.Value) > float.Epsilon) attributes.Add(new("speedy", style.SpeedY.Value));
                    if (!string.IsNullOrWhiteSpace(style.Color) && !string.Equals(style.Color, "ffffff", StringComparison.OrdinalIgnoreCase)) attributes.Add(new("color", style.Color));
                    if (style.Alpha.HasValue && Math.Abs(style.Alpha.Value - 1f) > float.Epsilon) attributes.Add(new("alpha", style.Alpha.Value));
                    if (style.FlipX == true) attributes.Add(new("flipx", true));
                    if (style.FlipY == true) attributes.Add(new("flipy", true));
                    if (style.LoopX.HasValue) attributes.Add(new("loopx", style.LoopX.Value));
                    if (style.LoopY.HasValue) attributes.Add(new("loopy", style.LoopY.Value));
                    if (!string.IsNullOrWhiteSpace(style.BlendMode) && !string.Equals(style.BlendMode, "alphablend", StringComparison.OrdinalIgnoreCase)) attributes.Add(new("blendmode", style.BlendMode));
                    if (!string.IsNullOrWhiteSpace(style.Only) && !string.Equals(style.Only, "*", StringComparison.Ordinal)) attributes.Add(new("only", style.Only));
                    if (!string.IsNullOrWhiteSpace(style.Exclude)) attributes.Add(new("exclude", style.Exclude));
                    if (!string.IsNullOrWhiteSpace(style.Flag)) attributes.Add(new("flag", style.Flag));
                    if (!string.IsNullOrWhiteSpace(style.NotFlag)) attributes.Add(new("notflag", style.NotFlag));
                    if (!string.IsNullOrWhiteSpace(style.Tag)) attributes.Add(new("tag", style.Tag));

                    WriteByte(attributes.Count);
                    foreach (var attribute in attributes)
                    {
                        WriteValue(attribute.Key, attribute.Value);
                    }
                    WriteUInt16(0);
                    continue;
                }

                WriteLookupIndex(style.Name ?? "unknown");
                var attributesForEffect = new List<KeyValuePair<string, object?>>();
                if (!string.IsNullOrWhiteSpace(style.Only) && !string.Equals(style.Only, "*", StringComparison.Ordinal)) attributesForEffect.Add(new("only", style.Only));
                if (!string.IsNullOrWhiteSpace(style.Exclude)) attributesForEffect.Add(new("exclude", style.Exclude));
                if (!string.IsNullOrWhiteSpace(style.Flag)) attributesForEffect.Add(new("flag", style.Flag));
                if (!string.IsNullOrWhiteSpace(style.NotFlag)) attributesForEffect.Add(new("notflag", style.NotFlag));
                if (!string.IsNullOrWhiteSpace(style.Tag)) attributesForEffect.Add(new("tag", style.Tag));
                foreach (var attribute in style.ExtraAttributes)
                {
                    attributesForEffect.Add(new(attribute.Key, attribute.Value));
                }

                WriteByte(attributesForEffect.Count);
                foreach (var attribute in attributesForEffect)
                {
                    WriteValue(attribute.Key, attribute.Value);
                }
                WriteUInt16(0);
            }
        }

        private void WriteValue(string key, object? value)
        {
            WriteLookupIndex(key);
            switch (value)
            {
                case bool boolValue:
                    WriteByte(0);
                    WriteBool(boolValue);
                    return;
                case byte byteValue:
                    WriteByte(1);
                    WriteByte(byteValue);
                    return;
                case short shortValue:
                    WriteInteger(shortValue);
                    return;
                case int intValue:
                    WriteInteger(intValue);
                    return;
                case long longValue:
                    WriteInteger(checked((int)longValue));
                    return;
                case float floatValue:
                    WriteByte(4);
                    WriteFloat32(floatValue);
                    return;
                case double doubleValue:
                    WriteByte(4);
                    WriteFloat32((float)doubleValue);
                    return;
                case string stringValue:
                    if (_lookup.ContainsKey(stringValue))
                    {
                        WriteByte(5);
                        WriteLookupIndex(stringValue);
                    }
                    else
                    {
                        WriteByte(6);
                        WriteString(stringValue);
                    }
                    return;
                case null:
                    WriteByte(6);
                    WriteString(string.Empty);
                    return;
                default:
                    WriteByte(6);
                    WriteString(Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty);
                    return;
            }
        }

        private void WriteInteger(int value)
        {
            if (value >= 0 && value <= byte.MaxValue)
            {
                WriteByte(1);
                WriteByte((byte)value);
            }
            else if (value >= short.MinValue && value <= short.MaxValue)
            {
                WriteByte(2);
                WriteInt16(value);
            }
            else
            {
                WriteByte(3);
                WriteInt32(value);
            }
        }

        private void WriteRleValue(string key, string value)
        {
            WriteLookupIndex(key);
            WriteByte(7);

            var encoded = new List<byte>();
            var index = 0;
            while (index < value.Length)
            {
                var character = value[index];
                byte count = 1;
                while (index + count < value.Length && value[index + count] == character && count < byte.MaxValue)
                {
                    count++;
                }

                encoded.Add(count);
                encoded.Add((byte)character);
                index += count;
            }

            WriteInt16(encoded.Count);
            _buffer.AddRange(encoded);
        }

        private void WriteLookupIndex(string value)
        {
            if (!_lookup.TryGetValue(value, out var index))
            {
                throw new InvalidOperationException($"String not found in lookup table: {value}");
            }

            WriteUInt16(index);
        }

        private void WriteBool(bool value) => WriteByte(value ? (byte)1 : (byte)0);

        private void WriteByte(int value) => _buffer.Add((byte)(value & 0xFF));

        private void WriteUInt16(int value)
        {
            _buffer.Add((byte)(value & 0xFF));
            _buffer.Add((byte)((value >> 8) & 0xFF));
        }

        private void WriteInt16(int value)
        {
            unchecked
            {
                WriteUInt16((ushort)(short)value);
            }
        }

        private void WriteInt32(int value)
        {
            _buffer.Add((byte)(value & 0xFF));
            _buffer.Add((byte)((value >> 8) & 0xFF));
            _buffer.Add((byte)((value >> 16) & 0xFF));
            _buffer.Add((byte)((value >> 24) & 0xFF));
        }

        private void WriteFloat32(float value)
        {
            _buffer.AddRange(BitConverter.GetBytes(value));
        }

        private void WriteString(string value)
        {
            var bytes = Encoding.UTF8.GetBytes(value);
            Write7BitInt(bytes.Length);
            _buffer.AddRange(bytes);
        }

        private void Write7BitInt(int value)
        {
            var remaining = value;
            while (remaining >= 0x80)
            {
                WriteByte((remaining & 0x7F) | 0x80);
                remaining >>= 7;
            }

            WriteByte(remaining);
        }
    }
}

internal sealed class CelesteMapData
{
    public string PackageName { get; init; } = string.Empty;
    public List<RoomData> Rooms { get; init; } = new();
    public List<FillerData> Fillers { get; init; } = new();
    public List<StyleEntryData> StylesFg { get; init; } = new();
    public List<StyleEntryData> StylesBg { get; init; } = new();
    public PreviewMetadataData? PreviewMetadata { get; init; }
}

internal sealed class PreviewMetadataData
{
    public string LayoutMode { get; init; } = "grid";
    public string Archetype { get; init; } = "linearAscent";
    public int StartNodeId { get; init; }
    public int GoalNodeId { get; init; }
    public List<int> MainPathNodeIds { get; init; } = new();
    public List<PreviewNodeData> Nodes { get; init; } = new();
}

internal sealed class PreviewNodeData
{
    public int Id { get; init; }
    public string RoomName { get; init; } = string.Empty;
    public int Row { get; init; }
    public int Column { get; init; }
    public string Role { get; init; } = "path";
    public List<int> Connections { get; init; } = new();
    public string Phase { get; init; } = "build";
    public int Segment { get; init; }
}

internal sealed class RoomData
{
    public string Name { get; init; } = string.Empty;
    public int X { get; init; }
    public int Y { get; init; }
    public int Width { get; init; }
    public int Height { get; init; }
    public int TileWidth { get; init; }
    public int TileHeight { get; init; }
    public string Music { get; init; } = string.Empty;
    public bool MusicLayer1 { get; init; }
    public bool MusicLayer2 { get; init; }
    public bool MusicLayer3 { get; init; }
    public bool MusicLayer4 { get; init; }
    public string AltMusic { get; init; } = string.Empty;
    public string Ambience { get; init; } = string.Empty;
    public bool Dark { get; init; }
    public bool Underwater { get; init; }
    public bool Space { get; init; }
    public bool DisableDownTransition { get; init; }
    public int CameraOffsetX { get; init; }
    public int CameraOffsetY { get; init; }
    public string WindPattern { get; init; } = "None";
    public int Color { get; init; }
    public string MusicProgress { get; init; } = string.Empty;
    public string AmbienceProgress { get; init; } = string.Empty;
    public bool DelayAltMusicFade { get; init; }
    public bool Whisper { get; init; }
    public TileGridData? TilesFg { get; init; }
    public TileGridData? TilesBg { get; init; }
    public ObjectTileGridData? FgTiles { get; init; }
    public ObjectTileGridData? ObjTiles { get; init; }
    public ObjectTileGridData? BgTiles { get; init; }
    public List<EntityData> Entities { get; init; } = new();
    public List<EntityData> Triggers { get; init; } = new();
    public List<DecalData> DecalsFg { get; init; } = new();
    public List<DecalData> DecalsBg { get; init; } = new();
}

internal sealed class TileGridData
{
    public int Width { get; init; }
    public int Height { get; init; }
    public List<char> Tiles { get; init; } = new();
}

internal sealed class ObjectTileGridData
{
    public int Width { get; init; }
    public int Height { get; init; }
    public List<int> Tiles { get; init; } = new();
}

internal sealed class EntityData
{
    public string Name { get; init; } = string.Empty;
    public int Id { get; init; }
    public int X { get; init; }
    public int Y { get; init; }
    public int Width { get; init; }
    public int Height { get; init; }
    public List<EntityNodeData> Nodes { get; init; } = new();
    public Dictionary<string, object?> Attributes { get; init; } = new(StringComparer.Ordinal);
}

internal sealed class EntityNodeData
{
    public int X { get; init; }
    public int Y { get; init; }
}

internal sealed class DecalData
{
    public string Texture { get; init; } = string.Empty;
    public int X { get; init; }
    public int Y { get; init; }
    public float ScaleX { get; init; }
    public float ScaleY { get; init; }
    public float Rotation { get; init; }
    public string Color { get; init; } = "ffffffff";
}

internal sealed class FillerData
{
    public int X { get; init; }
    public int Y { get; init; }
    public int Width { get; init; }
    public int Height { get; init; }
}

internal sealed class StyleEntryData
{
    public static readonly HashSet<string> KnownKeys = new(StringComparer.Ordinal)
    {
        "type", "name", "texture", "x", "y", "scrollX", "scrollY", "scrollx", "scrolly",
        "speedX", "speedY", "speedx", "speedy", "color", "alpha", "flipX", "flipY", "flipx",
        "flipy", "loopX", "loopY", "loopx", "loopy", "blendMode", "blendmode", "only", "exclude",
        "flag", "notFlag", "notflag", "tag"
    };

    public string Type { get; init; } = "effect";
    public string? Name { get; init; }
    public string? Texture { get; init; }
    public float? X { get; init; }
    public float? Y { get; init; }
    public float? ScrollX { get; init; }
    public float? ScrollY { get; init; }
    public float? SpeedX { get; init; }
    public float? SpeedY { get; init; }
    public string? Color { get; init; }
    public float? Alpha { get; init; }
    public bool? FlipX { get; init; }
    public bool? FlipY { get; init; }
    public bool? LoopX { get; init; }
    public bool? LoopY { get; init; }
    public string? BlendMode { get; init; }
    public string? Only { get; init; }
    public string? Exclude { get; init; }
    public string? Flag { get; init; }
    public string? NotFlag { get; init; }
    public string? Tag { get; init; }
    public Dictionary<string, object?> ExtraAttributes { get; } = new(StringComparer.Ordinal);

    public Dictionary<string, object?> ToAttributeDictionary()
    {
        var attributes = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["type"] = Type,
        };

        if (!string.IsNullOrWhiteSpace(Name)) attributes["name"] = Name;
        if (!string.IsNullOrWhiteSpace(Texture)) attributes["texture"] = Texture;
        if (X.HasValue) attributes["x"] = X.Value;
        if (Y.HasValue) attributes["y"] = Y.Value;
        if (ScrollX.HasValue) attributes["scrollx"] = ScrollX.Value;
        if (ScrollY.HasValue) attributes["scrolly"] = ScrollY.Value;
        if (SpeedX.HasValue) attributes["speedx"] = SpeedX.Value;
        if (SpeedY.HasValue) attributes["speedy"] = SpeedY.Value;
        if (!string.IsNullOrWhiteSpace(Color)) attributes["color"] = Color;
        if (Alpha.HasValue) attributes["alpha"] = Alpha.Value;
        if (FlipX.HasValue) attributes["flipx"] = FlipX.Value;
        if (FlipY.HasValue) attributes["flipy"] = FlipY.Value;
        if (LoopX.HasValue) attributes["loopx"] = LoopX.Value;
        if (LoopY.HasValue) attributes["loopy"] = LoopY.Value;
        if (!string.IsNullOrWhiteSpace(BlendMode)) attributes["blendmode"] = BlendMode;
        if (!string.IsNullOrWhiteSpace(Only)) attributes["only"] = Only;
        if (!string.IsNullOrWhiteSpace(Exclude)) attributes["exclude"] = Exclude;
        if (!string.IsNullOrWhiteSpace(Flag)) attributes["flag"] = Flag;
        if (!string.IsNullOrWhiteSpace(NotFlag)) attributes["notflag"] = NotFlag;
        if (!string.IsNullOrWhiteSpace(Tag)) attributes["tag"] = Tag;

        foreach (var attribute in ExtraAttributes)
        {
            attributes[attribute.Key] = attribute.Value;
        }

        return attributes;
    }
}