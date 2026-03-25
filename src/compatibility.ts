import * as fs from 'fs';
import * as path from 'path';

import {
    CelesteMap,
    Decal,
    Entity,
    Filler,
    Room,
    StyleEntry,
    TileGrid,
    Trigger,
} from './types';

export interface CompatibilityBundleOptions {
    loennModulePrefix: string;
    monoGameNamespace: string;
    loennPluginPath?: string;
}

export interface CompatibilityFile {
    relativePath: string;
    content: string;
}

export interface CompatibilityBundle {
    files: CompatibilityFile[];
}

export function createCompatibilityBundle(
    map: CelesteMap,
    options: CompatibilityBundleOptions
): CompatibilityBundle {
    const loennFiles = createLoennLuaFiles(map, options.loennModulePrefix, options.loennPluginPath);

    return {
        files: [
            {
                relativePath: 'monogame-scene.json',
                content: createMonoGameSceneJson(map),
            },
            {
                relativePath: 'CelesteMapModels.cs',
                content: createMonoGameCSharpModels(options.monoGameNamespace),
            },
            {
                relativePath: 'CelesteMapRenderer.cs',
                content: createMonoGameRendererHelper(options.monoGameNamespace),
            },
            ...createMonoGameSampleFiles(options.monoGameNamespace),
            ...loennFiles.map((file) => ({
                relativePath: `loenn/${file.relativePath}`,
                content: file.content,
            })),
        ],
    };
}

function createMonoGameSceneJson(map: CelesteMap): string {
    const scene = {
        packageName: map.packageName,
        rooms: map.rooms.map(serializeRoomForMonoGame),
        fillers: map.fillers.map(serializeFiller),
        styles: {
            foregrounds: map.stylesFg.map(serializeStyleEntry),
            backgrounds: map.stylesBg.map(serializeStyleEntry),
        },
    };

    return JSON.stringify(scene, null, 2);
}

function createMonoGameCSharpModels(namespaceName: string): string {
    return `using System.Collections.Generic;
using Microsoft.Xna.Framework;
using MonoGame.Extended;

namespace ${namespaceName};

public sealed class CelesteMapScene
{
    public string PackageName { get; set; } = string.Empty;
    public List<CelesteRoomScene> Rooms { get; set; } = new();
    public List<CelesteFillerScene> Fillers { get; set; } = new();
    public CelesteStyleCollection Styles { get; set; } = new();
}

public sealed class CelesteRoomScene
{
    public string Name { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public int TileWidth { get; set; }
    public int TileHeight { get; set; }
    public string Music { get; set; } = string.Empty;
    public string AltMusic { get; set; } = string.Empty;
    public string Ambience { get; set; } = string.Empty;
    public string WindPattern { get; set; } = string.Empty;
    public int Color { get; set; }
    public bool Dark { get; set; }
    public bool Underwater { get; set; }
    public bool Space { get; set; }
    public bool DisableDownTransition { get; set; }
    public int CameraOffsetX { get; set; }
    public int CameraOffsetY { get; set; }
    public CelesteTileLayer TilesFg { get; set; } = new();
    public CelesteTileLayer TilesBg { get; set; } = new();
    public List<CelesteEntityScene> Entities { get; set; } = new();
    public List<CelesteEntityScene> Triggers { get; set; } = new();
    public List<CelesteDecalScene> DecalsFg { get; set; } = new();
    public List<CelesteDecalScene> DecalsBg { get; set; } = new();

    public Rectangle Bounds => new(X, Y, Width, Height);
    public RectangleF BoundsF => new(X, Y, Width, Height);
    public Point TileSize => new(TileWidth, TileHeight);
}

public sealed class CelesteTileLayer
{
    public int Width { get; set; }
    public int Height { get; set; }
    public List<string> Rows { get; set; } = new();
}

public sealed class CelesteEntityScene
{
    public string Name { get; set; } = string.Empty;
    public int Id { get; set; }
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public Dictionary<string, object?> Attributes { get; set; } = new();
    public List<Point> Nodes { get; set; } = new();

    public Vector2 Position => new(X, Y);
    public Rectangle Bounds => new(X, Y, Width, Height);
    public RectangleF BoundsF => new(X, Y, Width, Height);
}

public sealed class CelesteDecalScene
{
    public string Texture { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public float ScaleX { get; set; }
    public float ScaleY { get; set; }
    public float Rotation { get; set; }
    public string Color { get; set; } = "ffffffff";
}

public sealed class CelesteFillerScene
{
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }

    public Rectangle Bounds => new(X, Y, Width, Height);
    public RectangleF BoundsF => new(X, Y, Width, Height);
}

public sealed class CelesteStyleCollection
{
    public List<CelesteStyleScene> Foregrounds { get; set; } = new();
    public List<CelesteStyleScene> Backgrounds { get; set; } = new();
}

public sealed class CelesteStyleScene
{
    public string Type { get; set; } = string.Empty;
    public Dictionary<string, object?> Data { get; set; } = new();
}`;
}

function createMonoGameRendererHelper(namespaceName: string): string {
    return `using System;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace ${namespaceName};

public sealed class CelesteMapRenderer
{
    private readonly Texture2D _pixel;

    public CelesteMapRenderer(GraphicsDevice graphicsDevice)
    {
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Color.White });
    }

    public void DrawRoom(SpriteBatch spriteBatch, CelesteRoomScene room, Point tileSize, bool drawBackground = true)
    {
        if (drawBackground && room.TilesBg is not null)
        {
            DrawTileLayer(spriteBatch, room.TilesBg, room.X, room.Y, tileSize, 0.35f);
        }

        if (room.TilesFg is not null)
        {
            DrawTileLayer(spriteBatch, room.TilesFg, room.X, room.Y, tileSize, 1f);
        }

        foreach (var entity in room.Entities)
        {
            DrawRect(spriteBatch, new Rectangle(room.X + entity.X, room.Y + entity.Y, Math.Max(entity.Width, 8), Math.Max(entity.Height, 8)), Color.LimeGreen * 0.85f);
        }

        foreach (var trigger in room.Triggers)
        {
            DrawRect(spriteBatch, new Rectangle(room.X + trigger.X, room.Y + trigger.Y, Math.Max(trigger.Width, 8), Math.Max(trigger.Height, 8)), Color.Orange * 0.55f);
        }
    }

    public void DrawTileLayer(SpriteBatch spriteBatch, CelesteTileLayer? layer, int offsetX, int offsetY, Point tileSize, float alpha)
    {
        if (layer is null)
        {
            return;
        }

        for (var y = 0; y < layer.Rows.Count; y++)
        {
            var row = layer.Rows[y];
            for (var x = 0; x < row.Length; x++)
            {
                var tile = row[x];
                if (tile == '0')
                {
                    continue;
                }

                var color = TileColor(tile) * alpha;
                var destination = new Rectangle(offsetX + x * tileSize.X, offsetY + y * tileSize.Y, tileSize.X, tileSize.Y);
                spriteBatch.Draw(_pixel, destination, color);
            }
        }
    }

    private void DrawRect(SpriteBatch spriteBatch, Rectangle rectangle, Color color)
    {
        spriteBatch.Draw(_pixel, rectangle, color);
    }

    private static Color TileColor(char tile) => tile switch
    {
        '1' => new Color(139, 69, 19),
        '3' => new Color(232, 232, 232),
        '4' => Color.Gray,
        '5' => new Color(105, 105, 105),
        '6' => new Color(160, 160, 160),
        '7' => new Color(176, 176, 176),
        '8' => new Color(96, 96, 96),
        '9' => new Color(222, 184, 135),
        'a' => new Color(200, 176, 122),
        'b' => new Color(112, 112, 96),
        'c' => new Color(64, 128, 192),
        'd' => new Color(160, 144, 96),
        'e' => new Color(144, 128, 80),
        'f' => new Color(96, 96, 80),
        'g' => new Color(80, 96, 160),
        'h' => new Color(144, 144, 160),
        'i' => new Color(160, 192, 224),
        'j' => new Color(224, 96, 48),
        'k' => new Color(96, 112, 160),
        'l' => new Color(64, 64, 96),
        _ => Color.White,
    };
}`;
}

function createMonoGameSampleFiles(namespaceName: string): CompatibilityFile[] {
    return [
        {
            relativePath: 'sample-monogame/CelesteMapSample.csproj',
            content: createMonoGameSampleProject(),
        },
        {
            relativePath: 'sample-monogame/Program.cs',
            content: `using var game = new CelesteMapSample.Game1();
game.Run();
`,
        },
        {
            relativePath: 'sample-monogame/Game1.cs',
            content: createMonoGameSampleGame(namespaceName),
        },
        {
            relativePath: 'sample-monogame/README.md',
            content: createMonoGameSampleReadme(),
        },
    ];
}

function createMonoGameSampleProject(): string {
    return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="MonoGame.Framework.DesktopGL" Version="3.8.1.303" />
    <PackageReference Include="MonoGame.Extended" Version="4.0.0-beta.12" />
  </ItemGroup>
</Project>
`;
}

function createMonoGameSampleGame(namespaceName: string): string {
    return `using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using ${namespaceName};

namespace CelesteMapSample;

public sealed class Game1 : Game
{
    private readonly GraphicsDeviceManager _graphics;
    private SpriteBatch? _spriteBatch;
    private CelesteMapScene? _scene;
    private CelesteMapRenderer? _renderer;
    private Vector2 _camera = new(32f, 32f);
    private float _zoom = 2f;

    public Game1()
    {
        _graphics = new GraphicsDeviceManager(this);
        IsMouseVisible = true;
        Window.AllowUserResizing = true;
    }

    protected override void LoadContent()
    {
        _spriteBatch = new SpriteBatch(GraphicsDevice);
        _renderer = new CelesteMapRenderer(GraphicsDevice);
        _scene = LoadScene();
    }

    protected override void Update(GameTime gameTime)
    {
        var keyboard = Keyboard.GetState();
        if (keyboard.IsKeyDown(Keys.Escape))
        {
            Exit();
            return;
        }

        var moveSpeed = 240f * (float)gameTime.ElapsedGameTime.TotalSeconds / Math.Max(_zoom, 0.25f);
        if (keyboard.IsKeyDown(Keys.Left) || keyboard.IsKeyDown(Keys.A))
        {
            _camera.X += moveSpeed;
        }
        if (keyboard.IsKeyDown(Keys.Right) || keyboard.IsKeyDown(Keys.D))
        {
            _camera.X -= moveSpeed;
        }
        if (keyboard.IsKeyDown(Keys.Up) || keyboard.IsKeyDown(Keys.W))
        {
            _camera.Y += moveSpeed;
        }
        if (keyboard.IsKeyDown(Keys.Down) || keyboard.IsKeyDown(Keys.S))
        {
            _camera.Y -= moveSpeed;
        }

        if (keyboard.IsKeyDown(Keys.OemPlus) || keyboard.IsKeyDown(Keys.Add))
        {
            _zoom = Math.Min(6f, _zoom + 1.25f * (float)gameTime.ElapsedGameTime.TotalSeconds);
        }
        if (keyboard.IsKeyDown(Keys.OemMinus) || keyboard.IsKeyDown(Keys.Subtract))
        {
            _zoom = Math.Max(0.5f, _zoom - 1.25f * (float)gameTime.ElapsedGameTime.TotalSeconds);
        }

        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new Color(18, 22, 30));
        if (_spriteBatch is null || _renderer is null || _scene is null)
        {
            base.Draw(gameTime);
            return;
        }

        var transform = Matrix.CreateTranslation(_camera.X, _camera.Y, 0f) * Matrix.CreateScale(_zoom, _zoom, 1f);
        _spriteBatch.Begin(transformMatrix: transform, samplerState: SamplerState.PointClamp);
        foreach (var room in _scene.Rooms.OrderBy((room) => room.Y).ThenBy((room) => room.X))
        {
            _renderer.DrawRoom(_spriteBatch, room, new Point(8, 8));
        }
        _spriteBatch.End();

        base.Draw(gameTime);
    }

    private static CelesteMapScene LoadScene()
    {
        var filePath = ResolveScenePath();
        var json = File.ReadAllText(filePath);
        return JsonSerializer.Deserialize<CelesteMapScene>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
        }) ?? new CelesteMapScene();
    }

    private static string ResolveScenePath()
    {
        var baseDirectory = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.GetFullPath(Path.Combine(baseDirectory, "..", "..", "..", "monogame-scene.json")),
            Path.GetFullPath(Path.Combine(baseDirectory, "..", "..", "..", "..", "monogame-scene.json")),
            Path.Combine(baseDirectory, "monogame-scene.json"),
        };

        foreach (var candidate in candidates)
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        throw new FileNotFoundException("Could not locate monogame-scene.json next to the exported compatibility bundle.");
    }
}
`;
}

function createMonoGameSampleReadme(): string {
    return `# MonoGame Sample Viewer

This sample project renders the exported room layout using the generated compatibility models.

## Run

1. Install the .NET 8 SDK.
2. From this folder, run \`dotnet restore\`.
3. Run \`dotnet run\`.

## Controls

- Arrow keys or WASD: pan
- Plus / Minus: zoom
- Escape: quit

The sample looks for \`monogame-scene.json\` in the exported bundle root.
`;
}

function createLoennLuaFiles(
    map: CelesteMap,
    modulePrefix: string,
    loennPluginPath?: string
): CompatibilityFile[] {
    const entityFiles = createLoennDefinitionFiles(
        map.rooms.flatMap((room) => room.entities),
        'entities',
        modulePrefix
    );
    const triggerFiles = createLoennDefinitionFiles(
        map.rooms.flatMap((room) => room.triggers),
        'triggers',
        modulePrefix
    );
    const importedPluginFiles = loadLoennPluginFiles(loennPluginPath);

    return mergeLoennFiles([...entityFiles, ...triggerFiles], importedPluginFiles);
}

function mergeLoennFiles(generatedFiles: CompatibilityFile[], importedPluginFiles: CompatibilityFile[]): CompatibilityFile[] {
    const merged = new Map<string, CompatibilityFile>();
    for (const file of generatedFiles) {
        merged.set(file.relativePath, file);
    }

    for (const file of importedPluginFiles) {
        merged.set(file.relativePath, file);
    }

    return Array.from(merged.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function loadLoennPluginFiles(loennPluginPath?: string): CompatibilityFile[] {
    if (!loennPluginPath) {
        return [];
    }

    const absoluteRoot = path.resolve(loennPluginPath);
    if (!fs.existsSync(absoluteRoot)) {
        return [];
    }

    const files: CompatibilityFile[] = [];
    const roots = ['entities', 'triggers', 'libraries', 'helpers'];
    for (const root of roots) {
        const absoluteDirectory = path.join(absoluteRoot, root);
        if (!fs.existsSync(absoluteDirectory) || !fs.statSync(absoluteDirectory).isDirectory()) {
            continue;
        }

        collectLuaFiles(absoluteRoot, absoluteDirectory, files);
    }

    return files;
}

function collectLuaFiles(pluginRoot: string, currentDirectory: string, files: CompatibilityFile[]): void {
    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
        const absolutePath = path.join(currentDirectory, entry.name);
        if (entry.isDirectory()) {
            collectLuaFiles(pluginRoot, absolutePath, files);
            continue;
        }

        if (!entry.isFile() || !entry.name.endsWith('.lua')) {
            continue;
        }

        const relativePath = path.relative(pluginRoot, absolutePath).split(path.sep).join('/');
        files.push({
            relativePath,
            content: fs.readFileSync(absolutePath, 'utf8'),
        });
    }
}

function createLoennDefinitionFiles(
    entries: readonly Entity[],
    kind: 'entities' | 'triggers',
    modulePrefix: string
): Array<{ relativePath: string; content: string }> {
    const groups = new Map<string, Entity[]>();
    for (const entry of entries) {
        const normalizedName = toLoennName(entry.name, modulePrefix);
        const bucket = groups.get(normalizedName);
        if (bucket) {
            bucket.push(entry);
        } else {
            groups.set(normalizedName, [entry]);
        }
    }

    return Array.from(groups.entries()).map(([name, instances]) => ({
        relativePath: `${kind}/${toLuaModulePath(name)}.lua`,
        content: renderLoennDefinitionLua(name, instances, kind === 'triggers' ? 'trigger' : 'entity'),
    }));
}

function renderLoennDefinitionLua(name: string, instances: readonly Entity[], variableName: 'entity' | 'trigger'): string {
    const metadata = buildLoennMetadata(name, instances);

    return `local ${variableName} = {}

${variableName}.name = ${toLuaLiteral(name)}
${metadata.texture ? `${variableName}.texture = ${toLuaLiteral(metadata.texture)}
` : ''}${metadata.justification ? `${variableName}.justification = ${toLuaLiteral(metadata.justification)}
` : ''}${metadata.depth !== undefined ? `${variableName}.depth = ${metadata.depth}
` : ''}${metadata.nodeLimits ? `${variableName}.nodeLimits = ${toLuaLiteral(metadata.nodeLimits)}
` : ''}${metadata.nodeLineRenderType ? `${variableName}.nodeLineRenderType = ${toLuaLiteral(metadata.nodeLineRenderType)}
` : ''}${metadata.canResize ? `${variableName}.canResize = ${toLuaLiteral(metadata.canResize)}
` : ''}${metadata.minimumSize ? `${variableName}.minimumSize = ${toLuaLiteral(metadata.minimumSize)}
` : ''}${metadata.rectangle ? `${variableName}.rectangle = true
` : ''}${variableName}.placements = ${toLuaPlacementList(metadata.placements, 0)}

${variableName}.fieldInformation = ${toLuaTableLiteral(metadata.fieldInformation, 0)}

return ${variableName}
`;
}

function buildLoennMetadata(name: string, instances: readonly Entity[]) {
    const heuristic = getCelesteLoennHeuristic(name);
    const inferredTexture = inferTexture(instances);
    const rectangle = heuristic.rectangle ?? instances.some((instance) => instance.width > 8 || instance.height > 8);
    const canResize = heuristic.canResize ?? rectangle;
    const minimumSize = heuristic.minimumSize ?? (rectangle
        ? [
            Math.max(8, Math.min(...instances.map((instance) => Math.max(instance.width || 8, 8)))),
            Math.max(8, Math.min(...instances.map((instance) => Math.max(instance.height || 8, 8)))),
        ]
        : undefined);
    const nodeCounts = instances.map((instance) => instance.nodes.length);
    const maxNodeCount = nodeCounts.length > 0 ? Math.max(...nodeCounts) : 0;
    const minNodeCount = nodeCounts.length > 0 ? Math.min(...nodeCounts) : 0;
    const fieldInformation = {
        ...heuristic.fieldInformation,
        ...inferFieldInformation(instances),
    };

    return {
        texture: heuristic.texture ?? inferredTexture,
        justification: heuristic.justification ?? (heuristic.texture || inferredTexture ? [0.5, 1.0] : undefined),
        depth: heuristic.depth ?? (heuristic.texture || inferredTexture ? 0 : undefined),
        rectangle,
        canResize,
        minimumSize,
        nodeLimits: heuristic.nodeLimits ?? (maxNodeCount > 0 ? [minNodeCount, maxNodeCount] : undefined),
        nodeLineRenderType: heuristic.nodeLineRenderType ?? (maxNodeCount > 0 ? 'line' : undefined),
        placements: buildLoennPlacements(instances),
        fieldInformation,
    };
}

function getCelesteLoennHeuristic(name: string): {
    texture?: string;
    justification?: [number, number];
    depth?: number;
    rectangle?: boolean;
    canResize?: boolean;
    minimumSize?: [number, number];
    nodeLimits?: [number, number];
    nodeLineRenderType?: string;
    fieldInformation?: Record<string, Record<string, unknown>>;
} {
    const baseName = name.split(/[\\/]+/).pop()?.toLowerCase() ?? name.toLowerCase();

    switch (baseName) {
        case 'strawberry':
            return { texture: 'collectables/strawberry/normal00' };
        case 'goldenberry':
            return { texture: 'collectables/goldberry/idle00' };
        case 'refill':
            return { texture: 'objects/refill/idle00' };
        case 'dashrefill':
            return { texture: 'objects/refillTwo/idle00' };
        case 'spring':
            return { texture: 'objects/spring/00' };
        case 'booster':
            return { texture: 'objects/booster/booster00' };
        case 'redbooster':
            return { texture: 'objects/booster/boosterRed00' };
        case 'cassette':
            return { texture: 'collectables/cassette/idle00' };
        case 'heartgem':
            return { texture: 'collectables/heartGem/0/00' };
        case 'spinner':
            return { texture: 'danger/crystal/fg_white00', depth: -8500 };
        case 'jumpthru':
            return {
                texture: 'objects/jumpthru/wood',
                rectangle: true,
                canResize: true,
                minimumSize: [8, 8],
                depth: -1300,
            };
        case 'dashblock':
        case 'fallingblock':
        case 'moveblock':
        case 'switchgate':
            return {
                rectangle: true,
                canResize: true,
                minimumSize: [16, 16],
            };
        case 'zipmover':
        case 'swapblock':
            return {
                rectangle: true,
                canResize: true,
                minimumSize: [16, 16],
                nodeLimits: [1, 1],
                nodeLineRenderType: 'line',
            };
        case 'spikesup':
        case 'spikesdown':
        case 'spikesleft':
        case 'spikesright':
            return {
                rectangle: true,
                canResize: true,
                minimumSize: [8, 8],
                fieldInformation: {
                    type: {
                        options: ['default', 'cliffside', 'reflection'],
                        editable: false,
                    },
                },
            };
        default:
            return {};
    }
}

function buildLoennPlacements(instances: readonly Entity[]): Array<{ name: string; data: Record<string, unknown> }> {
    const placements: Array<{ name: string; data: Record<string, unknown> }> = [];
    const seen = new Set<string>();

    for (const instance of instances) {
        const data = mergePlacementData(instance);
        const signature = JSON.stringify(data);
        if (seen.has(signature)) {
            continue;
        }

        seen.add(signature);
        placements.push({
            name: placements.length === 0 ? 'default' : `variant_${placements.length}`,
            data,
        });

        if (placements.length >= 4) {
            break;
        }
    }

    if (placements.length === 0) {
        placements.push({ name: 'default', data: {} });
    }

    return placements;
}

function mergePlacementData(instance: Entity): Record<string, unknown> {
    const data: Record<string, unknown> = { ...instance.attributes };

    if (instance.width > 0) {
        data.width = instance.width;
    }

    if (instance.height > 0) {
        data.height = instance.height;
    }

    return data;
}

function inferFieldInformation(instances: readonly Entity[]): Record<string, Record<string, unknown>> {
    const valueMap = new Map<string, unknown[]>();

    for (const instance of instances) {
        const data = mergePlacementData(instance);
        for (const [key, value] of Object.entries(data)) {
            const values = valueMap.get(key);
            if (values) {
                values.push(value);
            } else {
                valueMap.set(key, [value]);
            }
        }
    }

    const result: Record<string, Record<string, unknown>> = {};
    for (const [key, values] of valueMap.entries()) {
        const info = inferSingleFieldInformation(values);
        if (info) {
            result[key] = info;
        }
    }

    return result;
}

function inferSingleFieldInformation(values: readonly unknown[]): Record<string, unknown> | undefined {
    const uniqueValues = Array.from(new Set(values.map((value) => JSON.stringify(value)))).map((value) => JSON.parse(value));
    if (values.every((value) => typeof value === 'boolean')) {
        return {
            fieldType: 'boolean',
            options: uniqueValues,
        };
    }

    if (values.every((value) => typeof value === 'number')) {
        const allIntegers = values.every((value) => Number.isInteger(value));
        return {
            fieldType: allIntegers ? 'integer' : 'number',
            minimumValue: Math.min(...values.map((value) => Number(value))),
            maximumValue: Math.max(...values.map((value) => Number(value))),
        };
    }

    if (values.every((value) => typeof value === 'string')) {
        const stringValues = values as string[];
        if (stringValues.every(isColorLikeString)) {
            return { fieldType: 'color' };
        }

        if (uniqueValues.length > 1 && uniqueValues.length <= 12) {
            return {
                options: uniqueValues,
                editable: false,
            };
        }

        return { fieldType: 'string' };
    }

    return undefined;
}

function inferTexture(instances: readonly Entity[]): string | undefined {
    const textureKeys = ['texture', 'sprite', 'path', 'tiletype'];
    for (const instance of instances) {
        for (const key of textureKeys) {
            const value = instance.attributes[key];
            if (typeof value === 'string' && value.length > 0) {
                return normalizeTexture(value);
            }
        }
    }

    const normalizedName = instances[0]?.name ?? '';
    if (normalizedName.length === 0) {
        return undefined;
    }

    return `objects/${normalizedName.replace(/[:.]/g, '/').replace(/\\/g, '/')}`;
}

function normalizeTexture(value: string): string {
    const normalized = value.replace(/\\/g, '/').replace(/^atlas:/, '');
    return normalized.endsWith('.png') ? normalized.slice(0, -4) : normalized;
}

function isColorLikeString(value: string): boolean {
    return /^#?[0-9a-fA-F]{6,8}$/.test(value);
}

function toLuaPlacementList(
    placements: ReadonlyArray<{ name: string; data: Record<string, unknown> }>,
    indentLevel: number
): string {
    const indent = '    '.repeat(indentLevel);
    const childIndent = '    '.repeat(indentLevel + 1);
    const innerIndent = '    '.repeat(indentLevel + 2);

    return `{
${placements.map((placement) => `${childIndent}{
${innerIndent}name = ${toLuaLiteral(placement.name)},
${innerIndent}data = ${toLuaTableLiteral(placement.data, indentLevel + 2)}
${childIndent}}`).join(',\n')}
${indent}}`;
}

function mergeAttributeDefaults(instances: readonly Entity[]): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};

    for (const instance of instances) {
        for (const [key, value] of Object.entries(instance.attributes)) {
            if (!(key in defaults)) {
                defaults[key] = value;
            }
        }
    }

    return defaults;
}

function serializeRoomForMonoGame(room: Room) {
    return {
        name: room.name,
        x: room.x,
        y: room.y,
        width: room.width,
        height: room.height,
        tileWidth: room.tileWidth,
        tileHeight: room.tileHeight,
        music: room.music,
        altMusic: room.altMusic,
        ambience: room.ambience,
        windPattern: room.windPattern,
        color: room.color,
        dark: room.dark,
        underwater: room.underwater,
        space: room.space,
        disableDownTransition: room.disableDownTransition,
        cameraOffsetX: room.cameraOffsetX,
        cameraOffsetY: room.cameraOffsetY,
        tilesFg: serializeTileLayer(room.tilesFg),
        tilesBg: serializeTileLayer(room.tilesBg),
        entities: room.entities.map(serializeEntity),
        triggers: room.triggers.map(serializeTrigger),
        decalsFg: room.decalsFg.map(serializeDecal),
        decalsBg: room.decalsBg.map(serializeDecal),
    };
}

function serializeTileLayer(grid: TileGrid | null) {
    if (!grid) {
        return null;
    }

    return {
        width: grid.width,
        height: grid.height,
        rows: tileGridRows(grid),
    };
}

function tileGridRows(grid: TileGrid): string[] {
    const rows: string[] = [];
    for (let y = 0; y < grid.height; y++) {
        rows.push(grid.tiles.slice(y * grid.width, (y + 1) * grid.width).join(''));
    }
    return rows;
}

function serializeEntity(entity: Entity) {
    return {
        name: entity.name,
        id: entity.id,
        x: entity.x,
        y: entity.y,
        width: entity.width,
        height: entity.height,
        attributes: entity.attributes,
        nodes: entity.nodes.map((node) => ({ x: node.x, y: node.y })),
    };
}

function serializeTrigger(trigger: Trigger) {
    return serializeEntity(trigger);
}

function serializeDecal(decal: Decal) {
    return {
        texture: decal.texture,
        x: decal.x,
        y: decal.y,
        scaleX: decal.scaleX,
        scaleY: decal.scaleY,
        rotation: decal.rotation,
        color: decal.color,
    };
}

function serializeFiller(filler: Filler) {
    return {
        x: filler.x,
        y: filler.y,
        width: filler.width,
        height: filler.height,
    };
}

function serializeStyleEntry(style: StyleEntry) {
    return {
        type: style.type,
        data: style,
    };
}

function toLoennName(rawName: string, modulePrefix: string): string {
    if (rawName.includes('/')) {
        return rawName;
    }

    return `${sanitizeLuaSegment(modulePrefix)}/${sanitizeLuaSegment(rawName)}`;
}

function toLuaModulePath(name: string): string {
    return name
        .split(/[\\/]+/)
        .map(sanitizeLuaSegment)
        .filter((segment) => segment.length > 0)
        .join('/');
}

function sanitizeLuaSegment(value: string): string {
    return value
        .replace(/[^A-Za-z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'generated';
}

function toLuaTableLiteral(value: Record<string, unknown>, indentLevel: number): string {
    const entries = Object.entries(value);
    if (entries.length === 0) {
        return '{}';
    }

    const indent = '    '.repeat(indentLevel);
    const childIndent = '    '.repeat(indentLevel + 1);
    const lines = entries.map(([key, entryValue]) => `${childIndent}${key} = ${toLuaLiteral(entryValue)}`);
    return `{
${lines.join(',\n')}
${indent}}`;
}

function toLuaLiteral(value: unknown): string {
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (value === null || value === undefined) {
        return 'nil';
    }

    if (Array.isArray(value)) {
        const items = value.map((item) => toLuaLiteral(item)).join(', ');
        return `{ ${items} }`;
    }

    if (typeof value === 'object') {
        return toLuaTableLiteral(value as Record<string, unknown>, 0);
    }

    return JSON.stringify(String(value));
}