using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace CelestePcgLauncher;

internal sealed class MainForm : Form
{
    private static readonly Color NightBackground = NightTheme.Background;
    private static readonly Color NightPanel = NightTheme.Panel;
    private static readonly Color NightPanelAlt = NightTheme.PanelAlt;
    private static readonly Color NightInput = NightTheme.Input;
    private static readonly Color NightBorder = NightTheme.Border;
    private static readonly Color NightText = NightTheme.Text;
    private static readonly Color NightMuted = NightTheme.Muted;
    private static readonly Color NightAction = NightTheme.Action;
    private static readonly Color NightActionSecondary = NightTheme.ActionSecondary;

    private const string ExecutableName = "celeste_pcg_generator.exe";
    private static readonly string SettingsDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "CelestePcgLauncher");
    private static readonly string SettingsFilePath = Path.Combine(SettingsDirectory, "settings.json");

    private readonly ComboBox _modeComboBox;
    private readonly TextBox _seedTextBox;
    private readonly CheckBox _autoRandomizeSeedCheckBox;
    private readonly ComboBox _kitComboBox;
    private readonly ComboBox _layoutComboBox;
    private readonly ComboBox _archetypeComboBox;
    private readonly ComboBox _previewModeComboBox;
    private readonly ComboBox _overlayModeComboBox;
    private readonly Label _kitTitleLabel;
    private readonly Label _kitDescriptionLabel;
    private readonly Label _layoutDescriptionLabel;
    private readonly Label _archetypeDescriptionLabel;
    private readonly NumericUpDown _clusterWidthInput;
    private readonly NumericUpDown _clusterHeightInput;
    private readonly NumericUpDown _roomWidthInput;
    private readonly NumericUpDown _roomHeightInput;
    private readonly NumericUpDown _roomGapInput;
    private readonly TextBox _packageNameTextBox;
    private readonly TextBox _outputPathTextBox;
    private readonly CheckBox _exportBinCheckBox;
    private readonly CheckBox _strictVanillaBinCheckBox;
    private readonly TextBox _binOutputPathTextBox;
    private readonly Label _generatorPathLabel;
    private readonly Label _summaryLabel;
    private readonly Label _seedLabel;
    private readonly Label _previewHintLabel;
    private readonly MapPreviewPanel _mapPreviewPanel;
    private readonly TextBox _jsonOutputTextBox;
    private readonly Button _generateButton;
    private readonly Button _exportButton;
    private readonly Button _convertButton;
    private readonly Button _saveButton;
    private readonly Button _browseButton;
    private readonly Button _browseBinButton;
    private readonly Button _resetViewButton;

    private string? _lastGeneratedJson;
    private string? _lastSeedLabel;

    public MainForm()
    {
        Text = "Celeste PCG Launcher";
        MinimumSize = new Size(1120, 820);
        StartPosition = FormStartPosition.CenterScreen;
        KeyPreview = true;
        BackColor = NightBackground;
        ForeColor = NightText;

        var rootLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 5,
            Padding = new Padding(14),
            BackColor = NightBackground,
        };
        rootLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        rootLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        rootLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        rootLayout.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        rootLayout.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
        Controls.Add(rootLayout);

        var headerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 76,
            BackColor = NightPanel,
            Padding = new Padding(14, 12, 14, 10),
            Margin = new Padding(0, 0, 0, 10),
        };
        rootLayout.Controls.Add(headerPanel, 0, 0);

        var headerLabel = new Label
        {
            AutoSize = true,
            Font = new Font(Font.FontFamily, 14f, FontStyle.Bold),
            ForeColor = NightText,
            Text = "Celeste PCG Launcher",
            Location = new Point(0, 0),
        };
        headerPanel.Controls.Add(headerLabel);

        var subHeaderLabel = new Label
        {
            AutoSize = true,
            ForeColor = NightMuted,
            Text = "Night mode, themed kit guidance, and full-map preview controls for review before export.",
            Location = new Point(1, 34),
        };
        headerPanel.Controls.Add(subHeaderLabel);

        var generatorPath = FindNativeGeneratorExecutable();
        _generatorPathLabel = new Label
        {
            AutoSize = true,
            Text = generatorPath is null
                ? "Native generator: not found. Build it with npm run build:native or publish the launcher bundle."
                : $"Native generator: {generatorPath}",
            ForeColor = NightMuted,
            Margin = new Padding(0, 0, 0, 10),
        };
        rootLayout.Controls.Add(_generatorPathLabel, 0, 1);

        var settingsShell = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            ColumnCount = 2,
            AutoSize = true,
            BackColor = NightBackground,
            Margin = new Padding(0, 0, 0, 10),
        };
        settingsShell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 62f));
        settingsShell.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 38f));
        rootLayout.Controls.Add(settingsShell, 0, 2);

        var settingsPanel = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 6,
            AutoSize = true,
            BackColor = NightPanel,
            Padding = new Padding(14, 12, 14, 12),
            Margin = new Padding(0, 0, 10, 0),
        };
        settingsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        settingsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        settingsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        settingsPanel.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50f));
        settingsShell.Controls.Add(settingsPanel, 0, 0);

        _modeComboBox = CreateComboBox("pseudo", "true");
        _seedTextBox = CreateTextBox(string.Empty);
        _autoRandomizeSeedCheckBox = new CheckBox
        {
            AutoSize = true,
            Checked = true,
            Text = "Auto-randomize pseudo seed each run",
            BackColor = NightPanel,
            ForeColor = NightText,
        };
        _kitComboBox = CreateComboBox(LauncherKitCatalog.GetIds());
        _kitComboBox.SelectedIndexChanged += (_, _) => RefreshSelectedKitDetails();
        _layoutComboBox = CreateComboBox("grid", "criticalPath", "criticalPathBranches", "celesteRandomizer", "openSkeleton");
        _layoutComboBox.SelectedIndexChanged += (_, _) =>
        {
            RefreshSelectedKitDetails();
            _mapPreviewPanel?.SetLayoutMode(_layoutComboBox.Text);
        };
        _archetypeComboBox = CreateComboBox("linearAscent", "longRunDensityBurst", "spineCompactBranching", "landmarkCorridor", "celesteCategory", "segmentedSummit");
        _archetypeComboBox.SelectedIndexChanged += (_, _) => RefreshSelectedKitDetails();
        _previewModeComboBox = CreateComboBox(MapPreviewPanel.PreviewModeCombined, MapPreviewPanel.PreviewModeRooms, MapPreviewPanel.PreviewModeTopology);
        _previewModeComboBox.Width = 110;
        _previewModeComboBox.SelectedIndexChanged += (_, _) => _mapPreviewPanel?.SetPreviewMode(_previewModeComboBox.Text);
        _overlayModeComboBox = CreateComboBox(MapPreviewPanel.OverlayModeAll, MapPreviewPanel.OverlayModePhase, MapPreviewPanel.OverlayModeRole);
        _overlayModeComboBox.Width = 94;
        _overlayModeComboBox.SelectedIndexChanged += (_, _) => _mapPreviewPanel?.SetOverlayMode(_overlayModeComboBox.Text);
        _clusterWidthInput = CreateNumericInput(1, 12, 2);
        _clusterHeightInput = CreateNumericInput(1, 12, 2);
        _roomWidthInput = CreateNumericInput(80, 1024, 320);
        _roomHeightInput = CreateNumericInput(80, 1024, 184);
        _roomGapInput = CreateNumericInput(0, 128, 16);
        _packageNameTextBox = CreateTextBox("CelestePcg/GeneratedCluster");
        _outputPathTextBox = CreateTextBox(DefaultJsonOutputPath());
        _exportBinCheckBox = new CheckBox
        {
            AutoSize = true,
            Checked = true,
            Text = "Write map.bin after generation",
            BackColor = NightPanel,
            ForeColor = NightText,
        };
        _strictVanillaBinCheckBox = new CheckBox
        {
            AutoSize = true,
            Checked = true,
            Text = "Strict vanilla map.bin schema",
            BackColor = NightPanel,
            ForeColor = NightText,
        };
        _binOutputPathTextBox = CreateTextBox(DefaultBinOutputPath());
        _browseButton = CreateActionButton("Browse JSON...", NightActionSecondary);
        _browseButton.Margin = new Padding(6, 3, 0, 3);
        _browseButton.Click += (_, _) => BrowseJsonOutputPath();
        _browseBinButton = CreateActionButton("Browse BIN...", NightActionSecondary);
        _browseBinButton.Margin = new Padding(6, 3, 0, 3);
        _browseBinButton.Click += (_, _) => BrowseBinOutputPath();

        AddField(settingsPanel, 0, "Mode", _modeComboBox);
        AddField(settingsPanel, 1, "Seed", _seedTextBox);
        AddField(settingsPanel, 2, "Seed Mode", _autoRandomizeSeedCheckBox);
        AddField(settingsPanel, 3, "Kit", _kitComboBox);
        AddField(settingsPanel, 4, "Layout", _layoutComboBox);
        AddField(settingsPanel, 5, "Archetype", _archetypeComboBox);
        AddField(settingsPanel, 6, "Cluster Width", _clusterWidthInput);
        AddField(settingsPanel, 7, "Cluster Height", _clusterHeightInput);
        AddField(settingsPanel, 8, "Room Width", _roomWidthInput);
        AddField(settingsPanel, 9, "Room Height", _roomHeightInput);
        AddField(settingsPanel, 10, "Room Gap", _roomGapInput);
        AddField(settingsPanel, 11, "Package Name", _packageNameTextBox);

        var outputPanel = CreatePathPickerPanel(_outputPathTextBox, _browseButton);
        AddField(settingsPanel, 12, "Output JSON", outputPanel);
        AddField(settingsPanel, 13, "Export map.bin", _exportBinCheckBox);
        AddField(settingsPanel, 14, "map.bin Schema", _strictVanillaBinCheckBox);
        var binOutputPanel = CreatePathPickerPanel(_binOutputPathTextBox, _browseBinButton);
        AddField(settingsPanel, 15, "Output map.bin", binOutputPanel);

        var kitPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = NightPanelAlt,
            Padding = new Padding(14, 12, 14, 12),
            Margin = new Padding(0),
        };
        settingsShell.Controls.Add(kitPanel, 1, 0);

        var kitPanelTitle = new Label
        {
            AutoSize = true,
            Font = new Font(Font.FontFamily, 11f, FontStyle.Bold),
            ForeColor = NightText,
            Text = "Kit Guide",
            Location = new Point(0, 0),
        };
        kitPanel.Controls.Add(kitPanelTitle);

        _kitTitleLabel = new Label
        {
            AutoSize = true,
            Font = new Font(Font.FontFamily, 10f, FontStyle.Bold),
            ForeColor = NightText,
            Location = new Point(0, 34),
        };
        kitPanel.Controls.Add(_kitTitleLabel);

        _kitDescriptionLabel = new Label
        {
            AutoSize = false,
            Size = new Size(330, 92),
            ForeColor = NightMuted,
            Location = new Point(0, 62),
        };
        kitPanel.Controls.Add(_kitDescriptionLabel);

        _layoutDescriptionLabel = new Label
        {
            AutoSize = false,
            Size = new Size(330, 64),
            ForeColor = NightMuted,
            Location = new Point(0, 132),
        };
        kitPanel.Controls.Add(_layoutDescriptionLabel);

        _archetypeDescriptionLabel = new Label
        {
            AutoSize = false,
            Size = new Size(330, 64),
            ForeColor = NightMuted,
            Location = new Point(0, 198),
        };
        kitPanel.Controls.Add(_archetypeDescriptionLabel);

        _previewHintLabel = new Label
        {
            AutoSize = false,
            Size = new Size(330, 82),
            ForeColor = NightMuted,
            Text = "Preview controls\r\nMouse wheel or +/-: zoom\r\nLeft-drag or arrows: pan\r\nPreview modes: combined, rooms, topology-fit\r\nOverlay filter: all, phase, or role\r\nDouble-click, Reset View, or Ctrl+0: refit current view",
            Location = new Point(0, 270),
        };
        kitPanel.Controls.Add(_previewHintLabel);

        var actionPanel = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            FlowDirection = FlowDirection.LeftToRight,
            AutoSize = true,
            Margin = new Padding(0, 0, 0, 12),
            BackColor = NightBackground,
        };
        rootLayout.Controls.Add(actionPanel, 0, 3);

        _generateButton = CreateActionButton("Generate Preview", NightAction);
        _generateButton.Click += async (_, _) => await GenerateAsync();
        actionPanel.Controls.Add(_generateButton);

        _exportButton = CreateActionButton("Export JSON / map.bin", NightActionSecondary);
        _exportButton.Click += async (_, _) => await ExportFilesAsync();
        actionPanel.Controls.Add(_exportButton);

        _convertButton = CreateActionButton("Convert JSON -> map.bin", NightActionSecondary);
        _convertButton.Click += async (_, _) => await ConvertJsonToBinAsync();
        actionPanel.Controls.Add(_convertButton);

        actionPanel.Controls.Add(new Label
        {
            AutoSize = true,
            Margin = new Padding(8, 9, 4, 0),
            Text = "Preview",
            ForeColor = NightMuted,
        });
        actionPanel.Controls.Add(_previewModeComboBox);

        actionPanel.Controls.Add(new Label
        {
            AutoSize = true,
            Margin = new Padding(8, 9, 4, 0),
            Text = "Overlay",
            ForeColor = NightMuted,
        });
        actionPanel.Controls.Add(_overlayModeComboBox);

        _resetViewButton = CreateActionButton("Reset View", NightActionSecondary);
        _resetViewButton.Click += (_, _) => _mapPreviewPanel?.ResetView();
        actionPanel.Controls.Add(_resetViewButton);

        _saveButton = CreateActionButton("Open Output Folder", NightActionSecondary);
        _saveButton.Click += (_, _) => OpenOutputFolder();
        actionPanel.Controls.Add(_saveButton);

        _summaryLabel = new Label
        {
            AutoSize = true,
            Margin = new Padding(18, 9, 0, 0),
            Text = "Summary: waiting for generation",
            ForeColor = NightText,
        };
        actionPanel.Controls.Add(_summaryLabel);

        _seedLabel = new Label
        {
            AutoSize = true,
            Margin = new Padding(18, 9, 0, 0),
            Text = "Seed: n/a",
            ForeColor = NightMuted,
        };
        actionPanel.Controls.Add(_seedLabel);

        var previewSplitContainer = new SplitContainer
        {
            Dock = DockStyle.Fill,
            Orientation = Orientation.Vertical,
            BackColor = NightBackground,
        };
        previewSplitContainer.SizeChanged += (_, _) => ApplyPreviewSplitDistance(previewSplitContainer);
        previewSplitContainer.Panel1.BackColor = NightBackground;
        previewSplitContainer.Panel2.BackColor = NightBackground;
        rootLayout.Controls.Add(previewSplitContainer, 0, 4);
        Load += (_, _) => ApplyPreviewSplitDistance(previewSplitContainer);

        var previewGroup = CreateGroupContainer("Map Preview");
        previewSplitContainer.Panel1.Controls.Add(previewGroup);

        _mapPreviewPanel = new MapPreviewPanel
        {
            Dock = DockStyle.Fill,
        };
        _mapPreviewPanel.SetPreviewMode(_previewModeComboBox.Text);
        _mapPreviewPanel.SetOverlayMode(_overlayModeComboBox.Text);
        previewGroup.Controls.Add(_mapPreviewPanel);

        var jsonGroup = CreateGroupContainer("Generated JSON");
        previewSplitContainer.Panel2.Controls.Add(jsonGroup);

        _jsonOutputTextBox = new TextBox
        {
            Dock = DockStyle.Fill,
            Multiline = true,
            ScrollBars = ScrollBars.Both,
            ReadOnly = true,
            WordWrap = false,
            Font = new Font(FontFamily.GenericMonospace, 9f),
            BackColor = NightInput,
            ForeColor = NightText,
            BorderStyle = BorderStyle.FixedSingle,
        };
        jsonGroup.Controls.Add(_jsonOutputTextBox);

        LoadLauncherSettings();
        ApplyNightTheme(this);
        RefreshSelectedKitDetails();
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (_mapPreviewPanel.HasPreview)
        {
            switch (keyData)
            {
                case Keys.Control | Keys.D0:
                case Keys.Control | Keys.NumPad0:
                    _mapPreviewPanel.ResetView();
                    return true;
                case Keys.Control | Keys.Add:
                case Keys.Control | Keys.Oemplus:
                    _mapPreviewPanel.ZoomIn();
                    return true;
                case Keys.Control | Keys.Subtract:
                case Keys.Control | Keys.OemMinus:
                    _mapPreviewPanel.ZoomOut();
                    return true;
            }
        }

        return base.ProcessCmdKey(ref msg, keyData);
    }

    private static void ApplyPreviewSplitDistance(SplitContainer splitContainer)
    {
        var availableWidth = splitContainer.ClientSize.Width;
        if (availableWidth <= splitContainer.SplitterWidth + 1)
        {
            return;
        }

        var panel2MinSize = Math.Min(260, Math.Max(0, availableWidth - splitContainer.SplitterWidth - 1));
        var panel1MinSize = Math.Min(420, Math.Max(0, availableWidth - panel2MinSize - splitContainer.SplitterWidth));
        splitContainer.Panel1MinSize = 0;
        splitContainer.Panel2MinSize = 0;

        var maximumPanel1Width = Math.Max(panel1MinSize, availableWidth - panel2MinSize - splitContainer.SplitterWidth);
        var preferredPanel1Width = Math.Min(Math.Max((availableWidth * 3) / 5, 780), maximumPanel1Width);
        if (preferredPanel1Width >= splitContainer.Panel1MinSize && preferredPanel1Width <= maximumPanel1Width)
        {
            splitContainer.SplitterDistance = preferredPanel1Width;
        }

        splitContainer.Panel1MinSize = panel1MinSize;
        splitContainer.Panel2MinSize = panel2MinSize;
    }

    private async Task GenerateAsync()
    {
        var generatorPath = FindNativeGeneratorExecutable();
        if (generatorPath is null)
        {
            MessageBox.Show(this, "Could not find celeste_pcg_generator.exe. Build it first with npm run build:native or publish the launcher bundle.", "Native Generator Missing", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        try
        {
            ToggleBusyState(true);
            _mapPreviewPanel.SetStatus("Generating preview...");
            var arguments = BuildArguments();
            var response = await RunGeneratorAsync(generatorPath, arguments);

            _lastGeneratedJson = response.RawJson;
            _lastSeedLabel = response.SeedLabel;
            LoadPreviewFromJson(response.RawJson);
            _summaryLabel.Text = $"Summary: {response.Summary} Preview ready. Export when you are satisfied with the layout.";
            _seedLabel.Text = $"Seed: {response.SeedLabel}";
            _jsonOutputTextBox.Text = FormatJsonForDisplay(response.RawJson);
            _generatorPathLabel.Text = $"Native generator: {generatorPath}";
            SaveLauncherSettings();
        }
        catch (Exception error)
        {
            _mapPreviewPanel.SetStatus("Generation failed. Check the error dialog and try again.");
            MessageBox.Show(this, error.Message, "PCG Generation Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            ToggleBusyState(false);
        }
    }

    private async Task ExportFilesAsync()
    {
        try
        {
            ToggleBusyState(true);

            if (string.IsNullOrWhiteSpace(_lastGeneratedJson))
            {
                throw new InvalidOperationException("Generate a preview first so there is map data to export.");
            }

            Directory.CreateDirectory(Path.GetDirectoryName(_outputPathTextBox.Text) ?? AppContext.BaseDirectory);
            await File.WriteAllTextAsync(_outputPathTextBox.Text, _lastGeneratedJson);

            var exportMessages = new List<string>
            {
                $"JSON saved to {Path.GetFileName(_outputPathTextBox.Text)}",
            };

            if (_exportBinCheckBox.Checked)
            {
                await WriteBinFromJsonAsync(_lastGeneratedJson);
                exportMessages.Add($"map.bin ({GetSelectedMapBinSchemaLabel()}) saved to {Path.GetFileName(_binOutputPathTextBox.Text)}");
            }

            _summaryLabel.Text = $"Summary: Export complete. {string.Join("; ", exportMessages)}.";
            if (!string.IsNullOrWhiteSpace(_lastSeedLabel))
            {
                _seedLabel.Text = $"Seed: {_lastSeedLabel}";
            }
            SaveLauncherSettings();
        }
        catch (Exception error)
        {
            MessageBox.Show(this, error.Message, "Export Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            ToggleBusyState(false);
        }
    }

    private void OpenOutputFolder()
    {
        var targetPath = _exportBinCheckBox.Checked ? _binOutputPathTextBox.Text : _outputPathTextBox.Text;
        var directory = Path.GetDirectoryName(targetPath);
        if (string.IsNullOrWhiteSpace(directory))
        {
            return;
        }

        Directory.CreateDirectory(directory);
        Process.Start(new ProcessStartInfo
        {
            FileName = directory,
            UseShellExecute = true,
        });
    }

    private void BrowseJsonOutputPath()
    {
        using var dialog = new SaveFileDialog
        {
            Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
            FileName = Path.GetFileName(_outputPathTextBox.Text),
            InitialDirectory = Path.GetDirectoryName(_outputPathTextBox.Text),
        };

        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            _outputPathTextBox.Text = dialog.FileName;
        }
    }

    private void BrowseBinOutputPath()
    {
        using var dialog = new SaveFileDialog
        {
            Filter = "Celeste map (*.bin)|*.bin|All files (*.*)|*.*",
            FileName = Path.GetFileName(_binOutputPathTextBox.Text),
            InitialDirectory = Path.GetDirectoryName(_binOutputPathTextBox.Text),
        };

        if (dialog.ShowDialog(this) == DialogResult.OK)
        {
            _binOutputPathTextBox.Text = dialog.FileName;
        }
    }

    private string[] BuildArguments()
    {
        var arguments = new List<string>
        {
            "--mode", _modeComboBox.Text,
            "--layout", _layoutComboBox.Text,
            "--archetype", _archetypeComboBox.Text,
            "--cluster-width", Decimal.ToInt32(_clusterWidthInput.Value).ToString(),
            "--cluster-height", Decimal.ToInt32(_clusterHeightInput.Value).ToString(),
            "--room-width", Decimal.ToInt32(_roomWidthInput.Value).ToString(),
            "--room-height", Decimal.ToInt32(_roomHeightInput.Value).ToString(),
            "--room-gap", Decimal.ToInt32(_roomGapInput.Value).ToString(),
            "--kit", _kitComboBox.Text,
        };

        var seedText = _seedTextBox.Text.Trim();
        if (string.Equals(_modeComboBox.Text, "pseudo", StringComparison.OrdinalIgnoreCase)
            && _autoRandomizeSeedCheckBox.Checked)
        {
            seedText = GenerateRandomPseudoSeed().ToString();
            _seedTextBox.Text = seedText;
        }

        if (!string.IsNullOrWhiteSpace(seedText))
        {
            if (!uint.TryParse(seedText, out _))
            {
                throw new InvalidOperationException("Seed must be an unsigned integer or empty.");
            }

            arguments.Add("--seed");
            arguments.Add(seedText);
        }

        return arguments.ToArray();
    }

    protected override void OnFormClosing(FormClosingEventArgs error)
    {
        SaveLauncherSettings();
        base.OnFormClosing(error);
    }

    private async Task ConvertJsonToBinAsync()
    {
        try
        {
            ToggleBusyState(true);

            if (!File.Exists(_outputPathTextBox.Text))
            {
                throw new InvalidOperationException("The JSON source file does not exist. Generate JSON first or point Output JSON at an existing file.");
            }

            var rawJson = await File.ReadAllTextAsync(_outputPathTextBox.Text);
            _lastGeneratedJson = rawJson;
            _lastSeedLabel = null;
            LoadPreviewFromJson(rawJson);
            _jsonOutputTextBox.Text = FormatJsonForDisplay(rawJson);
            await WriteBinFromJsonAsync(rawJson);
            _summaryLabel.Text = $"Summary: Converted {Path.GetFileName(_outputPathTextBox.Text)} to {Path.GetFileName(_binOutputPathTextBox.Text)} using {GetSelectedMapBinSchemaLabel()} mode and loaded the preview.";
            _seedLabel.Text = "Seed: reused existing JSON";
            SaveLauncherSettings();
        }
        catch (Exception error)
        {
            MessageBox.Show(this, error.Message, "JSON to map.bin Failed", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally
        {
            ToggleBusyState(false);
        }
    }

    private async Task WriteBinFromJsonAsync(string rawJson)
    {
        var map = CelesteMapJsonConverter.ParseMap(rawJson, ResolvePackageName());
        var bytes = CelesteMapBinarySerializer.Serialize(map, ResolveMapBinSchemaMode());

        Directory.CreateDirectory(Path.GetDirectoryName(_binOutputPathTextBox.Text) ?? AppContext.BaseDirectory);
        await File.WriteAllBytesAsync(_binOutputPathTextBox.Text, bytes);
    }

    private MapBinSchemaMode ResolveMapBinSchemaMode()
    {
        return _strictVanillaBinCheckBox.Checked
            ? MapBinSchemaMode.StrictVanilla
            : MapBinSchemaMode.ExtensionFriendly;
    }

    private string GetSelectedMapBinSchemaLabel()
    {
        return _strictVanillaBinCheckBox.Checked ? "strict vanilla" : "extension-friendly";
    }

    private string ResolvePackageName()
    {
        if (!string.IsNullOrWhiteSpace(_packageNameTextBox.Text))
        {
            return _packageNameTextBox.Text.Trim();
        }

        var fileName = Path.GetFileNameWithoutExtension(_binOutputPathTextBox.Text);
        if (!string.IsNullOrWhiteSpace(fileName))
        {
            return fileName;
        }

        return "CelestePcg/GeneratedCluster";
    }

    private void LoadPreviewFromJson(string rawJson)
    {
        var map = CelesteMapJsonConverter.ParseMap(rawJson, ResolvePackageName());
        var kit = LauncherKitCatalog.InferFromMap(map, _kitComboBox.Text);
        if (map.PreviewMetadata is not null)
        {
            ApplyComboBoxSelection(_layoutComboBox, map.PreviewMetadata.LayoutMode);
            ApplyComboBoxSelection(_archetypeComboBox, map.PreviewMetadata.Archetype);
        }
        ApplyComboBoxSelection(_kitComboBox, kit.Id);
        _mapPreviewPanel.SetPreviewMap(map, kit, _layoutComboBox.Text);
        _mapPreviewPanel.SetPreviewMode(_previewModeComboBox.Text);
        _mapPreviewPanel.SetOverlayMode(_overlayModeComboBox.Text);
        RefreshSelectedKitDetails();
    }

    private void RefreshSelectedKitDetails()
    {
        var kit = LauncherKitCatalog.Get(_kitComboBox.Text);
        _kitTitleLabel.Text = kit.Title;
        _kitTitleLabel.ForeColor = kit.AccentColor;
        _kitDescriptionLabel.Text = kit.Description;
        _layoutDescriptionLabel.Text = ResolveLayoutDescription(_layoutComboBox.Text);
        _archetypeDescriptionLabel.Text = ResolveArchetypeDescription(_archetypeComboBox.Text);
        _mapPreviewPanel.SetSelectedKitTheme(kit);
        _mapPreviewPanel.SetLayoutMode(_layoutComboBox.Text);
        _mapPreviewPanel.SetPreviewMode(_previewModeComboBox.Text);
        _mapPreviewPanel.SetOverlayMode(_overlayModeComboBox.Text);
    }

    private static string ResolveLayoutDescription(string? layout)
    {
        return layout switch
        {
            "criticalPath" => "Layout: one start-to-goal route that uses the full room set. Best for direct Celeste pacing.",
            "criticalPathBranches" => "Layout: one main route plus side rooms for berries, detours, and optional challenge pockets.",
            "celesteRandomizer" => "Layout: paper-inspired chapter skeleton with a staged route, side detours, and shortcut links.",
            "openSkeleton" => "Layout: hub-and-spoke structure with a few loops. Best for exploratory multi-room worlds.",
            _ => "Layout: full adjacency grid. Dense, readable, and closest to the original rectangular cluster generator.",
        };
    }

    private static string ResolveArchetypeDescription(string? archetype)
    {
        return archetype switch
        {
            "longRunDensityBurst" => "Archetype: a cleaner opening and ending around a denser middle knot.",
            "spineCompactBranching" => "Archetype: one visible spine with compact side branches and short detours.",
            "landmarkCorridor" => "Archetype: sparse progression centered on one standout corridor or set-piece room.",
            "celesteCategory" => "Archetype: a chapter-shaped Celeste route with berry detours, a checkpoint anchor, and a late summit set-piece.",
            "segmentedSummit" => "Archetype: segmented ascent with stronger late-phase escalation and checkpoint breaks.",
            _ => "Archetype: a direct climb-focused chapter with a strong main route and a readable finish.",
        };
    }

    private static string FormatJsonForDisplay(string rawJson)
    {
        try
        {
            var node = JsonNode.Parse(rawJson);
            return node?.ToJsonString(new JsonSerializerOptions { WriteIndented = true }) ?? rawJson;
        }
        catch
        {
            return rawJson;
        }
    }

    private static async Task<GeneratorResponse> RunGeneratorAsync(string generatorPath, string[] arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = generatorPath,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        foreach (var argument in arguments)
        {
            startInfo.ArgumentList.Add(argument);
        }

        using var process = new Process { StartInfo = startInfo };
        process.Start();
        var stdoutTask = process.StandardOutput.ReadToEndAsync();
        var stderrTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(string.IsNullOrWhiteSpace(stderr) ? "The native generator exited with an error." : stderr.Trim());
        }

        using var json = JsonDocument.Parse(stdout);
        var root = json.RootElement;
        return new GeneratorResponse(
            stdout,
            root.GetProperty("summary").GetString() ?? string.Empty,
            root.GetProperty("seedLabel").GetString() ?? string.Empty);
    }

    private static string? FindNativeGeneratorExecutable()
    {
        var baseDirectory = AppContext.BaseDirectory;
        var current = new DirectoryInfo(baseDirectory);
        while (current is not null)
        {
            var sameDirectory = Path.Combine(current.FullName, ExecutableName);
            if (File.Exists(sameDirectory))
            {
                return sameDirectory;
            }

            var releasePath = Path.Combine(current.FullName, "cpp", "build", "Release", ExecutableName);
            if (File.Exists(releasePath))
            {
                return releasePath;
            }

            var debugPath = Path.Combine(current.FullName, "cpp", "build", "Debug", ExecutableName);
            if (File.Exists(debugPath))
            {
                return debugPath;
            }

            var rootBuildPath = Path.Combine(current.FullName, "cpp", "build", ExecutableName);
            if (File.Exists(rootBuildPath))
            {
                return rootBuildPath;
            }

            current = current.Parent;
        }

        return null;
    }

    private static ComboBox CreateComboBox(params string[] items)
    {
        var comboBox = new ComboBox
        {
            DropDownStyle = ComboBoxStyle.DropDownList,
            Width = 180,
            DrawMode = DrawMode.OwnerDrawFixed,
            BackColor = NightInput,
            ForeColor = NightText,
            FlatStyle = FlatStyle.Flat,
        };
        comboBox.DrawItem += DrawDarkComboBoxItem;
        comboBox.Items.AddRange(items);
        comboBox.SelectedIndex = 0;
        return comboBox;
    }

    private static void DrawDarkComboBoxItem(object? sender, DrawItemEventArgs error)
    {
        if (sender is not ComboBox comboBox)
        {
            return;
        }

        error.DrawBackground();
        if (error.Index < 0)
        {
            return;
        }

        var selected = (error.State & DrawItemState.Selected) == DrawItemState.Selected;
        using var backgroundBrush = new SolidBrush(selected ? NightActionSecondary : NightInput);
        using var textBrush = new SolidBrush(NightText);
        var itemText = comboBox.Items[error.Index]?.ToString() ?? string.Empty;
        var comboFont = comboBox.Font ?? Control.DefaultFont;
        error.Graphics.FillRectangle(backgroundBrush, error.Bounds);
        error.Graphics.DrawString(itemText, comboFont, textBrush, error.Bounds.Left + 6, error.Bounds.Top + 2);
        error.DrawFocusRectangle();
    }

    private static NumericUpDown CreateNumericInput(decimal minimum, decimal maximum, decimal value)
    {
        return new NumericUpDown
        {
            Minimum = minimum,
            Maximum = maximum,
            Value = value,
            Width = 120,
            BackColor = NightInput,
            ForeColor = NightText,
            BorderStyle = BorderStyle.FixedSingle,
        };
    }

    private static TextBox CreateTextBox(string value)
    {
        return new TextBox
        {
            Text = value,
            Width = 180,
            BackColor = NightInput,
            ForeColor = NightText,
            BorderStyle = BorderStyle.FixedSingle,
        };
    }

    private static Button CreateActionButton(string text, Color backgroundColor)
    {
        return new Button
        {
            AutoSize = true,
            Text = text,
            BackColor = backgroundColor,
            ForeColor = NightText,
            FlatStyle = FlatStyle.Flat,
            Padding = new Padding(10, 5, 10, 5),
            Margin = new Padding(0, 0, 8, 0),
        };
    }

    private static FlowLayoutPanel CreatePathPickerPanel(TextBox textBox, Button browseButton)
    {
        var panel = new FlowLayoutPanel
        {
            AutoSize = true,
            FlowDirection = FlowDirection.LeftToRight,
            Dock = DockStyle.Fill,
            WrapContents = false,
            BackColor = NightPanel,
        };
        textBox.Width = 520;
        panel.Controls.Add(textBox);
        panel.Controls.Add(browseButton);
        return panel;
    }

    private static GroupBox CreateGroupContainer(string title)
    {
        return new GroupBox
        {
            Dock = DockStyle.Fill,
            Text = title,
            Padding = new Padding(10),
            BackColor = NightPanel,
            ForeColor = NightText,
        };
    }

    private static void AddField(TableLayoutPanel panel, int index, string label, Control control)
    {
        var row = index / 2;
        var column = (index % 2) * 2;
        while (panel.RowStyles.Count <= row)
        {
            panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        }

        panel.Controls.Add(new Label
        {
            AutoSize = true,
            Text = label,
            Anchor = AnchorStyles.Left,
            Margin = new Padding(0, 6, 8, 6),
            ForeColor = NightMuted,
            BackColor = Color.Transparent,
        }, column, row);

        control.Anchor = AnchorStyles.Left | AnchorStyles.Right;
        control.Margin = new Padding(0, 3, 18, 3);
        panel.Controls.Add(control, column + 1, row);
    }

    private static void ApplyNightTheme(Control control)
    {
        switch (control)
        {
            case Form form:
                form.BackColor = NightBackground;
                form.ForeColor = NightText;
                break;
            case TableLayoutPanel table:
                table.BackColor = table.BackColor == Color.Empty ? NightBackground : table.BackColor;
                table.ForeColor = NightText;
                break;
            case FlowLayoutPanel flow:
                flow.ForeColor = NightText;
                break;
            case GroupBox groupBox:
                groupBox.ForeColor = NightText;
                if (groupBox.BackColor == Color.Empty)
                {
                    groupBox.BackColor = NightPanel;
                }
                break;
            case Panel panel:
                panel.ForeColor = NightText;
                break;
            case Label label:
                if (label.ForeColor == DefaultForeColor)
                {
                    label.ForeColor = NightText;
                }
                break;
            case TextBox textBox:
                textBox.BackColor = NightInput;
                textBox.ForeColor = NightText;
                break;
            case NumericUpDown numeric:
                numeric.BackColor = NightInput;
                numeric.ForeColor = NightText;
                break;
            case ComboBox comboBox:
                comboBox.BackColor = NightInput;
                comboBox.ForeColor = NightText;
                comboBox.FlatStyle = FlatStyle.Flat;
                break;
            case Button button:
                button.FlatAppearance.BorderColor = NightBorder;
                button.FlatAppearance.MouseDownBackColor = NightActionSecondary;
                button.FlatAppearance.MouseOverBackColor = NightAction;
                break;
        }

        foreach (Control child in control.Controls)
        {
            ApplyNightTheme(child);
        }
    }

    private void ToggleBusyState(bool busy)
    {
        _generateButton.Enabled = !busy;
        _exportButton.Enabled = !busy;
        _convertButton.Enabled = !busy;
        _browseButton.Enabled = !busy;
        _browseBinButton.Enabled = !busy;
        _resetViewButton.Enabled = !busy;
        UseWaitCursor = busy;
    }

    private void LoadLauncherSettings()
    {
        try
        {
            if (!File.Exists(SettingsFilePath))
            {
                return;
            }

            var json = File.ReadAllText(SettingsFilePath);
            var settings = JsonSerializer.Deserialize<LauncherSettings>(json);
            if (settings is null)
            {
                return;
            }

            ApplyComboBoxSelection(_modeComboBox, settings.Mode);
            ApplyTextValue(_seedTextBox, settings.Seed);
            _autoRandomizeSeedCheckBox.Checked = settings.AutoRandomizeSeed;
            ApplyComboBoxSelection(_kitComboBox, settings.Kit);
            ApplyComboBoxSelection(_layoutComboBox, settings.Layout);
            ApplyComboBoxSelection(_archetypeComboBox, settings.Archetype);
            ApplyComboBoxSelection(_previewModeComboBox, settings.PreviewMode);
            ApplyComboBoxSelection(_overlayModeComboBox, settings.OverlayMode);
            ApplyNumericValue(_clusterWidthInput, settings.ClusterWidth);
            ApplyNumericValue(_clusterHeightInput, settings.ClusterHeight);
            ApplyNumericValue(_roomWidthInput, settings.RoomWidth);
            ApplyNumericValue(_roomHeightInput, settings.RoomHeight);
            ApplyNumericValue(_roomGapInput, settings.RoomGap);
            ApplyTextValue(_packageNameTextBox, settings.PackageName);
            ApplyTextValue(_outputPathTextBox, settings.OutputPath);
            _exportBinCheckBox.Checked = settings.ExportBin;
            _strictVanillaBinCheckBox.Checked = settings.StrictVanillaBin ?? true;
            ApplyTextValue(_binOutputPathTextBox, settings.BinOutputPath);
        }
        catch
        {
            // Ignore unreadable or invalid settings and keep launcher defaults.
        }
    }

    private void SaveLauncherSettings()
    {
        try
        {
            Directory.CreateDirectory(SettingsDirectory);
            var settings = new LauncherSettings(
                _modeComboBox.Text,
                _seedTextBox.Text,
                _autoRandomizeSeedCheckBox.Checked,
                _kitComboBox.Text,
                _layoutComboBox.Text,
                _archetypeComboBox.Text,
                _previewModeComboBox.Text,
                _overlayModeComboBox.Text,
                Decimal.ToInt32(_clusterWidthInput.Value),
                Decimal.ToInt32(_clusterHeightInput.Value),
                Decimal.ToInt32(_roomWidthInput.Value),
                Decimal.ToInt32(_roomHeightInput.Value),
                Decimal.ToInt32(_roomGapInput.Value),
                _packageNameTextBox.Text,
                _outputPathTextBox.Text,
                _exportBinCheckBox.Checked,
                _binOutputPathTextBox.Text,
                _strictVanillaBinCheckBox.Checked);
            var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(SettingsFilePath, json);
        }
        catch
        {
            // Ignore persistence failures so launcher usage is not blocked.
        }
    }

    private static void ApplyComboBoxSelection(ComboBox comboBox, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }

        var index = comboBox.FindStringExact(value);
        if (index >= 0)
        {
            comboBox.SelectedIndex = index;
        }
    }

    private static void ApplyNumericValue(NumericUpDown input, int value)
    {
        var clamped = Math.Min(input.Maximum, Math.Max(input.Minimum, value));
        input.Value = clamped;
    }

    private static void ApplyTextValue(TextBox textBox, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
        {
            textBox.Text = value;
        }
    }

    private static string DefaultJsonOutputPath()
    {
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "CelestePcg");
        return Path.Combine(directory, "room-cluster.json");
    }

    private static string DefaultBinOutputPath()
    {
        var directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "CelestePcg");
        return Path.Combine(directory, "room-cluster.bin");
    }

    private static uint GenerateRandomPseudoSeed()
    {
        Span<byte> bytes = stackalloc byte[4];
        RandomNumberGenerator.Fill(bytes);
        return BitConverter.ToUInt32(bytes);
    }

    private sealed record LauncherSettings(
        string Mode,
        string Seed,
        bool AutoRandomizeSeed,
        string Kit,
        string Layout,
        string Archetype,
        string PreviewMode,
        string OverlayMode,
        int ClusterWidth,
        int ClusterHeight,
        int RoomWidth,
        int RoomHeight,
        int RoomGap,
        string PackageName,
        string OutputPath,
        bool ExportBin,
        string BinOutputPath,
        bool? StrictVanillaBin);

    private sealed record GeneratorResponse(string RawJson, string Summary, string SeedLabel);
}