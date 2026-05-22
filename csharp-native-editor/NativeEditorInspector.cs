using System.Windows.Forms;

namespace CelesteMapNativeEditor;

public sealed record InspectorSnapshot(
    string Status,
    InspectorRoomSnapshot? Room,
    IReadOnlyList<InspectorEntitySnapshot> Entities,
    IReadOnlyList<InspectorEntitySnapshot> Triggers,
    IReadOnlyList<InspectorDecalSnapshot> ForegroundDecals,
    IReadOnlyList<InspectorDecalSnapshot> BackgroundDecals);

public sealed record InspectorRoomSnapshot(
    string Name,
    int X,
    int Y,
    int Width,
    int Height,
    string Music,
    string AltMusic,
    string Ambience,
    string WindPattern,
    int Color,
    bool Dark,
    bool Underwater,
    bool Space,
    bool DisableDownTransition,
    int CameraOffsetX,
    int CameraOffsetY);

public sealed record InspectorEntitySnapshot(
    int Index,
    string Name,
    int X,
    int Y,
    int Width,
    int Height,
    IReadOnlyList<InspectorAttributeSnapshot> Attributes);

public sealed record InspectorAttributeSnapshot(string Key, string Value);

public sealed record InspectorDecalSnapshot(
    int Index,
    string Texture,
    int X,
    int Y,
    float ScaleX,
    float ScaleY,
    float Rotation,
    string Color);

public abstract record InspectorCommand(string RoomName);

public sealed record UpdateRoomCommand(
    string RoomName,
    string NewName,
    int X,
    int Y,
    int Width,
    int Height,
    string Music,
    string AltMusic,
    string Ambience,
    string WindPattern,
    int Color,
    bool Dark,
    bool Underwater,
    bool Space,
    bool DisableDownTransition,
    int CameraOffsetX,
    int CameraOffsetY) : InspectorCommand(RoomName);

public sealed record UpdateEntityCommand(
    string RoomName,
    bool Trigger,
    int Index,
    string Name,
    int X,
    int Y,
    int Width,
    int Height,
    Dictionary<string, string> Attributes) : InspectorCommand(RoomName);

public sealed record AddEntityCommand(string RoomName, bool Trigger, string Name) : InspectorCommand(RoomName);

public sealed record RemoveEntityCommand(string RoomName, bool Trigger, int Index) : InspectorCommand(RoomName);

public sealed record UpdateDecalCommand(
    string RoomName,
    bool Foreground,
    int Index,
    string Texture,
    int X,
    int Y,
    float ScaleX,
    float ScaleY,
    float Rotation,
    string Color) : InspectorCommand(RoomName);

public sealed record AddDecalCommand(string RoomName, bool Foreground, string Texture) : InspectorCommand(RoomName);

public sealed record RemoveDecalCommand(string RoomName, bool Foreground, int Index) : InspectorCommand(RoomName);

public sealed class NativeEditorInspectorHost : IDisposable
{
    private readonly ManualResetEventSlim _ready = new(false);
    private readonly Thread _thread;
    private NativeEditorInspectorForm? _form;

    public NativeEditorInspectorHost(Action<InspectorCommand> onCommand)
    {
        _thread = new Thread(() => RunForm(onCommand))
        {
            IsBackground = true,
            Name = "CelesteNativeInspector",
        };
        _thread.SetApartmentState(ApartmentState.STA);
        _thread.Start();
        _ready.Wait();
    }

    public void Publish(InspectorSnapshot snapshot)
    {
        if (_form is null || _form.IsDisposed || !_form.IsHandleCreated)
        {
            return;
        }

        _form.BeginInvoke(new Action(() => _form.ApplySnapshot(snapshot)));
    }

    public void Dispose()
    {
        if (_form is null || _form.IsDisposed || !_form.IsHandleCreated)
        {
            return;
        }

        _form.BeginInvoke(new Action(() => _form.Close()));
    }

    private void RunForm(Action<InspectorCommand> onCommand)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        _form = new NativeEditorInspectorForm(onCommand);
        _ready.Set();
        Application.Run(_form);
    }
}

internal sealed class NativeEditorInspectorForm : Form
{
    private readonly Action<InspectorCommand> _sendCommand;
    private readonly Label _statusLabel;
    private readonly TabControl _tabs;

    private readonly TextBox _roomNameTextBox;
    private readonly NumericUpDown _roomXInput;
    private readonly NumericUpDown _roomYInput;
    private readonly NumericUpDown _roomWidthInput;
    private readonly NumericUpDown _roomHeightInput;
    private readonly TextBox _musicTextBox;
    private readonly TextBox _altMusicTextBox;
    private readonly TextBox _ambienceTextBox;
    private readonly TextBox _windPatternTextBox;
    private readonly NumericUpDown _colorInput;
    private readonly CheckBox _darkCheckBox;
    private readonly CheckBox _underwaterCheckBox;
    private readonly CheckBox _spaceCheckBox;
    private readonly CheckBox _disableDownTransitionCheckBox;
    private readonly NumericUpDown _cameraOffsetXInput;
    private readonly NumericUpDown _cameraOffsetYInput;
    private readonly Button _applyRoomButton;

    private readonly ComboBox _entityCollectionComboBox;
    private readonly ListBox _entityListBox;
    private readonly TextBox _entityNameTextBox;
    private readonly NumericUpDown _entityXInput;
    private readonly NumericUpDown _entityYInput;
    private readonly NumericUpDown _entityWidthInput;
    private readonly NumericUpDown _entityHeightInput;
    private readonly DataGridView _entityAttributesGrid;
    private readonly Button _addEntityButton;
    private readonly Button _removeEntityButton;
    private readonly Button _applyEntityButton;

    private readonly ComboBox _decalLayerComboBox;
    private readonly ListBox _decalListBox;
    private readonly TextBox _decalTextureTextBox;
    private readonly NumericUpDown _decalXInput;
    private readonly NumericUpDown _decalYInput;
    private readonly NumericUpDown _decalScaleXInput;
    private readonly NumericUpDown _decalScaleYInput;
    private readonly NumericUpDown _decalRotationInput;
    private readonly TextBox _decalColorTextBox;
    private readonly Button _addDecalButton;
    private readonly Button _removeDecalButton;
    private readonly Button _applyDecalButton;

    private InspectorSnapshot? _snapshot;
    private bool _updatingUi;

    public NativeEditorInspectorForm(Action<InspectorCommand> sendCommand)
    {
        _sendCommand = sendCommand;

        Text = "Celeste Native Inspector";
        StartPosition = FormStartPosition.Manual;
        Left = Screen.PrimaryScreen?.WorkingArea.Right - 470 ?? 100;
        Top = 40;
        Width = 440;
        Height = 860;
        MinimumSize = new Size(420, 720);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            Padding = new Padding(10),
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
        Controls.Add(root);

        _statusLabel = new Label
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            Font = new Font(Font, FontStyle.Bold),
            Text = "No room selected",
            Padding = new Padding(0, 0, 0, 6),
        };
        root.Controls.Add(_statusLabel, 0, 0);

        _tabs = new TabControl
        {
            Dock = DockStyle.Fill,
        };
        root.Controls.Add(_tabs, 0, 1);

        var roomTab = new TabPage("Room");
        var entityTab = new TabPage("Entities");
        var decalTab = new TabPage("Decals");
        _tabs.TabPages.Add(roomTab);
        _tabs.TabPages.Add(entityTab);
        _tabs.TabPages.Add(decalTab);

        var roomPanel = CreateScrollPanel();
        roomTab.Controls.Add(roomPanel);
        var roomFields = CreateFieldTable(roomPanel);
        _roomNameTextBox = CreateTextBox();
        _roomXInput = CreateIntegerInput(-200000, 200000);
        _roomYInput = CreateIntegerInput(-200000, 200000);
        _roomWidthInput = CreateIntegerInput(64, 10000, 320, 8);
        _roomHeightInput = CreateIntegerInput(64, 10000, 184, 8);
        _musicTextBox = CreateTextBox();
        _altMusicTextBox = CreateTextBox();
        _ambienceTextBox = CreateTextBox();
        _windPatternTextBox = CreateTextBox();
        _colorInput = CreateIntegerInput(0, 255);
        _darkCheckBox = new CheckBox { Text = "Dark room", AutoSize = true };
        _underwaterCheckBox = new CheckBox { Text = "Underwater", AutoSize = true };
        _spaceCheckBox = new CheckBox { Text = "Space", AutoSize = true };
        _disableDownTransitionCheckBox = new CheckBox { Text = "Disable down transition", AutoSize = true };
        _cameraOffsetXInput = CreateIntegerInput(-5000, 5000);
        _cameraOffsetYInput = CreateIntegerInput(-5000, 5000);
        _applyRoomButton = new Button { Text = "Apply Room Metadata", Dock = DockStyle.Top, Height = 32 };
        _applyRoomButton.Click += (_, _) => ApplyRoom();

        AddField(roomFields, "Name", _roomNameTextBox);
        AddField(roomFields, "X", _roomXInput);
        AddField(roomFields, "Y", _roomYInput);
        AddField(roomFields, "Width", _roomWidthInput);
        AddField(roomFields, "Height", _roomHeightInput);
        AddField(roomFields, "Music", _musicTextBox);
        AddField(roomFields, "Alt Music", _altMusicTextBox);
        AddField(roomFields, "Ambience", _ambienceTextBox);
        AddField(roomFields, "Wind Pattern", _windPatternTextBox);
        AddField(roomFields, "Color", _colorInput);
        AddField(roomFields, "Flags", StackVertical(_darkCheckBox, _underwaterCheckBox, _spaceCheckBox, _disableDownTransitionCheckBox));
        AddField(roomFields, "Camera Offset X", _cameraOffsetXInput);
        AddField(roomFields, "Camera Offset Y", _cameraOffsetYInput);
        roomPanel.Controls.Add(_applyRoomButton);
        _applyRoomButton.Dock = DockStyle.Top;
        _applyRoomButton.BringToFront();

        var entityPanel = CreateScrollPanel();
        entityTab.Controls.Add(entityPanel);
        var entityRoot = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            ColumnCount = 1,
        };
        entityPanel.Controls.Add(entityRoot);
        _entityCollectionComboBox = new ComboBox { Dock = DockStyle.Top, DropDownStyle = ComboBoxStyle.DropDownList };
        _entityCollectionComboBox.Items.AddRange(["Entities", "Triggers"]);
        _entityCollectionComboBox.SelectedIndex = 0;
        _entityCollectionComboBox.SelectedIndexChanged += (_, _) => RefreshEntityPanel();
        _entityListBox = new ListBox { Dock = DockStyle.Top, Height = 150 };
        _entityListBox.SelectedIndexChanged += (_, _) => RefreshEntityDetails();
        _entityNameTextBox = CreateTextBox();
        _entityXInput = CreateIntegerInput(-200000, 200000);
        _entityYInput = CreateIntegerInput(-200000, 200000);
        _entityWidthInput = CreateIntegerInput(0, 200000);
        _entityHeightInput = CreateIntegerInput(0, 200000);
        _entityAttributesGrid = new DataGridView
        {
            Dock = DockStyle.Top,
            Height = 180,
            AllowUserToAddRows = true,
            AllowUserToDeleteRows = true,
            AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill,
            RowHeadersVisible = false,
        };
        _entityAttributesGrid.Columns.Add("key", "Key");
        _entityAttributesGrid.Columns.Add("value", "Value");
        _addEntityButton = new Button { Text = "Add", Width = 70 };
        _removeEntityButton = new Button { Text = "Remove", Width = 70 };
        _applyEntityButton = new Button { Text = "Apply", Width = 70 };
        _addEntityButton.Click += (_, _) => AddEntity();
        _removeEntityButton.Click += (_, _) => RemoveEntity();
        _applyEntityButton.Click += (_, _) => ApplyEntity();
        entityRoot.Controls.Add(_entityCollectionComboBox);
        entityRoot.Controls.Add(_entityListBox);
        entityRoot.Controls.Add(CreateFieldPanel("Name", _entityNameTextBox));
        entityRoot.Controls.Add(CreateFieldPanel("X", _entityXInput));
        entityRoot.Controls.Add(CreateFieldPanel("Y", _entityYInput));
        entityRoot.Controls.Add(CreateFieldPanel("Width", _entityWidthInput));
        entityRoot.Controls.Add(CreateFieldPanel("Height", _entityHeightInput));
        entityRoot.Controls.Add(new Label { Text = "Attributes", Dock = DockStyle.Top, AutoSize = true, Padding = new Padding(0, 8, 0, 4) });
        entityRoot.Controls.Add(_entityAttributesGrid);
        entityRoot.Controls.Add(StackHorizontal(_addEntityButton, _removeEntityButton, _applyEntityButton));

        var decalPanel = CreateScrollPanel();
        decalTab.Controls.Add(decalPanel);
        var decalRoot = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            ColumnCount = 1,
        };
        decalPanel.Controls.Add(decalRoot);
        _decalLayerComboBox = new ComboBox { Dock = DockStyle.Top, DropDownStyle = ComboBoxStyle.DropDownList };
        _decalLayerComboBox.Items.AddRange(["Foreground", "Background"]);
        _decalLayerComboBox.SelectedIndex = 0;
        _decalLayerComboBox.SelectedIndexChanged += (_, _) => RefreshDecalPanel();
        _decalListBox = new ListBox { Dock = DockStyle.Top, Height = 150 };
        _decalListBox.SelectedIndexChanged += (_, _) => RefreshDecalDetails();
        _decalTextureTextBox = CreateTextBox();
        _decalXInput = CreateIntegerInput(-200000, 200000);
        _decalYInput = CreateIntegerInput(-200000, 200000);
        _decalScaleXInput = CreateDecimalInput(-1000, 1000, 1m);
        _decalScaleYInput = CreateDecimalInput(-1000, 1000, 1m);
        _decalRotationInput = CreateDecimalInput(-3600, 3600, 0m);
        _decalColorTextBox = CreateTextBox();
        _addDecalButton = new Button { Text = "Add", Width = 70 };
        _removeDecalButton = new Button { Text = "Remove", Width = 70 };
        _applyDecalButton = new Button { Text = "Apply", Width = 70 };
        _addDecalButton.Click += (_, _) => AddDecal();
        _removeDecalButton.Click += (_, _) => RemoveDecal();
        _applyDecalButton.Click += (_, _) => ApplyDecal();
        decalRoot.Controls.Add(_decalLayerComboBox);
        decalRoot.Controls.Add(_decalListBox);
        decalRoot.Controls.Add(CreateFieldPanel("Texture", _decalTextureTextBox));
        decalRoot.Controls.Add(CreateFieldPanel("X", _decalXInput));
        decalRoot.Controls.Add(CreateFieldPanel("Y", _decalYInput));
        decalRoot.Controls.Add(CreateFieldPanel("Scale X", _decalScaleXInput));
        decalRoot.Controls.Add(CreateFieldPanel("Scale Y", _decalScaleYInput));
        decalRoot.Controls.Add(CreateFieldPanel("Rotation", _decalRotationInput));
        decalRoot.Controls.Add(CreateFieldPanel("Color", _decalColorTextBox));
        decalRoot.Controls.Add(StackHorizontal(_addDecalButton, _removeDecalButton, _applyDecalButton));
    }

    public void ApplySnapshot(InspectorSnapshot snapshot)
    {
        _snapshot = snapshot;
        _updatingUi = true;
        _statusLabel.Text = snapshot.Room is null
            ? $"No room selected | {snapshot.Status}"
            : $"Room: {snapshot.Room.Name} | {snapshot.Status}";

        var hasRoom = snapshot.Room is not null;
        _tabs.Enabled = hasRoom;

        if (!hasRoom)
        {
            ClearRoomFields();
            ClearEntityFields();
            ClearDecalFields();
            _updatingUi = false;
            return;
        }

        var room = snapshot.Room!;
        _roomNameTextBox.Text = room.Name;
        _roomXInput.Value = ClampToRange(_roomXInput, room.X);
        _roomYInput.Value = ClampToRange(_roomYInput, room.Y);
        _roomWidthInput.Value = ClampToRange(_roomWidthInput, room.Width);
        _roomHeightInput.Value = ClampToRange(_roomHeightInput, room.Height);
        _musicTextBox.Text = room.Music;
        _altMusicTextBox.Text = room.AltMusic;
        _ambienceTextBox.Text = room.Ambience;
        _windPatternTextBox.Text = room.WindPattern;
        _colorInput.Value = ClampToRange(_colorInput, room.Color);
        _darkCheckBox.Checked = room.Dark;
        _underwaterCheckBox.Checked = room.Underwater;
        _spaceCheckBox.Checked = room.Space;
        _disableDownTransitionCheckBox.Checked = room.DisableDownTransition;
        _cameraOffsetXInput.Value = ClampToRange(_cameraOffsetXInput, room.CameraOffsetX);
        _cameraOffsetYInput.Value = ClampToRange(_cameraOffsetYInput, room.CameraOffsetY);

        _updatingUi = false;
        RefreshEntityPanel();
        RefreshDecalPanel();
    }

    private void ApplyRoom()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        _sendCommand(new UpdateRoomCommand(
            _snapshot.Room.Name,
            _roomNameTextBox.Text.Trim(),
            Decimal.ToInt32(_roomXInput.Value),
            Decimal.ToInt32(_roomYInput.Value),
            Decimal.ToInt32(_roomWidthInput.Value),
            Decimal.ToInt32(_roomHeightInput.Value),
            _musicTextBox.Text,
            _altMusicTextBox.Text,
            _ambienceTextBox.Text,
            _windPatternTextBox.Text,
            Decimal.ToInt32(_colorInput.Value),
            _darkCheckBox.Checked,
            _underwaterCheckBox.Checked,
            _spaceCheckBox.Checked,
            _disableDownTransitionCheckBox.Checked,
            Decimal.ToInt32(_cameraOffsetXInput.Value),
            Decimal.ToInt32(_cameraOffsetYInput.Value)));
    }

    private void RefreshEntityPanel()
    {
        if (_updatingUi)
        {
            return;
        }

        var previousIndex = _entityListBox.SelectedIndex;
        _entityListBox.Items.Clear();
        foreach (var entity in CurrentEntityCollection())
        {
            _entityListBox.Items.Add($"{entity.Index}: {entity.Name} [{entity.X}, {entity.Y}] {entity.Width}x{entity.Height}");
        }

        if (_entityListBox.Items.Count > 0)
        {
            _entityListBox.SelectedIndex = Math.Clamp(previousIndex, 0, _entityListBox.Items.Count - 1);
        }
        else
        {
            ClearEntityFields();
        }

        RefreshEntityDetails();
    }

    private void RefreshEntityDetails()
    {
        if (_updatingUi)
        {
            return;
        }

        var entity = CurrentEntitySelection();
        if (entity is null)
        {
            ClearEntityFields();
            return;
        }

        _updatingUi = true;
        _entityNameTextBox.Text = entity.Name;
        _entityXInput.Value = ClampToRange(_entityXInput, entity.X);
        _entityYInput.Value = ClampToRange(_entityYInput, entity.Y);
        _entityWidthInput.Value = ClampToRange(_entityWidthInput, entity.Width);
        _entityHeightInput.Value = ClampToRange(_entityHeightInput, entity.Height);
        _entityAttributesGrid.Rows.Clear();
        foreach (var attribute in entity.Attributes)
        {
            _entityAttributesGrid.Rows.Add(attribute.Key, attribute.Value);
        }
        _updatingUi = false;
    }

    private void ApplyEntity()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        var entity = CurrentEntitySelection();
        if (entity is null)
        {
            return;
        }

        _sendCommand(new UpdateEntityCommand(
            _snapshot.Room.Name,
            IsTriggerCollection(),
            entity.Index,
            _entityNameTextBox.Text.Trim(),
            Decimal.ToInt32(_entityXInput.Value),
            Decimal.ToInt32(_entityYInput.Value),
            Decimal.ToInt32(_entityWidthInput.Value),
            Decimal.ToInt32(_entityHeightInput.Value),
            ReadAttributeRows()));
    }

    private void AddEntity()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        var name = string.IsNullOrWhiteSpace(_entityNameTextBox.Text)
            ? (IsTriggerCollection() ? "trigger" : "entity")
            : _entityNameTextBox.Text.Trim();
        _sendCommand(new AddEntityCommand(_snapshot.Room.Name, IsTriggerCollection(), name));
    }

    private void RemoveEntity()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        var entity = CurrentEntitySelection();
        if (entity is null)
        {
            return;
        }

        _sendCommand(new RemoveEntityCommand(_snapshot.Room.Name, IsTriggerCollection(), entity.Index));
    }

    private void RefreshDecalPanel()
    {
        if (_updatingUi)
        {
            return;
        }

        var previousIndex = _decalListBox.SelectedIndex;
        _decalListBox.Items.Clear();
        foreach (var decal in CurrentDecalCollection())
        {
            _decalListBox.Items.Add($"{decal.Index}: {decal.Texture} [{decal.X}, {decal.Y}]");
        }

        if (_decalListBox.Items.Count > 0)
        {
            _decalListBox.SelectedIndex = Math.Clamp(previousIndex, 0, _decalListBox.Items.Count - 1);
        }
        else
        {
            ClearDecalFields();
        }

        RefreshDecalDetails();
    }

    private void RefreshDecalDetails()
    {
        if (_updatingUi)
        {
            return;
        }

        var decal = CurrentDecalSelection();
        if (decal is null)
        {
            ClearDecalFields();
            return;
        }

        _updatingUi = true;
        _decalTextureTextBox.Text = decal.Texture;
        _decalXInput.Value = ClampToRange(_decalXInput, decal.X);
        _decalYInput.Value = ClampToRange(_decalYInput, decal.Y);
        _decalScaleXInput.Value = ClampToRange(_decalScaleXInput, decal.ScaleX);
        _decalScaleYInput.Value = ClampToRange(_decalScaleYInput, decal.ScaleY);
        _decalRotationInput.Value = ClampToRange(_decalRotationInput, decal.Rotation);
        _decalColorTextBox.Text = decal.Color;
        _updatingUi = false;
    }

    private void ApplyDecal()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        var decal = CurrentDecalSelection();
        if (decal is null)
        {
            return;
        }

        _sendCommand(new UpdateDecalCommand(
            _snapshot.Room.Name,
            IsForegroundDecalLayer(),
            decal.Index,
            _decalTextureTextBox.Text.Trim(),
            Decimal.ToInt32(_decalXInput.Value),
            Decimal.ToInt32(_decalYInput.Value),
            Decimal.ToSingle(_decalScaleXInput.Value),
            Decimal.ToSingle(_decalScaleYInput.Value),
            Decimal.ToSingle(_decalRotationInput.Value),
            _decalColorTextBox.Text.Trim()));
    }

    private void AddDecal()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        var texture = string.IsNullOrWhiteSpace(_decalTextureTextBox.Text) ? "decals/sample" : _decalTextureTextBox.Text.Trim();
        _sendCommand(new AddDecalCommand(_snapshot.Room.Name, IsForegroundDecalLayer(), texture));
    }

    private void RemoveDecal()
    {
        if (_snapshot?.Room is null)
        {
            return;
        }

        var decal = CurrentDecalSelection();
        if (decal is null)
        {
            return;
        }

        _sendCommand(new RemoveDecalCommand(_snapshot.Room.Name, IsForegroundDecalLayer(), decal.Index));
    }

    private IReadOnlyList<InspectorEntitySnapshot> CurrentEntityCollection()
    {
        if (_snapshot is null)
        {
            return Array.Empty<InspectorEntitySnapshot>();
        }

        return IsTriggerCollection() ? _snapshot.Triggers : _snapshot.Entities;
    }

    private InspectorEntitySnapshot? CurrentEntitySelection()
    {
        var collection = CurrentEntityCollection();
        return _entityListBox.SelectedIndex >= 0 && _entityListBox.SelectedIndex < collection.Count
            ? collection[_entityListBox.SelectedIndex]
            : null;
    }

    private IReadOnlyList<InspectorDecalSnapshot> CurrentDecalCollection()
    {
        if (_snapshot is null)
        {
            return Array.Empty<InspectorDecalSnapshot>();
        }

        return IsForegroundDecalLayer() ? _snapshot.ForegroundDecals : _snapshot.BackgroundDecals;
    }

    private InspectorDecalSnapshot? CurrentDecalSelection()
    {
        var collection = CurrentDecalCollection();
        return _decalListBox.SelectedIndex >= 0 && _decalListBox.SelectedIndex < collection.Count
            ? collection[_decalListBox.SelectedIndex]
            : null;
    }

    private bool IsTriggerCollection() => _entityCollectionComboBox.SelectedIndex == 1;

    private bool IsForegroundDecalLayer() => _decalLayerComboBox.SelectedIndex == 0;

    private Dictionary<string, string> ReadAttributeRows()
    {
        var attributes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (DataGridViewRow row in _entityAttributesGrid.Rows)
        {
            if (row.IsNewRow)
            {
                continue;
            }

            var key = Convert.ToString(row.Cells[0].Value)?.Trim();
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            attributes[key] = Convert.ToString(row.Cells[1].Value) ?? string.Empty;
        }

        return attributes;
    }

    private void ClearRoomFields()
    {
        _roomNameTextBox.Text = string.Empty;
        _roomXInput.Value = 0;
        _roomYInput.Value = 0;
        _roomWidthInput.Value = 320;
        _roomHeightInput.Value = 184;
        _musicTextBox.Text = string.Empty;
        _altMusicTextBox.Text = string.Empty;
        _ambienceTextBox.Text = string.Empty;
        _windPatternTextBox.Text = string.Empty;
        _colorInput.Value = 0;
        _darkCheckBox.Checked = false;
        _underwaterCheckBox.Checked = false;
        _spaceCheckBox.Checked = false;
        _disableDownTransitionCheckBox.Checked = false;
        _cameraOffsetXInput.Value = 0;
        _cameraOffsetYInput.Value = 0;
    }

    private void ClearEntityFields()
    {
        _entityListBox.Items.Clear();
        _entityNameTextBox.Text = string.Empty;
        _entityAttributesGrid.Rows.Clear();
    }

    private void ClearDecalFields()
    {
        _decalListBox.Items.Clear();
        _decalTextureTextBox.Text = string.Empty;
        _decalColorTextBox.Text = string.Empty;
    }

    private static Panel CreateScrollPanel()
    {
        return new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
        };
    }

    private static TableLayoutPanel CreateFieldTable(Control parent)
    {
        var table = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            ColumnCount = 1,
        };
        parent.Controls.Add(table);
        return table;
    }

    private static void AddField(TableLayoutPanel table, string label, Control control)
    {
        table.Controls.Add(CreateFieldPanel(label, control));
    }

    private static Panel CreateFieldPanel(string label, Control control)
    {
        var panel = new Panel
        {
            Dock = DockStyle.Top,
            Height = Math.Max(control.Height + 26, 52),
            Padding = new Padding(0, 4, 0, 4),
        };
        var labelControl = new Label
        {
            Text = label,
            Dock = DockStyle.Top,
            AutoSize = true,
        };
        control.Dock = DockStyle.Top;
        panel.Controls.Add(control);
        panel.Controls.Add(labelControl);
        return panel;
    }

    private static FlowLayoutPanel StackHorizontal(params Control[] controls)
    {
        var panel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            Padding = new Padding(0, 6, 0, 0),
        };
        panel.Controls.AddRange(controls);
        return panel;
    }

    private static FlowLayoutPanel StackVertical(params Control[] controls)
    {
        var panel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
        };
        panel.Controls.AddRange(controls);
        return panel;
    }

    private static TextBox CreateTextBox()
    {
        return new TextBox { Dock = DockStyle.Top };
    }

    private static NumericUpDown CreateIntegerInput(int minimum, int maximum, int value = 0, int increment = 1)
    {
        return new NumericUpDown
        {
            Dock = DockStyle.Top,
            Minimum = minimum,
            Maximum = maximum,
            Value = Math.Clamp(value, minimum, maximum),
            Increment = increment,
        };
    }

    private static NumericUpDown CreateDecimalInput(decimal minimum, decimal maximum, decimal value)
    {
        return new NumericUpDown
        {
            Dock = DockStyle.Top,
            Minimum = minimum,
            Maximum = maximum,
            Value = Math.Clamp(value, minimum, maximum),
            DecimalPlaces = 2,
            Increment = 0.1m,
        };
    }

    private static decimal ClampToRange(NumericUpDown input, int value)
    {
        return Math.Clamp(value, Decimal.ToInt32(input.Minimum), Decimal.ToInt32(input.Maximum));
    }

    private static decimal ClampToRange(NumericUpDown input, float value)
    {
        var decimalValue = (decimal)value;
        return Math.Clamp(decimalValue, input.Minimum, input.Maximum);
    }
}