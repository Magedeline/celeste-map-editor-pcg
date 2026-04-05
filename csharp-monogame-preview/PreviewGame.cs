using CelesteMapMonoGameInterop;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;

namespace CelesteMapMonoGamePreview;

public sealed class PreviewGame : Game
{
    private readonly SceneBundle _bundle;
    private readonly GraphicsDeviceManager _graphics;
    private SpriteBatch? _spriteBatch;
    private CelesteMapRenderer? _renderer;
    private CelesteMapScene _scene = new();
    private MouseState _previousMouse;
    private DateTime _lastSceneWriteUtc = DateTime.MinValue;
    private TimeSpan _reloadPollAccumulator = TimeSpan.Zero;
    private Vector2 _camera = new(64f, 64f);
    private float _zoom = 2f;
    private int _selectedRoomIndex = -1;
    private string _status = "Waiting for scene bundle";

    public PreviewGame(SceneBundle bundle)
    {
        _bundle = bundle;
        _graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = 1600,
            PreferredBackBufferHeight = 900,
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

        HandleKeyboardPan(keyboard, gameTime);
        HandleMousePanAndZoom(mouse);
        HandleRoomSelection(mouse);

        if (_bundle.Watch)
        {
            _reloadPollAccumulator += gameTime.ElapsedGameTime;
            if (_reloadPollAccumulator >= TimeSpan.FromMilliseconds(350))
            {
                _reloadPollAccumulator = TimeSpan.Zero;
                TryReloadScene(force: false);
            }
        }

        _previousMouse = mouse;
        UpdateTitle();
        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new Color(18, 22, 30));

        if (_spriteBatch is null || _renderer is null)
        {
            base.Draw(gameTime);
            return;
        }

        var transform = Matrix.CreateTranslation(_camera.X, _camera.Y, 0f) * Matrix.CreateScale(_zoom, _zoom, 1f);
        _spriteBatch.Begin(transformMatrix: transform, samplerState: SamplerState.PointClamp);
        _renderer.DrawScene(_spriteBatch, _scene, new Point(8, 8), _selectedRoomIndex);
        if (_selectedRoomIndex >= 0 && _selectedRoomIndex < _scene.Rooms.Count)
        {
            _renderer.DrawGrid(_spriteBatch, _scene.Rooms[_selectedRoomIndex].Bounds, 8);
        }
        _spriteBatch.End();

        base.Draw(gameTime);
    }

    private void HandleKeyboardPan(KeyboardState keyboard, GameTime gameTime)
    {
        var moveSpeed = 420f * (float)gameTime.ElapsedGameTime.TotalSeconds / Math.Max(_zoom, 0.35f);
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
    }

    private void HandleMousePanAndZoom(MouseState mouse)
    {
        if (mouse.RightButton == ButtonState.Pressed && _previousMouse.RightButton == ButtonState.Pressed)
        {
            var delta = new Vector2(mouse.X - _previousMouse.X, mouse.Y - _previousMouse.Y);
            _camera += delta / Math.Max(_zoom, 0.35f);
        }

        var scrollDelta = mouse.ScrollWheelValue - _previousMouse.ScrollWheelValue;
        if (scrollDelta != 0)
        {
            _zoom = Math.Clamp(_zoom + scrollDelta / 1200f, 0.35f, 8f);
        }
    }

    private void HandleRoomSelection(MouseState mouse)
    {
        if (mouse.LeftButton != ButtonState.Pressed || _previousMouse.LeftButton == ButtonState.Pressed)
        {
            return;
        }

        TrySelectRoomAt(ScreenToWorld(mouse.Position));
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
            _status = $"Loaded {_scene.Rooms.Count} rooms from {Path.GetFileName(_bundle.ScenePath)}";
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
        Window.Title = $"Celeste MonoGame Preview | {selected} | Rooms: {_scene.Rooms.Count} | Left click select | Wheel zoom | Right drag pan | Auto reload: {(_bundle.Watch ? "on" : "off")} | {_status}";
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

    private void TrySelectRoomAt(Point worldPoint)
    {
        _selectedRoomIndex = FindRoomAt(worldPoint);
        _status = _selectedRoomIndex >= 0
            ? $"Selected {_scene.Rooms[_selectedRoomIndex].Name}"
            : "Selected no room";
    }
}