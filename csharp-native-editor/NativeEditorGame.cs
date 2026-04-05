using System.Collections.Concurrent;
using System.Text.Json;
using CelesteMapMonoGameInterop;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;
using ButtonState = Microsoft.Xna.Framework.Input.ButtonState;
using Color = Microsoft.Xna.Framework.Color;
using Point = Microsoft.Xna.Framework.Point;
using Rectangle = Microsoft.Xna.Framework.Rectangle;
using Keys = Microsoft.Xna.Framework.Input.Keys;

namespace CelesteMapNativeEditor;

public sealed class NativeEditorGame : Game
{
    private const int RoomDragStartDistance = 4;
    private const float CameraPanSpeed = 420f;
    private const float MinZoom = 0.35f;
    private const float MaxZoom = 8f;
    private const int PreferredWidth = 1680;
    private const int PreferredHeight = 960;
    private const int TileSize = 8;
    private const int ReloadPollMs = 400;
    private const int MinRoomPixels = 64;
    private const int DefaultRoomWidth = 320;
    private const int DefaultRoomHeight = 184;
    private const int DefaultTileWidth = 40;
    private const int DefaultTileHeight = 23;

    private enum EditorTool
    {
        RoomLayout,
        ForegroundTiles,
        BackgroundTiles,
        Entities,
        Triggers,
        Erase,
    }

    private static readonly char[] TileBrushPalette = ['1', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd'];
    private static readonly string[] EntityBrushPalette = [
        "strawberry",
        "spring",
        "booster",
        "refill",
        "spikesUp",
        "spikesDown",
        "spikesLeft",
        "spikesRight",
    ];
    private static readonly string[] TriggerBrushPalette = [
        "musicTrigger",
        "cameraOffsetTrigger",
        "cameraTargetTrigger",
        "eventTrigger",
    ];

    private readonly SceneBundle _bundle;
    private readonly ConcurrentQueue<InspectorCommand> _inspectorCommands = new();
    private readonly NativeEditorInspectorHost _inspectorHost;
    private readonly GraphicsDeviceManager _graphics;
    private SpriteBatch? _spriteBatch;
    private CelesteMapRenderer? _renderer;
    private CelesteMapScene _scene = new();
    private KeyboardState _previousKeyboard;
    private MouseState _previousMouse;
    private DateTime _lastSceneWriteUtc = DateTime.MinValue;
    private TimeSpan _reloadPollAccumulator = TimeSpan.Zero;
    private Vector2 _camera = new(64f, 64f);
    private float _zoom = 1.5f;
    private int _selectedRoomIndex = -1;
    private bool _roomPointerDown;
    private bool _draggingRoom;
    private Point _dragOffset;
    private Point _roomPointerDownWorld;
    private bool _dirty;
    private EditorTool _currentTool = EditorTool.RoomLayout;
    private int _tileBrushIndex;
    private int _entityBrushIndex;
    private int _triggerBrushIndex;
    private string _status = "Waiting for scene bundle";

    public NativeEditorGame(SceneBundle bundle)
    {
        _bundle = bundle;
        _inspectorHost = new NativeEditorInspectorHost((command) => _inspectorCommands.Enqueue(command));
        _graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = PreferredWidth,
            PreferredBackBufferHeight = PreferredHeight,
        };
        IsMouseVisible = true;
        Window.AllowUserResizing = true;
    }

    protected override void LoadContent()
    {
        _spriteBatch = new SpriteBatch(GraphicsDevice);
        _renderer = new CelesteMapRenderer(GraphicsDevice);
        TryReloadScene(force: true);
    }

    protected override void UnloadContent()
    {
        _renderer?.Dispose();
        _inspectorHost.Dispose();
        base.UnloadContent();
    }

    protected override void Update(GameTime gameTime)
    {
        var keyboard = Keyboard.GetState();
        var mouse = Mouse.GetState();

        if (keyboard.IsKeyDown(Keys.Escape))
        {
            Exit();
            return;
        }

        HandleCameraPan(keyboard, gameTime);
        HandleZoom(mouse);
        HandleToolHotkeys(keyboard);
        HandlePointerInteraction(mouse);
        HandleEditingHotkeys(keyboard);
        ProcessInspectorCommands();

        if (_bundle.Watch && !_dirty)
        {
            _reloadPollAccumulator += gameTime.ElapsedGameTime;
            if (_reloadPollAccumulator >= TimeSpan.FromMilliseconds(ReloadPollMs))
            {
                _reloadPollAccumulator = TimeSpan.Zero;
                TryReloadScene(force: false);
            }
        }

        _previousKeyboard = keyboard;
        _previousMouse = mouse;
        PublishInspectorSnapshot();
        UpdateTitle();
        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new Color(20, 24, 28));

        if (_spriteBatch is null || _renderer is null)
        {
            base.Draw(gameTime);
            return;
        }

        var transform = Matrix.CreateTranslation(_camera.X, _camera.Y, 0f) * Matrix.CreateScale(_zoom, _zoom, 1f);
        _spriteBatch.Begin(transformMatrix: transform, samplerState: SamplerState.PointClamp);
        _renderer.DrawScene(_spriteBatch, _scene, new Point(TileSize, TileSize), _selectedRoomIndex);
        if (_selectedRoomIndex >= 0 && _selectedRoomIndex < _scene.Rooms.Count)
        {
            _renderer.DrawGrid(_spriteBatch, _scene.Rooms[_selectedRoomIndex].Bounds, TileSize);
        }
        DrawToolOverlay(_spriteBatch, _renderer);
        _spriteBatch.End();

        base.Draw(gameTime);
    }

    private void HandleCameraPan(KeyboardState keyboard, GameTime gameTime)
    {
        var moveSpeed = CameraPanSpeed * (float)gameTime.ElapsedGameTime.TotalSeconds / Math.Max(_zoom, MinZoom);
        var controlHeld = keyboard.IsKeyDown(Keys.LeftControl) || keyboard.IsKeyDown(Keys.RightControl);
        if (controlHeld)
        {
            return;
        }

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

        if (_previousMouse.RightButton == ButtonState.Pressed && Mouse.GetState().RightButton == ButtonState.Pressed)
        {
            var delta = new Vector2(Mouse.GetState().X - _previousMouse.X, Mouse.GetState().Y - _previousMouse.Y);
            _camera += delta / Math.Max(_zoom, MinZoom);
        }
    }

    private void HandleZoom(MouseState mouse)
    {
        var scrollDelta = mouse.ScrollWheelValue - _previousMouse.ScrollWheelValue;
        if (scrollDelta != 0)
        {
            _zoom = Math.Clamp(_zoom + scrollDelta / 1200f, MinZoom, MaxZoom);
        }
    }

    private void HandleToolHotkeys(KeyboardState keyboard)
    {
        if (IsNewPress(keyboard, Keys.Tab))
        {
            _currentTool = (EditorTool)(((int)_currentTool + 1) % Enum.GetValues<EditorTool>().Length);
            _status = $"Switched to {ToolLabel()}";
        }

        if (IsNewPress(keyboard, Keys.M))
        {
            _currentTool = EditorTool.RoomLayout;
            _status = $"Switched to {ToolLabel()}";
        }
        if (IsNewPress(keyboard, Keys.F))
        {
            _currentTool = EditorTool.ForegroundTiles;
            _status = $"Switched to {ToolLabel()}";
        }
        if (IsNewPress(keyboard, Keys.B))
        {
            _currentTool = EditorTool.BackgroundTiles;
            _status = $"Switched to {ToolLabel()}";
        }
        if (IsNewPress(keyboard, Keys.E))
        {
            _currentTool = EditorTool.Entities;
            _status = $"Switched to {ToolLabel()}";
        }
        if (IsNewPress(keyboard, Keys.T))
        {
            _currentTool = EditorTool.Triggers;
            _status = $"Switched to {ToolLabel()}";
        }
        if (IsNewPress(keyboard, Keys.X))
        {
            _currentTool = EditorTool.Erase;
            _status = $"Switched to {ToolLabel()}";
        }

        if (IsNewPress(keyboard, Keys.PageUp))
        {
            CycleContextBrush(-1);
        }
        if (IsNewPress(keyboard, Keys.PageDown))
        {
            CycleContextBrush(1);
        }

        UpdateTileBrushFromNumberKey(keyboard);
    }

    private void HandlePointerInteraction(MouseState mouse)
    {
        var worldPoint = ScreenToWorld(mouse.Position);

        if (_currentTool == EditorTool.RoomLayout)
        {
            HandleRoomSelection(mouse, worldPoint);
            HandleRoomDrag(mouse, worldPoint);
            return;
        }

        if (mouse.LeftButton == ButtonState.Pressed && _previousMouse.LeftButton != ButtonState.Pressed)
        {
            TrySelectRoomAt(worldPoint);
        }

        if (_selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            return;
        }

        switch (_currentTool)
        {
            case EditorTool.ForegroundTiles:
                if (mouse.LeftButton == ButtonState.Pressed)
                {
                    PaintTile(worldPoint, background: false, erase: false);
                }
                if (mouse.RightButton == ButtonState.Pressed)
                {
                    PaintTile(worldPoint, background: false, erase: true);
                }
                break;
            case EditorTool.BackgroundTiles:
                if (mouse.LeftButton == ButtonState.Pressed)
                {
                    PaintTile(worldPoint, background: true, erase: false);
                }
                if (mouse.RightButton == ButtonState.Pressed)
                {
                    PaintTile(worldPoint, background: true, erase: true);
                }
                break;
            case EditorTool.Entities:
                if (mouse.LeftButton == ButtonState.Pressed && _previousMouse.LeftButton != ButtonState.Pressed)
                {
                    AddSceneEntity(worldPoint, trigger: false);
                }
                if (mouse.RightButton == ButtonState.Pressed && _previousMouse.RightButton != ButtonState.Pressed)
                {
                    RemoveSceneEntity(worldPoint, trigger: false);
                }
                break;
            case EditorTool.Triggers:
                if (mouse.LeftButton == ButtonState.Pressed && _previousMouse.LeftButton != ButtonState.Pressed)
                {
                    AddSceneEntity(worldPoint, trigger: true);
                }
                if (mouse.RightButton == ButtonState.Pressed && _previousMouse.RightButton != ButtonState.Pressed)
                {
                    RemoveSceneEntity(worldPoint, trigger: true);
                }
                break;
            case EditorTool.Erase:
                if ((mouse.LeftButton == ButtonState.Pressed || mouse.RightButton == ButtonState.Pressed))
                {
                    EraseAt(worldPoint);
                }
                break;
        }
    }

    private void HandleRoomSelection(MouseState mouse, Point worldPoint)
    {
        if (mouse.LeftButton != ButtonState.Pressed || _previousMouse.LeftButton == ButtonState.Pressed)
        {
            return;
        }

        _selectedRoomIndex = FindRoomAt(worldPoint);
        _roomPointerDown = false;
        _draggingRoom = false;
        if (_selectedRoomIndex >= 0)
        {
            var room = _scene.Rooms[_selectedRoomIndex];
            _roomPointerDown = true;
            _roomPointerDownWorld = worldPoint;
            _dragOffset = new Point(worldPoint.X - room.X, worldPoint.Y - room.Y);
            _status = $"Selected {room.Name}";
        }
        else
        {
            _status = "Selected no room";
        }
    }

    private void HandleRoomDrag(MouseState mouse, Point worldPoint)
    {
        if ((!_roomPointerDown && !_draggingRoom) || _selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            return;
        }

        if (mouse.LeftButton != ButtonState.Pressed)
        {
            _roomPointerDown = false;
            _draggingRoom = false;
            return;
        }

        if (!_draggingRoom)
        {
            var deltaX = worldPoint.X - _roomPointerDownWorld.X;
            var deltaY = worldPoint.Y - _roomPointerDownWorld.Y;
            if ((deltaX * deltaX) + (deltaY * deltaY) < RoomDragStartDistance * RoomDragStartDistance)
            {
                return;
            }

            _draggingRoom = true;
        }

        var room = _scene.Rooms[_selectedRoomIndex];
        var snappedX = SnapToTile(worldPoint.X - _dragOffset.X);
        var snappedY = SnapToTile(worldPoint.Y - _dragOffset.Y);

        if (room.X != snappedX || room.Y != snappedY)
        {
            room.X = snappedX;
            room.Y = snappedY;
            _dirty = true;
            _status = $"Moved {room.Name}";
        }
    }

    private void HandleEditingHotkeys(KeyboardState keyboard)
    {
        var controlHeld = keyboard.IsKeyDown(Keys.LeftControl) || keyboard.IsKeyDown(Keys.RightControl);

        if (IsNewPress(keyboard, Keys.R))
        {
            TryReloadScene(force: true);
        }

        if (controlHeld && IsNewPress(keyboard, Keys.S))
        {
            SaveScene();
        }

        if (IsNewPress(keyboard, Keys.N))
        {
            AddRoom();
        }

        if (_currentTool == EditorTool.RoomLayout && (IsNewPress(keyboard, Keys.Delete) || IsNewPress(keyboard, Keys.Back)))
        {
            DeleteSelectedRoom();
        }

        if (_selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            return;
        }

        if (controlHeld)
        {
            if (IsNewPress(keyboard, Keys.Left))
            {
                ResizeSelectedRoom(-8, 0);
            }
            if (IsNewPress(keyboard, Keys.Right))
            {
                ResizeSelectedRoom(8, 0);
            }
            if (IsNewPress(keyboard, Keys.Up))
            {
                ResizeSelectedRoom(0, -8);
            }
            if (IsNewPress(keyboard, Keys.Down))
            {
                ResizeSelectedRoom(0, 8);
            }
            return;
        }

        if (_currentTool != EditorTool.RoomLayout)
        {
            return;
        }

        if (IsNewPress(keyboard, Keys.Left))
        {
            NudgeSelectedRoom(-8, 0);
        }
        if (IsNewPress(keyboard, Keys.Right))
        {
            NudgeSelectedRoom(8, 0);
        }
        if (IsNewPress(keyboard, Keys.Up))
        {
            NudgeSelectedRoom(0, -8);
        }
        if (IsNewPress(keyboard, Keys.Down))
        {
            NudgeSelectedRoom(0, 8);
        }
    }

    private void NudgeSelectedRoom(int deltaX, int deltaY)
    {
        var room = _scene.Rooms[_selectedRoomIndex];
        room.X += deltaX;
        room.Y += deltaY;
        _dirty = true;
        _status = $"Nudged {room.Name}";
    }

    private void ResizeSelectedRoom(int deltaWidth, int deltaHeight)
    {
        var room = _scene.Rooms[_selectedRoomIndex];
        room.Width = Math.Max(MinRoomPixels, room.Width + deltaWidth);
        room.Height = Math.Max(MinRoomPixels, room.Height + deltaHeight);
        room.TileWidth = Math.Max(1, room.Width / TileSize);
        room.TileHeight = Math.Max(1, room.Height / TileSize);
        room.TilesFg = ResizeLayer(room.TilesFg, room.TileWidth, room.TileHeight);
        room.TilesBg = ResizeLayer(room.TilesBg, room.TileWidth, room.TileHeight);
        _dirty = true;
        _status = $"Resized {room.Name} to {room.Width}x{room.Height}";
    }

    private void AddRoom()
    {
        var center = ScreenToWorld(new Point(GraphicsDevice.Viewport.Width / 2, GraphicsDevice.Viewport.Height / 2));
        var roomNumber = _scene.Rooms.Count + 1;
        var room = new CelesteRoomScene
        {
            Name = CreateUniqueRoomName(roomNumber),
            X = SnapToTile(center.X - DefaultRoomWidth / 2),
            Y = SnapToTile(center.Y - DefaultRoomHeight / 2),
            Width = DefaultRoomWidth,
            Height = DefaultRoomHeight,
            TileWidth = DefaultTileWidth,
            TileHeight = DefaultTileHeight,
            TilesFg = CreateEmptyLayer(DefaultTileWidth, DefaultTileHeight),
            TilesBg = CreateEmptyLayer(DefaultTileWidth, DefaultTileHeight),
            Entities = new List<CelesteEntityScene>(),
            Triggers = new List<CelesteEntityScene>(),
            DecalsFg = new List<CelesteDecalScene>(),
            DecalsBg = new List<CelesteDecalScene>(),
        };
        _scene.Rooms.Add(room);
        _selectedRoomIndex = _scene.Rooms.Count - 1;
        _dirty = true;
        _status = $"Added {room.Name}";
    }

    private void DeleteSelectedRoom()
    {
        if (_selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            return;
        }

        var roomName = _scene.Rooms[_selectedRoomIndex].Name;
        _scene.Rooms.RemoveAt(_selectedRoomIndex);
        _selectedRoomIndex = Math.Min(_selectedRoomIndex, _scene.Rooms.Count - 1);
        _dirty = true;
        _status = $"Deleted {roomName}";
    }

    private void SaveScene()
    {
        try
        {
            _bundle.SaveScene(_scene);
            _lastSceneWriteUtc = File.GetLastWriteTimeUtc(_bundle.ScenePath);
            _dirty = false;
            _status = $"Saved {Path.GetFileName(_bundle.ScenePath)}";
        }
        catch (Exception ex)
        {
            _status = $"Save failed: {ex.Message}";
        }
    }

    private void TryReloadScene(bool force)
    {
        try
        {
            if (!File.Exists(_bundle.ScenePath))
            {
                _status = $"Waiting for {_bundle.ScenePath}";
                return;
            }

            var lastWriteUtc = File.GetLastWriteTimeUtc(_bundle.ScenePath);
            if (!force && lastWriteUtc <= _lastSceneWriteUtc)
            {
                return;
            }

            _scene = _bundle.LoadScene();
            _lastSceneWriteUtc = lastWriteUtc;
            _selectedRoomIndex = _scene.Rooms.Count == 0 ? -1 : Math.Clamp(_selectedRoomIndex, 0, _scene.Rooms.Count - 1);
            _dirty = false;
            _status = $"Loaded {_scene.Rooms.Count} rooms";
        }
        catch (Exception ex)
        {
            _status = $"Reload failed: {ex.Message}";
        }
    }

    private void UpdateTitle()
    {
        var selected = _selectedRoomIndex >= 0 && _selectedRoomIndex < _scene.Rooms.Count
            ? $"Selected: {_scene.Rooms[_selectedRoomIndex].Name}"
            : "Selected: none";
        var dirtyLabel = _dirty ? "dirty" : "saved";
        Window.Title = $"Celeste MonoGame Native Editor | {selected} | Rooms: {_scene.Rooms.Count} | Tool: {ToolLabel()} | Brush: {BrushLabel()} | Tab cycle tools | Ctrl+S save | {dirtyLabel} | {_status}";
    }

    private bool IsNewPress(KeyboardState keyboard, Keys key)
    {
        return keyboard.IsKeyDown(key) && !_previousKeyboard.IsKeyDown(key);
    }

    private int FindRoomAt(Point worldPoint)
    {
        for (var index = _scene.Rooms.Count - 1; index >= 0; index--)
        {
            if (_scene.Rooms[index].Bounds.Contains(worldPoint))
            {
                return index;
            }
        }

        return -1;
    }

    private Point ScreenToWorld(Point screenPoint)
    {
        var worldX = (screenPoint.X - _camera.X) / _zoom;
        var worldY = (screenPoint.Y - _camera.Y) / _zoom;
        return new Point((int)Math.Round(worldX), (int)Math.Round(worldY));
    }

    private static int SnapToTile(int value)
    {
        return (int)Math.Round(value / (float)TileSize) * TileSize;
    }

    private void TrySelectRoomAt(Point worldPoint)
    {
        var roomIndex = FindRoomAt(worldPoint);
        if (roomIndex >= 0)
        {
            _selectedRoomIndex = roomIndex;
        }
    }

    private void PaintTile(Point worldPoint, bool background, bool erase)
    {
        if (!TryGetSelectedRoomTile(worldPoint, out var room, out var tileX, out var tileY))
        {
            return;
        }

        var layer = background ? room.TilesBg : room.TilesFg;
        if (layer is null)
        {
            return;
        }

        var tile = erase ? '0' : TileBrushPalette[_tileBrushIndex];
        if (SetTile(layer, tileX, tileY, tile))
        {
            _dirty = true;
            _status = $"{(erase ? "Erased" : "Painted")} {room.Name} {(background ? "BG" : "FG")} tile {tile}";
        }
    }

    private void AddSceneEntity(Point worldPoint, bool trigger)
    {
        if (!TryGetSelectedRoomLocalPoint(worldPoint, out var room, out var localPoint))
        {
            return;
        }

        var brushName = trigger ? TriggerBrushPalette[_triggerBrushIndex] : EntityBrushPalette[_entityBrushIndex];
        var prefabSize = GetPrefabSize(brushName, trigger);
        var collection = trigger ? room.Triggers : room.Entities;
        collection.Add(new CelesteEntityScene
        {
            Name = brushName,
            Id = NextSceneElementId(),
            X = SnapToTile(localPoint.X),
            Y = SnapToTile(localPoint.Y),
            Width = prefabSize.X,
            Height = prefabSize.Y,
            Attributes = new Dictionary<string, JsonElement>(),
            Nodes = new List<CelesteNodeScene>(),
        });
        _dirty = true;
        _status = $"Added {(trigger ? "trigger" : "entity")} {brushName} in {room.Name}";
    }

    private void RemoveSceneEntity(Point worldPoint, bool trigger)
    {
        if (!TryGetSelectedRoomLocalPoint(worldPoint, out var room, out var localPoint))
        {
            return;
        }

        var collection = trigger ? room.Triggers : room.Entities;
        for (var index = collection.Count - 1; index >= 0; index--)
        {
            var candidate = collection[index];
            var bounds = new Rectangle(candidate.X, candidate.Y, Math.Max(candidate.Width, 8), Math.Max(candidate.Height, 8));
            if (!bounds.Contains(localPoint))
            {
                continue;
            }

            collection.RemoveAt(index);
            _dirty = true;
            _status = $"Removed {(trigger ? "trigger" : "entity")} {candidate.Name} from {room.Name}";
            return;
        }
    }

    private void EraseAt(Point worldPoint)
    {
        if (!TryGetSelectedRoomLocalPoint(worldPoint, out var room, out var localPoint))
        {
            return;
        }

        var removedEntity = false;
        removedEntity |= RemoveSceneEntityAt(room.Entities, localPoint);
        removedEntity |= RemoveSceneEntityAt(room.Triggers, localPoint);

        var tileX = ClampTile(localPoint.X / TileSize, room.TileWidth - 1);
        var tileY = ClampTile(localPoint.Y / TileSize, room.TileHeight - 1);
        var changedTile = false;
        if (room.TilesFg is not null)
        {
            changedTile |= SetTile(room.TilesFg, tileX, tileY, '0');
        }
        if (room.TilesBg is not null)
        {
            changedTile |= SetTile(room.TilesBg, tileX, tileY, '0');
        }

        if (removedEntity || changedTile)
        {
            _dirty = true;
            _status = $"Erased content in {room.Name}";
        }
    }

    private bool RemoveSceneEntityAt(List<CelesteEntityScene> collection, Point localPoint)
    {
        for (var index = collection.Count - 1; index >= 0; index--)
        {
            var candidate = collection[index];
            var bounds = new Rectangle(candidate.X, candidate.Y, Math.Max(candidate.Width, 8), Math.Max(candidate.Height, 8));
            if (!bounds.Contains(localPoint))
            {
                continue;
            }

            collection.RemoveAt(index);
            return true;
        }

        return false;
    }

    private bool TryGetSelectedRoomTile(Point worldPoint, out CelesteRoomScene room, out int tileX, out int tileY)
    {
        if (!TryGetSelectedRoomLocalPoint(worldPoint, out room, out var localPoint))
        {
            tileX = 0;
            tileY = 0;
            return false;
        }

        tileX = ClampTile(localPoint.X / TileSize, room.TileWidth - 1);
        tileY = ClampTile(localPoint.Y / TileSize, room.TileHeight - 1);
        return true;
    }

    private bool TryGetSelectedRoomLocalPoint(Point worldPoint, out CelesteRoomScene room, out Point localPoint)
    {
        room = new CelesteRoomScene();
        localPoint = Point.Zero;
        if (_selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            return false;
        }

        room = _scene.Rooms[_selectedRoomIndex];
        if (!room.Bounds.Contains(worldPoint))
        {
            return false;
        }

        localPoint = new Point(worldPoint.X - room.X, worldPoint.Y - room.Y);
        return true;
    }

    private void DrawToolOverlay(SpriteBatch spriteBatch, CelesteMapRenderer renderer)
    {
        if (_selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            return;
        }

        var worldPoint = ScreenToWorld(Mouse.GetState().Position);
        if (!TryGetSelectedRoomLocalPoint(worldPoint, out var room, out var localPoint))
        {
            return;
        }

        if (_currentTool is EditorTool.ForegroundTiles or EditorTool.BackgroundTiles or EditorTool.Erase)
        {
            var tileX = ClampTile(localPoint.X / TileSize, room.TileWidth - 1);
            var tileY = ClampTile(localPoint.Y / TileSize, room.TileHeight - 1);
            var tileBounds = new Rectangle(room.X + tileX * TileSize, room.Y + tileY * TileSize, TileSize, TileSize);
            var color = _currentTool == EditorTool.BackgroundTiles ? new Color(80, 160, 255, 120)
                : _currentTool == EditorTool.Erase ? new Color(255, 80, 80, 110)
                : new Color(80, 255, 150, 120);
            renderer.FillRect(spriteBatch, tileBounds, color);
            renderer.DrawOutline(spriteBatch, tileBounds, Color.White, 1);
            return;
        }

        if (_currentTool is EditorTool.Entities or EditorTool.Triggers)
        {
            var brushName = _currentTool == EditorTool.Entities ? EntityBrushPalette[_entityBrushIndex] : TriggerBrushPalette[_triggerBrushIndex];
            var size = GetPrefabSize(brushName, _currentTool == EditorTool.Triggers);
            var previewBounds = new Rectangle(room.X + SnapToTile(localPoint.X), room.Y + SnapToTile(localPoint.Y), Math.Max(size.X, TileSize), Math.Max(size.Y, TileSize));
            var color = _currentTool == EditorTool.Entities ? new Color(80, 220, 120, 120) : new Color(255, 180, 80, 120);
            renderer.FillRect(spriteBatch, previewBounds, color);
            renderer.DrawOutline(spriteBatch, previewBounds, Color.White, 1);
        }
    }

    private void CycleContextBrush(int delta)
    {
        switch (_currentTool)
        {
            case EditorTool.Entities:
                _entityBrushIndex = WrapIndex(_entityBrushIndex + delta, EntityBrushPalette.Length);
                _status = $"Entity brush: {EntityBrushPalette[_entityBrushIndex]}";
                break;
            case EditorTool.Triggers:
                _triggerBrushIndex = WrapIndex(_triggerBrushIndex + delta, TriggerBrushPalette.Length);
                _status = $"Trigger brush: {TriggerBrushPalette[_triggerBrushIndex]}";
                break;
        }
    }

    private void UpdateTileBrushFromNumberKey(KeyboardState keyboard)
    {
        var numericKeys = new[]
        {
            Keys.D1, Keys.D2, Keys.D3, Keys.D4, Keys.D5,
            Keys.D6, Keys.D7, Keys.D8, Keys.D9, Keys.D0,
        };

        for (var index = 0; index < numericKeys.Length && index < TileBrushPalette.Length; index++)
        {
            if (!IsNewPress(keyboard, numericKeys[index]))
            {
                continue;
            }

            _tileBrushIndex = index;
            _status = $"Tile brush: {TileBrushPalette[_tileBrushIndex]}";
            return;
        }
    }

    private string ToolLabel()
    {
        return _currentTool switch
        {
            EditorTool.RoomLayout => "room-layout",
            EditorTool.ForegroundTiles => "fg-tiles",
            EditorTool.BackgroundTiles => "bg-tiles",
            EditorTool.Entities => "entities",
            EditorTool.Triggers => "triggers",
            EditorTool.Erase => "erase",
            _ => "unknown",
        };
    }

    private string BrushLabel()
    {
        return _currentTool switch
        {
            EditorTool.ForegroundTiles or EditorTool.BackgroundTiles => TileBrushPalette[_tileBrushIndex].ToString(),
            EditorTool.Entities => EntityBrushPalette[_entityBrushIndex],
            EditorTool.Triggers => TriggerBrushPalette[_triggerBrushIndex],
            EditorTool.Erase => "clear",
            _ => "move/resize",
        };
    }

    private static Point GetPrefabSize(string prefabName, bool trigger)
    {
        if (trigger)
        {
            return prefabName switch
            {
                "cameraOffsetTrigger" => new Point(48, 48),
                "cameraTargetTrigger" => new Point(40, 40),
                _ => new Point(32, 32),
            };
        }

        return prefabName switch
        {
            "spikesUp" or "spikesDown" => new Point(16, 8),
            "spikesLeft" or "spikesRight" => new Point(8, 16),
            "spring" => new Point(16, 8),
            _ => new Point(8, 8),
        };
    }

    private int NextSceneElementId()
    {
        var maxId = _scene.Rooms
            .SelectMany((room) => room.Entities.Concat(room.Triggers))
            .Select((element) => element.Id)
            .DefaultIfEmpty(0)
            .Max();
        return maxId + 1;
    }

    private static bool SetTile(CelesteTileLayer layer, int x, int y, char value)
    {
        if (y < 0 || y >= layer.Rows.Count)
        {
            return false;
        }

        var row = layer.Rows[y].PadRight(layer.Width, '0').ToCharArray();
        if (x < 0 || x >= row.Length || row[x] == value)
        {
            return false;
        }

        row[x] = value;
        layer.Rows[y] = new string(row);
        return true;
    }

    private static int ClampTile(int value, int max)
    {
        return Math.Clamp(value, 0, Math.Max(0, max));
    }

    private static int WrapIndex(int value, int length)
    {
        if (length <= 0)
        {
            return 0;
        }

        var wrapped = value % length;
        return wrapped < 0 ? wrapped + length : wrapped;
    }

    private string CreateUniqueRoomName(int seed)
    {
        var counter = seed;
        while (_scene.Rooms.Any((room) => string.Equals(room.Name, $"room_{counter:000}", StringComparison.OrdinalIgnoreCase)))
        {
            counter += 1;
        }

        return $"room_{counter:000}";
    }

    private static CelesteTileLayer CreateEmptyLayer(int width, int height)
    {
        return new CelesteTileLayer
        {
            Width = width,
            Height = height,
            Rows = Enumerable.Range(0, height).Select(_ => new string('0', width)).ToList(),
        };
    }

    private static CelesteTileLayer ResizeLayer(CelesteTileLayer layer, int width, int height)
    {
        var resizedRows = new List<string>(height);
        for (var rowIndex = 0; rowIndex < height; rowIndex++)
        {
            var sourceRow = rowIndex < layer.Rows.Count ? layer.Rows[rowIndex] : string.Empty;
            if (sourceRow.Length >= width)
            {
                resizedRows.Add(sourceRow[..width]);
            }
            else
            {
                resizedRows.Add(sourceRow.PadRight(width, '0'));
            }
        }

        return new CelesteTileLayer
        {
            Width = width,
            Height = height,
            Rows = resizedRows,
        };
    }

    private void ProcessInspectorCommands()
    {
        while (_inspectorCommands.TryDequeue(out var command))
        {
            switch (command)
            {
                case UpdateRoomCommand updateRoom:
                    ApplyRoomCommand(updateRoom);
                    break;
                case UpdateEntityCommand updateEntity:
                    ApplyEntityCommand(updateEntity);
                    break;
                case AddEntityCommand addEntity:
                    ApplyAddEntityCommand(addEntity);
                    break;
                case RemoveEntityCommand removeEntity:
                    ApplyRemoveEntityCommand(removeEntity);
                    break;
                case UpdateDecalCommand updateDecal:
                    ApplyDecalCommand(updateDecal);
                    break;
                case AddDecalCommand addDecal:
                    ApplyAddDecalCommand(addDecal);
                    break;
                case RemoveDecalCommand removeDecal:
                    ApplyRemoveDecalCommand(removeDecal);
                    break;
            }
        }
    }

    private void PublishInspectorSnapshot()
    {
        InspectorSnapshot snapshot;
        if (_selectedRoomIndex < 0 || _selectedRoomIndex >= _scene.Rooms.Count)
        {
            snapshot = new InspectorSnapshot(
                _status,
                null,
                Array.Empty<InspectorEntitySnapshot>(),
                Array.Empty<InspectorEntitySnapshot>(),
                Array.Empty<InspectorDecalSnapshot>(),
                Array.Empty<InspectorDecalSnapshot>());
        }
        else
        {
            var room = _scene.Rooms[_selectedRoomIndex];
            snapshot = new InspectorSnapshot(
                _status,
                new InspectorRoomSnapshot(
                    room.Name,
                    room.X,
                    room.Y,
                    room.Width,
                    room.Height,
                    room.Music,
                    room.AltMusic,
                    room.Ambience,
                    room.WindPattern,
                    room.Color,
                    room.Dark,
                    room.Underwater,
                    room.Space,
                    room.DisableDownTransition,
                    room.CameraOffsetX,
                    room.CameraOffsetY),
                CreateEntitySnapshots(room.Entities),
                CreateEntitySnapshots(room.Triggers),
                CreateDecalSnapshots(room.DecalsFg),
                CreateDecalSnapshots(room.DecalsBg));
        }

        _inspectorHost.Publish(snapshot);
    }

    private static IReadOnlyList<InspectorEntitySnapshot> CreateEntitySnapshots(IReadOnlyList<CelesteEntityScene> entities)
    {
        return entities
            .Select((entity, index) => new InspectorEntitySnapshot(
                index,
                entity.Name,
                entity.X,
                entity.Y,
                entity.Width,
                entity.Height,
                entity.Attributes
                    .Select((entry) => new InspectorAttributeSnapshot(entry.Key, JsonElementToEditableString(entry.Value)))
                    .OrderBy((entry) => entry.Key, StringComparer.OrdinalIgnoreCase)
                    .ToArray()))
            .ToArray();
    }

    private static IReadOnlyList<InspectorDecalSnapshot> CreateDecalSnapshots(IReadOnlyList<CelesteDecalScene> decals)
    {
        return decals
            .Select((decal, index) => new InspectorDecalSnapshot(
                index,
                decal.Texture,
                decal.X,
                decal.Y,
                decal.ScaleX,
                decal.ScaleY,
                decal.Rotation,
                decal.Color))
            .ToArray();
    }

    private void ApplyRoomCommand(UpdateRoomCommand command)
    {
        if (!TryGetRoomByName(command.RoomName, out var room, out _))
        {
            return;
        }

        room.Name = string.IsNullOrWhiteSpace(command.NewName) ? room.Name : command.NewName.Trim();
        room.X = command.X;
        room.Y = command.Y;
        room.Music = command.Music;
        room.AltMusic = command.AltMusic;
        room.Ambience = command.Ambience;
        room.WindPattern = command.WindPattern;
        room.Color = command.Color;
        room.Dark = command.Dark;
        room.Underwater = command.Underwater;
        room.Space = command.Space;
        room.DisableDownTransition = command.DisableDownTransition;
        room.CameraOffsetX = command.CameraOffsetX;
        room.CameraOffsetY = command.CameraOffsetY;

        if (room.Width != command.Width || room.Height != command.Height)
        {
            room.Width = Math.Max(MinRoomPixels, command.Width);
            room.Height = Math.Max(MinRoomPixels, command.Height);
            room.TileWidth = Math.Max(1, room.Width / TileSize);
            room.TileHeight = Math.Max(1, room.Height / TileSize);
            room.TilesFg = ResizeLayer(room.TilesFg, room.TileWidth, room.TileHeight);
            room.TilesBg = ResizeLayer(room.TilesBg, room.TileWidth, room.TileHeight);
        }

        _dirty = true;
        _status = $"Updated room metadata for {room.Name}";
    }

    private void ApplyEntityCommand(UpdateEntityCommand command)
    {
        if (!TryGetEntityCollection(command.RoomName, command.Trigger, out var collection))
        {
            return;
        }

        if (command.Index < 0 || command.Index >= collection.Count)
        {
            return;
        }

        var entity = collection[command.Index];
        entity.Name = string.IsNullOrWhiteSpace(command.Name) ? entity.Name : command.Name.Trim();
        entity.X = command.X;
        entity.Y = command.Y;
        entity.Width = command.Width;
        entity.Height = command.Height;
        entity.Attributes = command.Attributes.ToDictionary(
            (entry) => entry.Key,
            (entry) => StringToJsonElement(entry.Value),
            StringComparer.OrdinalIgnoreCase);
        _dirty = true;
        _status = $"Updated {(command.Trigger ? "trigger" : "entity")} {entity.Name}";
    }

    private void ApplyAddEntityCommand(AddEntityCommand command)
    {
        if (!TryGetEntityCollection(command.RoomName, command.Trigger, out var collection))
        {
            return;
        }

        collection.Add(new CelesteEntityScene
        {
            Name = string.IsNullOrWhiteSpace(command.Name) ? (command.Trigger ? "trigger" : "entity") : command.Name.Trim(),
            Id = NextSceneElementId(),
            X = 16,
            Y = 16,
            Width = command.Trigger ? 32 : 8,
            Height = command.Trigger ? 32 : 8,
            Attributes = new Dictionary<string, JsonElement>(),
            Nodes = new List<CelesteNodeScene>(),
        });
        _dirty = true;
        _status = $"Added {(command.Trigger ? "trigger" : "entity")} from inspector";
    }

    private void ApplyRemoveEntityCommand(RemoveEntityCommand command)
    {
        if (!TryGetEntityCollection(command.RoomName, command.Trigger, out var collection))
        {
            return;
        }

        if (command.Index < 0 || command.Index >= collection.Count)
        {
            return;
        }

        var label = collection[command.Index].Name;
        collection.RemoveAt(command.Index);
        _dirty = true;
        _status = $"Removed {(command.Trigger ? "trigger" : "entity")} {label}";
    }

    private void ApplyDecalCommand(UpdateDecalCommand command)
    {
        if (!TryGetDecalCollection(command.RoomName, command.Foreground, out var collection))
        {
            return;
        }

        if (command.Index < 0 || command.Index >= collection.Count)
        {
            return;
        }

        var decal = collection[command.Index];
        decal.Texture = string.IsNullOrWhiteSpace(command.Texture) ? decal.Texture : command.Texture.Trim();
        decal.X = command.X;
        decal.Y = command.Y;
        decal.ScaleX = command.ScaleX;
        decal.ScaleY = command.ScaleY;
        decal.Rotation = command.Rotation;
        decal.Color = string.IsNullOrWhiteSpace(command.Color) ? decal.Color : command.Color.Trim();
        _dirty = true;
        _status = $"Updated decal {decal.Texture}";
    }

    private void ApplyAddDecalCommand(AddDecalCommand command)
    {
        if (!TryGetDecalCollection(command.RoomName, command.Foreground, out var collection))
        {
            return;
        }

        collection.Add(new CelesteDecalScene
        {
            Texture = string.IsNullOrWhiteSpace(command.Texture) ? "decals/sample" : command.Texture.Trim(),
            X = 0,
            Y = 0,
            ScaleX = 1,
            ScaleY = 1,
            Rotation = 0,
            Color = "ffffffff",
        });
        _dirty = true;
        _status = $"Added decal from inspector";
    }

    private void ApplyRemoveDecalCommand(RemoveDecalCommand command)
    {
        if (!TryGetDecalCollection(command.RoomName, command.Foreground, out var collection))
        {
            return;
        }

        if (command.Index < 0 || command.Index >= collection.Count)
        {
            return;
        }

        var label = collection[command.Index].Texture;
        collection.RemoveAt(command.Index);
        _dirty = true;
        _status = $"Removed decal {label}";
    }

    private bool TryGetRoomByName(string roomName, out CelesteRoomScene room, out int roomIndex)
    {
        roomIndex = _scene.Rooms.FindIndex((candidate) => string.Equals(candidate.Name, roomName, StringComparison.Ordinal));
        if (roomIndex >= 0)
        {
            room = _scene.Rooms[roomIndex];
            return true;
        }

        room = new CelesteRoomScene();
        return false;
    }

    private bool TryGetEntityCollection(string roomName, bool trigger, out List<CelesteEntityScene> collection)
    {
        if (!TryGetRoomByName(roomName, out var room, out _))
        {
            collection = new List<CelesteEntityScene>();
            return false;
        }

        collection = trigger ? room.Triggers : room.Entities;
        return true;
    }

    private bool TryGetDecalCollection(string roomName, bool foreground, out List<CelesteDecalScene> collection)
    {
        if (!TryGetRoomByName(roomName, out var room, out _))
        {
            collection = new List<CelesteDecalScene>();
            return false;
        }

        collection = foreground ? room.DecalsFg : room.DecalsBg;
        return true;
    }

    private static string JsonElementToEditableString(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => string.Empty,
            _ => element.ToString(),
        };
    }

    private static JsonElement StringToJsonElement(string raw)
    {
        if (bool.TryParse(raw, out var boolValue))
        {
            return JsonSerializer.SerializeToElement(boolValue);
        }
        if (int.TryParse(raw, out var intValue))
        {
            return JsonSerializer.SerializeToElement(intValue);
        }
        if (double.TryParse(raw, out var doubleValue))
        {
            return JsonSerializer.SerializeToElement(doubleValue);
        }
        return JsonSerializer.SerializeToElement(raw);
    }
}