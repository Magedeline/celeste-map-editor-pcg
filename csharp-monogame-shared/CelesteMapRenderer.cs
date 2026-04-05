using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace CelesteMapMonoGameInterop;

public sealed class CelesteMapRenderer : IDisposable
{
    private readonly Texture2D _pixel;

    public CelesteMapRenderer(GraphicsDevice graphicsDevice)
    {
        _pixel = new Texture2D(graphicsDevice, 1, 1);
        _pixel.SetData(new[] { Color.White });
    }

    public void Dispose()
    {
        _pixel.Dispose();
    }

    public void DrawScene(SpriteBatch spriteBatch, CelesteMapScene scene, Point tileSize, int selectedRoomIndex = -1)
    {
        for (var index = 0; index < scene.Rooms.Count; index++)
        {
            var room = scene.Rooms[index];
            DrawRoom(spriteBatch, room, tileSize, index == selectedRoomIndex);
        }

        foreach (var filler in scene.Fillers)
        {
            FillRect(spriteBatch, filler.Bounds, new Color(140, 120, 180, 28));
            DrawOutline(spriteBatch, filler.Bounds, new Color(140, 120, 180, 96), 1);
        }
    }

    public void DrawRoom(SpriteBatch spriteBatch, CelesteRoomScene room, Point tileSize, bool selected)
    {
        if (room.TilesBg is not null)
        {
            DrawTileLayer(spriteBatch, room.TilesBg, room.X, room.Y, tileSize, 0.35f);
        }

        if (room.TilesFg is not null)
        {
            DrawTileLayer(spriteBatch, room.TilesFg, room.X, room.Y, tileSize, 0.95f);
        }

        foreach (var entity in room.Entities)
        {
            FillRect(spriteBatch, new Rectangle(room.X + entity.X, room.Y + entity.Y, Math.Max(entity.Width, 8), Math.Max(entity.Height, 8)), new Color(80, 200, 120, 168));
        }

        foreach (var trigger in room.Triggers)
        {
            FillRect(spriteBatch, new Rectangle(room.X + trigger.X, room.Y + trigger.Y, Math.Max(trigger.Width, 8), Math.Max(trigger.Height, 8)), new Color(220, 150, 40, 112));
        }

        var outlineColor = selected ? new Color(255, 214, 10) : RoomOutlineColor(room.Color);
        if (selected)
        {
            FillRect(spriteBatch, room.Bounds, new Color(255, 214, 10, 28));
        }

        DrawOutline(spriteBatch, room.Bounds, outlineColor, selected ? 3 : 2);
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

                var destination = new Rectangle(offsetX + x * tileSize.X, offsetY + y * tileSize.Y, tileSize.X, tileSize.Y);
                FillRect(spriteBatch, destination, TileColor(tile) * alpha);
            }
        }
    }

    public void DrawGrid(SpriteBatch spriteBatch, Rectangle bounds, int tileSize)
    {
        for (var x = bounds.Left; x <= bounds.Right; x += tileSize)
        {
            FillRect(spriteBatch, new Rectangle(x, bounds.Top, 1, bounds.Height), new Color(255, 255, 255, 22));
        }

        for (var y = bounds.Top; y <= bounds.Bottom; y += tileSize)
        {
            FillRect(spriteBatch, new Rectangle(bounds.Left, y, bounds.Width, 1), new Color(255, 255, 255, 22));
        }
    }

    public void FillRect(SpriteBatch spriteBatch, Rectangle rectangle, Color color)
    {
        spriteBatch.Draw(_pixel, rectangle, color);
    }

    public void DrawOutline(SpriteBatch spriteBatch, Rectangle rectangle, Color color, int thickness)
    {
        FillRect(spriteBatch, new Rectangle(rectangle.Left, rectangle.Top, rectangle.Width, thickness), color);
        FillRect(spriteBatch, new Rectangle(rectangle.Left, rectangle.Bottom - thickness, rectangle.Width, thickness), color);
        FillRect(spriteBatch, new Rectangle(rectangle.Left, rectangle.Top, thickness, rectangle.Height), color);
        FillRect(spriteBatch, new Rectangle(rectangle.Right - thickness, rectangle.Top, thickness, rectangle.Height), color);
    }

    private static Color RoomOutlineColor(int roomColor) => roomColor switch
    {
        0 => new Color(222, 184, 135),
        1 => new Color(140, 200, 230),
        2 => new Color(160, 216, 140),
        3 => new Color(234, 234, 234),
        4 => new Color(178, 178, 194),
        5 => new Color(240, 186, 120),
        6 => new Color(210, 130, 120),
        7 => new Color(255, 215, 100),
        _ => new Color(180, 180, 180),
    };

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
}