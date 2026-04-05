using System.Text.Json;
using Microsoft.Xna.Framework;

namespace CelesteMapMonoGameInterop;

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
    public Dictionary<string, JsonElement> Attributes { get; set; } = new();
    public List<CelesteNodeScene> Nodes { get; set; } = new();

    public Rectangle Bounds => new(X, Y, Math.Max(Width, 8), Math.Max(Height, 8));
}

public sealed class CelesteNodeScene
{
    public int X { get; set; }
    public int Y { get; set; }
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
}

public sealed class CelesteStyleCollection
{
    public List<CelesteStyleScene> Foregrounds { get; set; } = new();
    public List<CelesteStyleScene> Backgrounds { get; set; } = new();
}

public sealed class CelesteStyleScene
{
    public string Type { get; set; } = string.Empty;
    public Dictionary<string, JsonElement> Data { get; set; } = new();
}