using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Linq;
using System.Windows.Forms;

namespace CelestePcgLauncher;

internal sealed class MapPreviewPanel : Panel
{
    internal const string PreviewModeCombined = "combined";
    internal const string PreviewModeRooms = "rooms";
    internal const string PreviewModeTopology = "topology";
    internal const string OverlayModeAll = "all";
    internal const string OverlayModePhase = "phase";
    internal const string OverlayModeRole = "role";

    private const float TileSize = 8f;
    private const float MinZoom = 0.35f;
    private const float MaxZoom = 5f;
    private const int SideDoorHeight = 4;
    private const int TopDoorWidth = 4;

    private CelesteMapData? _map;
    private LauncherKitDescriptor _selectedKit = LauncherKitCatalog.Get("house");
    private string _layoutMode = "grid";
    private string _previewMode = PreviewModeCombined;
    private string _overlayMode = OverlayModeAll;
    private string _statusText = "Generate a preview to inspect the room cluster before export.";
    private float _zoom = 1f;
    private PointF _pan = PointF.Empty;
    private bool _isPanning;
    private Point _lastMousePoint;

    public bool HasPreview => _map is not null && _map.Rooms.Count > 0;

    public MapPreviewPanel()
    {
        DoubleBuffered = true;
        ResizeRedraw = true;
        SetStyle(ControlStyles.Selectable, true);
        TabStop = true;
        BackColor = Color.FromArgb(12, 15, 21);
        Cursor = Cursors.Hand;
    }

    public void SetPreviewMap(CelesteMapData map, LauncherKitDescriptor kit, string layoutMode)
    {
        _map = map;
        _selectedKit = kit;
        _layoutMode = string.IsNullOrWhiteSpace(layoutMode) ? "grid" : layoutMode;
        _statusText = string.Empty;
        ResetView();
    }

    public void SetSelectedKitTheme(LauncherKitDescriptor kit)
    {
        _selectedKit = kit;
        Invalidate();
    }

    public void SetLayoutMode(string? layoutMode)
    {
        _layoutMode = string.IsNullOrWhiteSpace(layoutMode) ? "grid" : layoutMode;
        Invalidate();
    }

    public void SetPreviewMode(string? previewMode)
    {
        _previewMode = previewMode switch
        {
            PreviewModeRooms => PreviewModeRooms,
            PreviewModeTopology => PreviewModeTopology,
            _ => PreviewModeCombined,
        };
        Invalidate();
    }

    public void SetOverlayMode(string? overlayMode)
    {
        _overlayMode = overlayMode switch
        {
            OverlayModePhase => OverlayModePhase,
            OverlayModeRole => OverlayModeRole,
            _ => OverlayModeAll,
        };
        Invalidate();
    }

    public void SetStatus(string statusText)
    {
        _map = null;
        _statusText = statusText;
        Invalidate();
    }

    public void ResetView()
    {
        _zoom = 1f;
        _pan = PointF.Empty;
        Invalidate();
    }

    public void ZoomIn()
    {
        AdjustZoom(1.12f, new PointF(ClientSize.Width * 0.5f, ClientSize.Height * 0.5f));
    }

    public void ZoomOut()
    {
        AdjustZoom(0.89f, new PointF(ClientSize.Width * 0.5f, ClientSize.Height * 0.5f));
    }

    public void PanBy(float deltaX, float deltaY)
    {
        if (!HasPreview)
        {
            return;
        }

        _pan = new PointF(_pan.X + deltaX, _pan.Y + deltaY);
        Invalidate();
    }

    protected override void OnMouseWheel(MouseEventArgs error)
    {
        base.OnMouseWheel(error);

        AdjustZoom(error.Delta > 0 ? 1.12f : 0.89f, error.Location);
    }

    protected override void OnMouseDown(MouseEventArgs error)
    {
        base.OnMouseDown(error);
        Focus();
        if (_map is null || error.Button != MouseButtons.Left)
        {
            return;
        }

        _isPanning = true;
        _lastMousePoint = error.Location;
        Cursor = Cursors.SizeAll;
    }

    protected override void OnMouseMove(MouseEventArgs error)
    {
        base.OnMouseMove(error);
        if (!_isPanning)
        {
            return;
        }

        _pan = new PointF(_pan.X + error.X - _lastMousePoint.X, _pan.Y + error.Y - _lastMousePoint.Y);
        _lastMousePoint = error.Location;
        Invalidate();
    }

    protected override void OnMouseUp(MouseEventArgs error)
    {
        base.OnMouseUp(error);
        _isPanning = false;
        Cursor = Cursors.Hand;
    }

    protected override void OnDoubleClick(EventArgs error)
    {
        base.OnDoubleClick(error);
        ResetView();
    }

    protected override bool IsInputKey(Keys keyData)
    {
        var keyCode = keyData & Keys.KeyCode;
        return keyCode is Keys.Left or Keys.Right or Keys.Up or Keys.Down or Keys.Add or Keys.Subtract or Keys.Oemplus or Keys.OemMinus
            || base.IsInputKey(keyData);
    }

    protected override void OnKeyDown(KeyEventArgs error)
    {
        base.OnKeyDown(error);
        if (!HasPreview)
        {
            return;
        }

        switch (error.KeyCode)
        {
            case Keys.Add:
            case Keys.Oemplus:
                ZoomIn();
                error.Handled = true;
                break;
            case Keys.Subtract:
            case Keys.OemMinus:
                ZoomOut();
                error.Handled = true;
                break;
            case Keys.Left:
                PanBy(36f, 0f);
                error.Handled = true;
                break;
            case Keys.Right:
                PanBy(-36f, 0f);
                error.Handled = true;
                break;
            case Keys.Up:
                PanBy(0f, 36f);
                error.Handled = true;
                break;
            case Keys.Down:
                PanBy(0f, -36f);
                error.Handled = true;
                break;
            case Keys.D0 when error.Control:
            case Keys.NumPad0 when error.Control:
                ResetView();
                error.Handled = true;
                break;
        }
    }

    protected override void OnPaint(PaintEventArgs error)
    {
        base.OnPaint(error);

        error.Graphics.Clear(_selectedKit.BackgroundColor);
        error.Graphics.SmoothingMode = SmoothingMode.HighQuality;
        error.Graphics.InterpolationMode = InterpolationMode.NearestNeighbor;
        error.Graphics.PixelOffsetMode = PixelOffsetMode.Half;

        if (_map is null || _map.Rooms.Count == 0)
        {
            DrawCenteredText(error.Graphics, _statusText);
            return;
        }

        var topology = BuildPreviewTopology(_map);
        var viewBounds = GetViewBounds(_map, topology);
        var mapWidth = Math.Max(1f, viewBounds.Width);
        var mapHeight = Math.Max(1f, viewBounds.Height);
        var margin = 30f;
        var viewportWidth = Math.Max(1f, ClientSize.Width - margin * 2f);
        var viewportHeight = Math.Max(1f, ClientSize.Height - margin * 2f);
        var fitScale = Math.Min(viewportWidth / mapWidth, viewportHeight / mapHeight);
        var scale = fitScale * _zoom;
        var baseOffsetX = margin + (viewportWidth - mapWidth * fitScale) * 0.5f;
        var baseOffsetY = margin + (viewportHeight - mapHeight * fitScale) * 0.5f;
        var offsetX = baseOffsetX + _pan.X;
        var offsetY = baseOffsetY + _pan.Y;

        using var gridPen = new Pen(Color.FromArgb(32, _selectedKit.GlowColor), 1f);
        using var roomBorderPen = new Pen(Color.FromArgb(220, _selectedKit.AccentColor), 1.2f);
        using var labelBrush = new SolidBrush(Color.FromArgb(232, 242, 246, 252));
        using var worldBrush = new SolidBrush(Color.FromArgb(52, _selectedKit.SurfaceColor));
        using var shadowBrush = new SolidBrush(Color.FromArgb(36, 0, 0, 0));
        var brushCache = new Dictionary<int, SolidBrush>();

        try
        {
            var worldRect = new RectangleF(offsetX, offsetY, mapWidth * scale, mapHeight * scale);
            error.Graphics.FillRectangle(shadowBrush, worldRect.X + 10f, worldRect.Y + 10f, worldRect.Width, worldRect.Height);
            error.Graphics.FillRectangle(worldBrush, worldRect);

            for (var stripeX = worldRect.Left; stripeX < worldRect.Right; stripeX += 128f * scale)
            {
                error.Graphics.DrawLine(gridPen, stripeX, worldRect.Top, stripeX, worldRect.Bottom);
            }

            for (var stripeY = worldRect.Top; stripeY < worldRect.Bottom; stripeY += 128f * scale)
            {
                error.Graphics.DrawLine(gridPen, worldRect.Left, stripeY, worldRect.Right, stripeY);
            }

            if (_previewMode is PreviewModeCombined or PreviewModeRooms)
            {
                foreach (var room in _map.Rooms)
                {
                    var roomRect = new RectangleF(
                        offsetX + (room.X - viewBounds.MinX) * scale,
                        offsetY + (room.Y - viewBounds.MinY) * scale,
                        room.Width * scale,
                        room.Height * scale);

                    using var roomFillBrush = new SolidBrush(Color.FromArgb(64, GetRoomColor(room.Color, _selectedKit)));
                    error.Graphics.FillRectangle(roomFillBrush, roomRect);
                    DrawTileGrid(error.Graphics, room.TilesBg, room, viewBounds.MinX, viewBounds.MinY, offsetX, offsetY, scale, 88, brushCache);
                    DrawTileGrid(error.Graphics, room.TilesFg, room, viewBounds.MinX, viewBounds.MinY, offsetX, offsetY, scale, 228, brushCache);
                    DrawEntities(error.Graphics, room, viewBounds.MinX, viewBounds.MinY, offsetX, offsetY, scale);
                    error.Graphics.DrawRectangle(roomBorderPen, roomRect.X, roomRect.Y, roomRect.Width, roomRect.Height);

                    if (roomRect.Width >= 92f && roomRect.Height >= 28f)
                    {
                        var labelRect = new RectangleF(roomRect.X + 7f, roomRect.Y + 5f, roomRect.Width - 12f, 20f);
                        error.Graphics.DrawString(room.Name, Font, labelBrush, labelRect);
                    }
                }
            }

            if (_previewMode is PreviewModeCombined or PreviewModeTopology)
            {
                DrawTopologyOverlay(error.Graphics, topology, viewBounds.MinX, viewBounds.MinY, offsetX, offsetY, scale);
            }
            DrawHud(error.Graphics, topology, scale);
        }
        finally
        {
            foreach (var brush in brushCache.Values)
            {
                brush.Dispose();
            }
        }
    }

    private void DrawHud(Graphics graphics, PreviewTopology topology, float effectiveScale)
    {
        using var hudTextBrush = new SolidBrush(Color.FromArgb(220, 232, 236, 242));
        using var hudMutedBrush = new SolidBrush(Color.FromArgb(180, 182, 191, 205));
        using var hudPanelBrush = new SolidBrush(Color.FromArgb(182, 7, 10, 16));
        using var accentBrush = new SolidBrush(_selectedKit.AccentColor);
        using var bgBrush = new SolidBrush(Color.FromArgb(200, 78, 114, 186));
        using var fgBrush = new SolidBrush(Color.FromArgb(220, 224, 194, 104));
        using var playerBrush = new SolidBrush(Color.FromArgb(96, 214, 126));
        using var berryBrush = new SolidBrush(Color.FromArgb(234, 72, 106));

        var topRect = new RectangleF(14f, 14f, 304f, 52f);
        graphics.FillRectangle(hudPanelBrush, topRect);
        graphics.FillRectangle(accentBrush, topRect.X + 10f, topRect.Y + 10f, 10f, 10f);
        graphics.DrawString(_selectedKit.Title, Font, hudTextBrush, topRect.X + 28f, topRect.Y + 7f);
        graphics.DrawString($"{GetLayoutTitle()}   {GetPreviewModeTitle()}   {GetOverlayModeTitle()}   Rooms: {_map?.Rooms.Count ?? 0}", Font, hudMutedBrush, topRect.X + 12f, topRect.Y + 28f);
        graphics.DrawString($"{effectiveScale * 100f:0.#}%", Font, hudMutedBrush, topRect.Right - 46f, topRect.Y + 7f);

        var legendRect = new RectangleF(14f, ClientSize.Height - 138f, 348f, 120f);
        graphics.FillRectangle(hudPanelBrush, legendRect);
        graphics.DrawString("Legend", Font, hudTextBrush, legendRect.X + 12f, legendRect.Y + 8f);
        DrawLegendSwatch(graphics, bgBrush, "BG", legendRect.X + 12f, legendRect.Y + 31f, hudTextBrush);
        DrawLegendSwatch(graphics, fgBrush, "FG", legendRect.X + 74f, legendRect.Y + 31f, hudTextBrush);
        DrawLegendSwatch(graphics, playerBrush, "Player", legendRect.X + 136f, legendRect.Y + 31f, hudTextBrush);
        DrawLegendSwatch(graphics, berryBrush, "Goal", legendRect.X + 220f, legendRect.Y + 31f, hudTextBrush);
        DrawLegendLine(graphics, Color.FromArgb(242, 255, 222, 106), "Main route", legendRect.X + 12f, legendRect.Y + 54f, hudTextBrush);
        DrawLegendLine(graphics, Color.FromArgb(190, 145, 204, 255), topology.HasOverlay ? "Branch links" : "Room links", legendRect.X + 150f, legendRect.Y + 54f, hudTextBrush);
        DrawLegendSwatch(graphics, GetPhaseColor("intro"), "Intro", legendRect.X + 12f, legendRect.Y + 74f, hudTextBrush);
        DrawLegendSwatch(graphics, GetPhaseColor("build"), "Build", legendRect.X + 74f, legendRect.Y + 74f, hudTextBrush);
        DrawLegendSwatch(graphics, GetPhaseColor("checkpoint"), "Check", legendRect.X + 136f, legendRect.Y + 74f, hudTextBrush);
        DrawLegendSwatch(graphics, GetPhaseColor("escalation"), "Esc", legendRect.X + 208f, legendRect.Y + 74f, hudTextBrush);
        DrawLegendSquare(graphics, Color.FromArgb(90, 180, 215, 255), "Branch", legendRect.X + 12f, legendRect.Y + 95f, hudTextBrush);
        DrawLegendDiamond(graphics, Color.FromArgb(245, 216, 92), "Reward", legendRect.X + 92f, legendRect.Y + 95f, hudTextBrush);
        DrawLegendRing(graphics, Color.FromArgb(255, 170, 84), "Setpiece", legendRect.X + 176f, legendRect.Y + 95f, hudTextBrush);
        DrawLegendDiamond(graphics, Color.FromArgb(181, 132, 255), "Knot", legendRect.X + 270f, legendRect.Y + 95f, hudTextBrush);
    }

    private void DrawTopologyOverlay(Graphics graphics, PreviewTopology topology, float minX, float minY, float offsetX, float offsetY, float scale)
    {
        if (!topology.HasOverlay)
        {
            return;
        }

        using var branchPen = new Pen(Color.FromArgb(126, 145, 204, 255), Math.Max(2f, scale * 0.12f))
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
        };
        using var mainPathPen = new Pen(Color.FromArgb(246, 255, 222, 106), Math.Max(3.4f, scale * 0.18f))
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
        };
        using var startBrush = new SolidBrush(Color.FromArgb(102, 222, 132));
        using var goalBrush = new SolidBrush(Color.FromArgb(236, 88, 120));
        using var checkpointBrush = new SolidBrush(Color.FromArgb(111, 185, 255));
        using var hubBrush = new SolidBrush(Color.FromArgb(194, 154, 255));
        using var branchOverlayBrush = new SolidBrush(Color.FromArgb(70, 180, 215, 255));
        using var rewardOverlayBrush = new SolidBrush(Color.FromArgb(245, 216, 92));
        using var setpieceOverlayPen = new Pen(Color.FromArgb(255, 170, 84), 2f);
        using var knotOverlayPen = new Pen(Color.FromArgb(181, 132, 255), 2f);
        using var markerPen = new Pen(Color.FromArgb(230, 245, 247, 250), 1.2f);

        foreach (var edge in topology.AllEdges)
        {
            var fromCenter = GetRoomCenter(edge.From, minX, minY, offsetX, offsetY, scale);
            var toCenter = GetRoomCenter(edge.To, minX, minY, offsetX, offsetY, scale);
            graphics.DrawLine(branchPen, fromCenter, toCenter);
        }

        foreach (var edge in topology.MainPathEdges)
        {
            var fromCenter = GetRoomCenter(edge.From, minX, minY, offsetX, offsetY, scale);
            var toCenter = GetRoomCenter(edge.To, minX, minY, offsetX, offsetY, scale);
            graphics.DrawLine(mainPathPen, fromCenter, toCenter);
        }

        if (_overlayMode is OverlayModeAll or OverlayModePhase)
        {
            foreach (var entry in topology.PhaseByRoom)
            {
                using var phaseBrush = new SolidBrush(GetPhaseColor(entry.Value));
                var radius = Math.Max(5.5f, scale * 0.16f);
                DrawMarker(graphics, phaseBrush, markerPen, GetRoomCenter(entry.Key, minX, minY, offsetX, offsetY, scale), radius);
            }
        }

        if (_overlayMode is OverlayModeAll or OverlayModeRole)
        {
            foreach (var room in topology.BranchRooms)
            {
                DrawSquareMarker(graphics, branchOverlayBrush, markerPen, GetRoomCenter(room, minX, minY, offsetX, offsetY, scale), Math.Max(5f, scale * 0.15f));
            }

            foreach (var room in topology.RewardRooms)
            {
                DrawDiamondMarker(graphics, rewardOverlayBrush, markerPen, GetRoomCenter(room, minX, minY, offsetX, offsetY, scale), Math.Max(6.5f, scale * 0.18f));
            }

            foreach (var room in topology.SetpieceRooms)
            {
                DrawRingMarker(graphics, setpieceOverlayPen, GetRoomCenter(room, minX, minY, offsetX, offsetY, scale), Math.Max(8f, scale * 0.22f));
            }

            foreach (var room in topology.KnotRooms)
            {
                DrawDiamondOutlineMarker(graphics, knotOverlayPen, GetRoomCenter(room, minX, minY, offsetX, offsetY, scale), Math.Max(8f, scale * 0.21f));
            }

            foreach (var room in topology.HubRooms)
            {
                DrawMarker(graphics, hubBrush, markerPen, GetRoomCenter(room, minX, minY, offsetX, offsetY, scale), Math.Max(8f, scale * 0.22f));
            }

            foreach (var room in topology.CheckpointRooms)
            {
                DrawMarker(graphics, checkpointBrush, markerPen, GetRoomCenter(room, minX, minY, offsetX, offsetY, scale), Math.Max(7f, scale * 0.2f));
            }

            if (topology.StartRoom is not null)
            {
                DrawMarker(graphics, startBrush, markerPen, GetRoomCenter(topology.StartRoom, minX, minY, offsetX, offsetY, scale), Math.Max(9f, scale * 0.24f));
            }

            if (topology.GoalRoom is not null)
            {
                DrawMarker(graphics, goalBrush, markerPen, GetRoomCenter(topology.GoalRoom, minX, minY, offsetX, offsetY, scale), Math.Max(9f, scale * 0.24f));
            }
        }
    }

    private void AdjustZoom(float factor, PointF focalPoint)
    {
        if (!HasPreview)
        {
            return;
        }

        var previousZoom = _zoom;
        _zoom = Math.Clamp(_zoom * factor, MinZoom, MaxZoom);
        if (Math.Abs(_zoom - previousZoom) < 0.001f)
        {
            return;
        }

        var zoomRatio = _zoom / previousZoom;
        _pan = new PointF(
            focalPoint.X - (focalPoint.X - _pan.X) * zoomRatio,
            focalPoint.Y - (focalPoint.Y - _pan.Y) * zoomRatio);
        Invalidate();
    }

    private static void DrawLegendSwatch(Graphics graphics, Brush brush, string text, float x, float y, Brush textBrush)
    {
        var legendFont = SystemFonts.MessageBoxFont ?? Control.DefaultFont;
        graphics.FillRectangle(brush, x, y + 3f, 12f, 12f);
        graphics.DrawString(text, legendFont, textBrush, x + 18f, y);
    }

    private static void DrawLegendSwatch(Graphics graphics, Color color, string text, float x, float y, Brush textBrush)
    {
        using var brush = new SolidBrush(color);
        DrawLegendSwatch(graphics, brush, text, x, y, textBrush);
    }

    private static void DrawLegendLine(Graphics graphics, Color color, string text, float x, float y, Brush textBrush)
    {
        using var legendPen = new Pen(color, 3f) { StartCap = LineCap.Round, EndCap = LineCap.Round };
        graphics.DrawLine(legendPen, x, y + 9f, x + 12f, y + 9f);
        graphics.DrawString(text, SystemFonts.MessageBoxFont ?? Control.DefaultFont, textBrush, x + 18f, y);
    }

    private static void DrawLegendSquare(Graphics graphics, Color color, string text, float x, float y, Brush textBrush)
    {
        using var brush = new SolidBrush(color);
        using var outlinePen = new Pen(Color.FromArgb(230, 245, 247, 250), 1.2f);
        DrawSquareMarker(graphics, brush, outlinePen, new PointF(x + 6f, y + 9f), 6f);
        graphics.DrawString(text, SystemFonts.MessageBoxFont ?? Control.DefaultFont, textBrush, x + 18f, y);
    }

    private static void DrawLegendDiamond(Graphics graphics, Color color, string text, float x, float y, Brush textBrush)
    {
        using var brush = new SolidBrush(color);
        using var outlinePen = new Pen(Color.FromArgb(230, 245, 247, 250), 1.2f);
        DrawDiamondMarker(graphics, brush, outlinePen, new PointF(x + 6f, y + 9f), 6f);
        graphics.DrawString(text, SystemFonts.MessageBoxFont ?? Control.DefaultFont, textBrush, x + 18f, y);
    }

    private static void DrawLegendRing(Graphics graphics, Color color, string text, float x, float y, Brush textBrush)
    {
        using var ringPen = new Pen(color, 2f);
        DrawRingMarker(graphics, ringPen, new PointF(x + 6f, y + 9f), 6f);
        graphics.DrawString(text, SystemFonts.MessageBoxFont ?? Control.DefaultFont, textBrush, x + 18f, y);
    }

    private static Color GetPhaseColor(string? phase)
    {
        return phase switch
        {
            "intro" => Color.FromArgb(82, 200, 154),
            "build" => Color.FromArgb(105, 170, 255),
            "checkpoint" => Color.FromArgb(141, 118, 255),
            "escalation" => Color.FromArgb(255, 179, 72),
            "finale" => Color.FromArgb(244, 92, 122),
            "reward" => Color.FromArgb(245, 216, 92),
            _ => Color.FromArgb(124, 143, 168),
        };
    }

    private static void DrawTileGrid(
        Graphics graphics,
        TileGridData? grid,
        RoomData room,
        float minX,
        float minY,
        float offsetX,
        float offsetY,
        float scale,
        int alpha,
        Dictionary<int, SolidBrush> brushCache)
    {
        if (grid is null || grid.Width <= 0 || grid.Height <= 0)
        {
            return;
        }

        var scaledTileSize = TileSize * scale;
        if (scaledTileSize <= 0.15f)
        {
            return;
        }

        for (var index = 0; index < grid.Tiles.Count; index++)
        {
            var tile = grid.Tiles[index];
            if (tile == '0')
            {
                continue;
            }

            var tileColor = Color.FromArgb(alpha, GetTileColor(tile));
            if (!brushCache.TryGetValue(tileColor.ToArgb(), out var brush))
            {
                brush = new SolidBrush(tileColor);
                brushCache.Add(tileColor.ToArgb(), brush);
            }

            var tileX = index % grid.Width;
            var tileY = index / grid.Width;
            var drawX = offsetX + (room.X - minX + tileX * TileSize) * scale;
            var drawY = offsetY + (room.Y - minY + tileY * TileSize) * scale;
            graphics.FillRectangle(brush, drawX, drawY, Math.Max(1f, scaledTileSize), Math.Max(1f, scaledTileSize));
        }
    }

    private static void DrawEntities(Graphics graphics, RoomData room, float minX, float minY, float offsetX, float offsetY, float scale)
    {
        foreach (var entity in room.Entities)
        {
            var color = entity.Name switch
            {
                "player" => Color.FromArgb(96, 214, 126),
                "strawberry" => Color.FromArgb(234, 72, 106),
                "spring" => Color.FromArgb(244, 190, 77),
                "refill" => Color.FromArgb(88, 226, 255),
                "spikesUp" => Color.FromArgb(255, 146, 104),
                "spikesDown" => Color.FromArgb(255, 146, 104),
                "spikesLeft" => Color.FromArgb(255, 146, 104),
                "spikesRight" => Color.FromArgb(255, 146, 104),
                _ => Color.FromArgb(111, 185, 255),
            };

            var size = Math.Max(4f, 10f * scale);
            var drawX = offsetX + (room.X - minX + entity.X) * scale - size * 0.5f;
            var drawY = offsetY + (room.Y - minY + entity.Y) * scale - size * 0.5f;

            using var brush = new SolidBrush(color);
            using var pen = new Pen(Color.FromArgb(220, 255, 255, 255), 1f);
            graphics.FillEllipse(brush, drawX, drawY, size, size);
            graphics.DrawEllipse(pen, drawX, drawY, size, size);
        }
    }

    private void DrawCenteredText(Graphics graphics, string text)
    {
        using var brush = new SolidBrush(Color.FromArgb(220, 224, 228, 234));
        using var format = new StringFormat
        {
            Alignment = StringAlignment.Center,
            LineAlignment = StringAlignment.Center,
        };
        graphics.DrawString(text, Font, brush, ClientRectangle, format);
    }

    private static Color GetRoomColor(int roomColor, LauncherKitDescriptor kit)
    {
        Color[] colors =
        [
            kit.AccentColor,
            kit.GlowColor,
            Color.FromArgb(57, 90, 94),
            Color.FromArgb(137, 78, 54),
            Color.FromArgb(80, 115, 58),
            Color.FromArgb(120, 58, 94),
            Color.FromArgb(54, 84, 123),
            Color.FromArgb(128, 96, 46),
        ];

        var normalizedIndex = Math.Abs(roomColor) % colors.Length;
        return colors[normalizedIndex];
    }

    private static Color GetTileColor(char tile)
    {
        return tile switch
        {
            '1' => Color.FromArgb(67, 86, 126),
            '2' => Color.FromArgb(116, 70, 70),
            '3' => Color.FromArgb(139, 118, 196),
            '4' => Color.FromArgb(197, 112, 71),
            '5' => Color.FromArgb(153, 150, 117),
            '6' => Color.FromArgb(84, 140, 102),
            '7' => Color.FromArgb(90, 95, 108),
            '8' => Color.FromArgb(77, 122, 129),
            '9' => Color.FromArgb(138, 106, 72),
            'a' => Color.FromArgb(209, 180, 80),
            'b' => Color.FromArgb(104, 104, 128),
            'c' => Color.FromArgb(219, 128, 171),
            'd' => Color.FromArgb(245, 194, 116),
            'e' => Color.FromArgb(131, 219, 205),
            'f' => Color.FromArgb(182, 182, 194),
            _ => Color.FromArgb(140, 140, 140),
        };
    }

    private string GetLayoutTitle()
    {
        return _layoutMode switch
        {
            "criticalPath" => "Critical Path",
            "criticalPathBranches" => "Path + Branches",
            "openSkeleton" => "Open Skeleton",
            _ => "Grid",
        };
    }

    private string GetPreviewModeTitle()
    {
        return _previewMode switch
        {
            PreviewModeRooms => "Rooms",
            PreviewModeTopology => "Topology Fit",
            _ => "Combined",
        };
    }

    private string GetOverlayModeTitle()
    {
        return _overlayMode switch
        {
            OverlayModePhase => "Phase Overlay",
            OverlayModeRole => "Role Overlay",
            _ => "All Overlays",
        };
    }

    private PreviewTopology BuildPreviewTopology(CelesteMapData map)
    {
        if (map.PreviewMetadata is not null)
        {
            var metadataTopology = BuildPreviewTopologyFromMetadata(map);
            if (metadataTopology.HasOverlay || metadataTopology.AllEdges.Count > 0)
            {
                return metadataTopology;
            }
        }

        var indexedRooms = new Dictionary<(int Row, int Column), RoomData>();
        foreach (var room in map.Rooms)
        {
            if (TryGetRoomGridPosition(room.Name, out var row, out var column))
            {
                indexedRooms[(row, column)] = room;
            }
        }

        if (indexedRooms.Count == 0)
        {
            return PreviewTopology.Empty;
        }

        var edges = new List<PreviewEdge>();
        foreach (var pair in indexedRooms)
        {
            var room = pair.Value;
            var (row, column) = pair.Key;
            if (indexedRooms.TryGetValue((row, column + 1), out var rightRoom) && HasHorizontalConnection(room, rightRoom))
            {
                edges.Add(CreateEdge(room, rightRoom));
            }
            if (indexedRooms.TryGetValue((row + 1, column), out var downRoom) && HasVerticalConnection(room, downRoom))
            {
                edges.Add(CreateEdge(room, downRoom));
            }
        }

        if (edges.Count == 0)
        {
            return PreviewTopology.Empty;
        }

        var adjacency = new Dictionary<RoomData, List<RoomData>>();
        foreach (var edge in edges)
        {
            AddNeighbor(adjacency, edge.From, edge.To);
            AddNeighbor(adjacency, edge.To, edge.From);
        }

        var startRoom = map.Rooms.FirstOrDefault(room => room.Entities.Any(entity => string.Equals(entity.Name, "player", StringComparison.OrdinalIgnoreCase)));
        var goalRoom = map.Rooms
            .FirstOrDefault(room => room.Entities.Any(entity => string.Equals(entity.Name, "strawberry", StringComparison.OrdinalIgnoreCase)))
            ?? map.Rooms.FirstOrDefault(room => room.Entities.Any(entity => string.Equals(entity.Name, "spring", StringComparison.OrdinalIgnoreCase)));

        var mainPathRooms = startRoom is not null && goalRoom is not null
            ? FindShortestPath(adjacency, startRoom, goalRoom)
            : new List<RoomData>();
        var mainPathEdges = BuildEdgeSet(mainPathRooms);
        var checkpointRooms = map.Rooms.Where(room => room.Entities.Any(entity => string.Equals(entity.Name, "checkpoint", StringComparison.OrdinalIgnoreCase))).ToHashSet();
        var hubRooms = adjacency.Where(pair => pair.Value.Count >= 3).Select(pair => pair.Key).ToHashSet();
        var hasOverlay = _layoutMode is "criticalPath" or "criticalPathBranches" or "openSkeleton";
        var phaseByRoom = new Dictionary<RoomData, string>();
        var branchRooms = new HashSet<RoomData>();
        var rewardRooms = new HashSet<RoomData>();

        for (var index = 0; index < mainPathRooms.Count; index++)
        {
            phaseByRoom[mainPathRooms[index]] = DescribePathPhase(index, mainPathRooms.Count);
        }

        foreach (var room in map.Rooms)
        {
            if (!phaseByRoom.ContainsKey(room))
            {
                if (room.Entities.Any(entity => string.Equals(entity.Name, "strawberry", StringComparison.OrdinalIgnoreCase)))
                {
                    phaseByRoom[room] = "reward";
                    rewardRooms.Add(room);
                }
                else
                {
                    phaseByRoom[room] = "branch";
                    branchRooms.Add(room);
                }
            }
        }

        return new PreviewTopology(edges, mainPathEdges, checkpointRooms, hubRooms, branchRooms, rewardRooms, new HashSet<RoomData>(), new HashSet<RoomData>(), phaseByRoom, startRoom, goalRoom, hasOverlay);
    }

    private PreviewTopology BuildPreviewTopologyFromMetadata(CelesteMapData map)
    {
        var metadata = map.PreviewMetadata;
        if (metadata is null || metadata.Nodes.Count == 0)
        {
            return PreviewTopology.Empty;
        }

        var roomByName = map.Rooms.ToDictionary(room => room.Name, StringComparer.Ordinal);
        var nodeById = metadata.Nodes.ToDictionary(node => node.Id);
        var roomById = new Dictionary<int, RoomData>();
        foreach (var node in metadata.Nodes)
        {
            if (roomByName.TryGetValue(node.RoomName, out var room))
            {
                roomById[node.Id] = room;
            }
        }

        var edges = new HashSet<PreviewEdge>();
        foreach (var node in metadata.Nodes)
        {
            if (!roomById.TryGetValue(node.Id, out var fromRoom))
            {
                continue;
            }

            foreach (var connectionId in node.Connections)
            {
                if (roomById.TryGetValue(connectionId, out var toRoom))
                {
                    edges.Add(CreateEdge(fromRoom, toRoom));
                }
            }
        }

        var mainPathRooms = metadata.MainPathNodeIds
            .Where(roomById.ContainsKey)
            .Select(nodeId => roomById[nodeId])
            .ToList();
        var mainPathEdges = BuildEdgeSet(mainPathRooms);
        var checkpointRooms = metadata.Nodes
            .Where(node => node.Role == "checkpoint")
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? room : null)
            .OfType<RoomData>()
            .ToHashSet();
        var hubRooms = metadata.Nodes
            .Where(node => node.Role == "hub" || node.Role == "knot")
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? room : null)
            .OfType<RoomData>()
            .ToHashSet();
        var branchRooms = metadata.Nodes
            .Where(node => node.Role == "branch")
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? room : null)
            .OfType<RoomData>()
            .ToHashSet();
        var rewardRooms = metadata.Nodes
            .Where(node => node.Role == "reward")
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? room : null)
            .OfType<RoomData>()
            .ToHashSet();
        var setpieceRooms = metadata.Nodes
            .Where(node => node.Role == "setpiece")
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? room : null)
            .OfType<RoomData>()
            .ToHashSet();
        var knotRooms = metadata.Nodes
            .Where(node => node.Role == "knot")
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? room : null)
            .OfType<RoomData>()
            .ToHashSet();
        var phaseByRoom = metadata.Nodes
            .Select(node => roomById.TryGetValue(node.Id, out var room) ? (room, node.Phase) : ((RoomData?)null, (string?)null))
            .Where(entry => entry.Item1 is not null && !string.IsNullOrWhiteSpace(entry.Item2))
            .ToDictionary(entry => entry.Item1!, entry => entry.Item2!, EqualityComparer<RoomData>.Default);
        roomById.TryGetValue(metadata.StartNodeId, out var startRoom);
        roomById.TryGetValue(metadata.GoalNodeId, out var goalRoom);

        return new PreviewTopology(
            edges.ToList(),
            mainPathEdges,
            checkpointRooms,
            hubRooms,
            branchRooms,
            rewardRooms,
            setpieceRooms,
            knotRooms,
            phaseByRoom,
            startRoom,
            goalRoom,
            metadata.LayoutMode is "criticalPath" or "criticalPathBranches" or "openSkeleton");
    }

    private ViewBounds GetViewBounds(CelesteMapData map, PreviewTopology topology)
    {
        if (_previewMode == PreviewModeTopology && topology.HasOverlay)
        {
            return GetTopologyWorldBounds(topology) ?? GetRoomWorldBounds(map.Rooms);
        }

        return GetRoomWorldBounds(map.Rooms);
    }

    private static ViewBounds GetRoomWorldBounds(IReadOnlyList<RoomData> rooms)
    {
        var minX = rooms.Min(room => (float)room.X);
        var minY = rooms.Min(room => (float)room.Y);
        var maxX = rooms.Max(room => room.X + room.Width);
        var maxY = rooms.Max(room => room.Y + room.Height);
        return new ViewBounds(minX, minY, Math.Max(1f, maxX - minX), Math.Max(1f, maxY - minY));
    }

    private static ViewBounds? GetTopologyWorldBounds(PreviewTopology topology)
    {
        var rooms = new List<RoomData>();
        rooms.AddRange(topology.PhaseByRoom.Keys);
        if (rooms.Count == 0)
        {
            return null;
        }

        var minCenterX = rooms.Min(room => room.X + room.Width * 0.5f);
        var minCenterY = rooms.Min(room => room.Y + room.Height * 0.5f);
        var maxCenterX = rooms.Max(room => room.X + room.Width * 0.5f);
        var maxCenterY = rooms.Max(room => room.Y + room.Height * 0.5f);
        var padX = Math.Max(56f, rooms.Max(room => room.Width) * 0.4f);
        var padY = Math.Max(56f, rooms.Max(room => room.Height) * 0.4f);

        return new ViewBounds(minCenterX - padX, minCenterY - padY, Math.Max(1f, maxCenterX - minCenterX + padX * 2f), Math.Max(1f, maxCenterY - minCenterY + padY * 2f));
    }

    private static string DescribePathPhase(int pathIndex, int pathLength)
    {
        if (pathLength <= 0)
        {
            return "branch";
        }

        if (pathIndex == 0)
        {
            return "intro";
        }
        if (pathIndex == pathLength - 1)
        {
            return "finale";
        }
        if (pathIndex <= pathLength / 3)
        {
            return "build";
        }
        if (pathIndex >= (int)Math.Floor(pathLength * 0.66))
        {
            return "escalation";
        }
        return "checkpoint";
    }

    private static HashSet<PreviewEdge> BuildEdgeSet(IReadOnlyList<RoomData> rooms)
    {
        var edges = new HashSet<PreviewEdge>();
        for (var index = 0; index < rooms.Count - 1; index++)
        {
            edges.Add(CreateEdge(rooms[index], rooms[index + 1]));
        }
        return edges;
    }

    private static List<RoomData> FindShortestPath(Dictionary<RoomData, List<RoomData>> adjacency, RoomData startRoom, RoomData goalRoom)
    {
        var queue = new Queue<RoomData>();
        var previous = new Dictionary<RoomData, RoomData?>();
        queue.Enqueue(startRoom);
        previous[startRoom] = null;

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (ReferenceEquals(current, goalRoom))
            {
                break;
            }

            if (!adjacency.TryGetValue(current, out var neighbors))
            {
                continue;
            }

            foreach (var neighbor in neighbors)
            {
                if (previous.ContainsKey(neighbor))
                {
                    continue;
                }

                previous[neighbor] = current;
                queue.Enqueue(neighbor);
            }
        }

        if (!previous.ContainsKey(goalRoom))
        {
            return new List<RoomData>();
        }

        var path = new List<RoomData>();
        for (RoomData? current = goalRoom; current is not null; current = previous[current])
        {
            path.Add(current);
        }
        path.Reverse();
        return path;
    }

    private static void AddNeighbor(Dictionary<RoomData, List<RoomData>> adjacency, RoomData from, RoomData to)
    {
        if (!adjacency.TryGetValue(from, out var neighbors))
        {
            neighbors = new List<RoomData>();
            adjacency[from] = neighbors;
        }

        neighbors.Add(to);
    }

    private static bool HasHorizontalConnection(RoomData leftRoom, RoomData rightRoom)
    {
        return HasLeftDoor(rightRoom) && HasRightDoor(leftRoom);
    }

    private static bool HasVerticalConnection(RoomData topRoom, RoomData bottomRoom)
    {
        return HasDownDoor(topRoom) && HasUpDoor(bottomRoom);
    }

    private static bool HasLeftDoor(RoomData room)
    {
        return HasDoorTiles(room.TilesFg, 0, Math.Max(0, (int)Math.Floor(room.TileHeight * 0.65f) - SideDoorHeight), 1, SideDoorHeight);
    }

    private static bool HasRightDoor(RoomData room)
    {
        return HasDoorTiles(room.TilesFg, room.TileWidth - 1, Math.Max(0, (int)Math.Floor(room.TileHeight * 0.65f) - SideDoorHeight), 1, SideDoorHeight);
    }

    private static bool HasUpDoor(RoomData room)
    {
        var centerX = Math.Max(0, room.TileWidth / 2 - 2);
        return HasDoorTiles(room.TilesFg, centerX, 0, TopDoorWidth, 1)
            && HasDoorTiles(room.TilesFg, Math.Max(0, room.TileWidth / 2 - 1), 1, 2, 2);
    }

    private static bool HasDownDoor(RoomData room)
    {
        var centerX = Math.Max(0, room.TileWidth / 2 - 2);
        return HasDoorTiles(room.TilesFg, centerX, Math.Max(0, room.TileHeight - 2), TopDoorWidth, 2);
    }

    private static bool HasDoorTiles(TileGridData? grid, int x, int y, int width, int height)
    {
        if (grid is null || grid.Width <= 0 || grid.Height <= 0)
        {
            return false;
        }

        for (var offsetY = 0; offsetY < height; offsetY++)
        {
            for (var offsetX = 0; offsetX < width; offsetX++)
            {
                var tileX = x + offsetX;
                var tileY = y + offsetY;
                if (tileX < 0 || tileY < 0 || tileX >= grid.Width || tileY >= grid.Height)
                {
                    continue;
                }

                var index = tileY * grid.Width + tileX;
                if (index >= 0 && index < grid.Tiles.Count && grid.Tiles[index] == '0')
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool TryGetRoomGridPosition(string roomName, out int row, out int column)
    {
        row = 0;
        column = 0;
        var parts = roomName.Split('_');
        if (parts.Length < 3)
        {
            return false;
        }

        return int.TryParse(parts[^2], out row) && int.TryParse(parts[^1], out column);
    }

    private static PointF GetRoomCenter(RoomData room, float minX, float minY, float offsetX, float offsetY, float scale)
    {
        return new PointF(
            offsetX + (room.X - minX + room.Width * 0.5f) * scale,
            offsetY + (room.Y - minY + room.Height * 0.5f) * scale);
    }

    private static void DrawMarker(Graphics graphics, Brush brush, Pen outlinePen, PointF center, float radius)
    {
        graphics.FillEllipse(brush, center.X - radius, center.Y - radius, radius * 2f, radius * 2f);
        graphics.DrawEllipse(outlinePen, center.X - radius, center.Y - radius, radius * 2f, radius * 2f);
    }

    private static void DrawSquareMarker(Graphics graphics, Brush brush, Pen outlinePen, PointF center, float radius)
    {
        graphics.FillRectangle(brush, center.X - radius, center.Y - radius, radius * 2f, radius * 2f);
        graphics.DrawRectangle(outlinePen, center.X - radius, center.Y - radius, radius * 2f, radius * 2f);
    }

    private static void DrawDiamondMarker(Graphics graphics, Brush brush, Pen outlinePen, PointF center, float radius)
    {
        PointF[] points =
        [
            new(center.X, center.Y - radius),
            new(center.X + radius, center.Y),
            new(center.X, center.Y + radius),
            new(center.X - radius, center.Y),
        ];

        graphics.FillPolygon(brush, points);
        graphics.DrawPolygon(outlinePen, points);
    }

    private static void DrawDiamondOutlineMarker(Graphics graphics, Pen outlinePen, PointF center, float radius)
    {
        PointF[] points =
        [
            new(center.X, center.Y - radius),
            new(center.X + radius, center.Y),
            new(center.X, center.Y + radius),
            new(center.X - radius, center.Y),
        ];

        graphics.DrawPolygon(outlinePen, points);
    }

    private static void DrawRingMarker(Graphics graphics, Pen pen, PointF center, float radius)
    {
        graphics.DrawEllipse(pen, center.X - radius, center.Y - radius, radius * 2f, radius * 2f);
    }

    private static PreviewEdge CreateEdge(RoomData left, RoomData right)
    {
        return string.CompareOrdinal(left.Name, right.Name) <= 0
            ? new PreviewEdge(left, right)
            : new PreviewEdge(right, left);
    }

    private sealed record PreviewEdge(RoomData From, RoomData To);

    private sealed record PreviewTopology(
        List<PreviewEdge> AllEdges,
        HashSet<PreviewEdge> MainPathEdges,
        HashSet<RoomData> CheckpointRooms,
        HashSet<RoomData> HubRooms,
        HashSet<RoomData> BranchRooms,
        HashSet<RoomData> RewardRooms,
        HashSet<RoomData> SetpieceRooms,
        HashSet<RoomData> KnotRooms,
        Dictionary<RoomData, string> PhaseByRoom,
        RoomData? StartRoom,
        RoomData? GoalRoom,
        bool HasOverlay)
    {
        public static readonly PreviewTopology Empty = new(new List<PreviewEdge>(), new HashSet<PreviewEdge>(), new HashSet<RoomData>(), new HashSet<RoomData>(), new HashSet<RoomData>(), new HashSet<RoomData>(), new HashSet<RoomData>(), new HashSet<RoomData>(), new Dictionary<RoomData, string>(), null, null, false);
    }

    private sealed record ViewBounds(float MinX, float MinY, float Width, float Height);
}
