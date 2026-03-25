/**
 * Celeste Map Editor - Custom Editor Provider
 * 
 * Integrates the map editor WebView with VS Code's Custom Editor API.
 * Handles document lifecycle, save/load, and message passing.
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { parseMapBinary, createEmptyMap } from './mapParser';
import { serializeMapBinary, serializeMapJson } from './mapSerializer';
import { CelesteMap, EditorSettings, GeneratorMode } from './types';
import { getAvailableChapterArchetypes, getAvailableHouseKits, HouseKitId, RandomizerMode, RoomLayoutMode } from './proceduralGeneration';
import { generateRoomClusterWithNativeFallback } from './nativeGenerator';
import { getAvailableTemplatePalettes } from './templateRegistry';

export class CelesteMapEditorProvider implements vscode.CustomEditorProvider<CelesteMapDocument> {
    public static readonly viewType = 'celesteMapEditor.mapView';

    private static readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<CelesteMapDocument>>();
    public readonly onDidChangeCustomDocument = CelesteMapEditorProvider._onDidChangeCustomDocument.event;
    private activeSession?: { document: CelesteMapDocument; panel: vscode.WebviewPanel };

    constructor(private readonly context: vscode.ExtensionContext) {}

    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new CelesteMapEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(
            CelesteMapEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        );
    }

    // ─── Document Lifecycle ────────────────────────────────────────────

    async openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): Promise<CelesteMapDocument> {
        const document = new CelesteMapDocument(uri);
        await document.load();
        return document;
    }

    async saveCustomDocument(
        document: CelesteMapDocument,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        const data = serializeMapBinary(document.mapData);
        await vscode.workspace.fs.writeFile(document.uri, new Uint8Array(data));
    }

    async saveCustomDocumentAs(
        document: CelesteMapDocument,
        destination: vscode.Uri,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        const data = serializeMapBinary(document.mapData);
        await vscode.workspace.fs.writeFile(destination, new Uint8Array(data));
    }

    async revertCustomDocument(
        document: CelesteMapDocument,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        await document.load();
    }

    async backupCustomDocument(
        document: CelesteMapDocument,
        context: vscode.CustomDocumentBackupContext,
        cancellation: vscode.CancellationToken
    ): Promise<vscode.CustomDocumentBackup> {
        const backupData = serializeMapBinary(document.mapData);
        await vscode.workspace.fs.writeFile(context.destination, new Uint8Array(backupData));
        return {
            id: context.destination.toString(),
            delete: async () => {
                try {
                    await vscode.workspace.fs.delete(context.destination);
                } catch {
                    // ignore
                }
            },
        };
    }

    // ─── WebView ───────────────────────────────────────────────────────

    async resolveCustomEditor(
        document: CelesteMapDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.activeSession = { document, panel: webviewPanel };
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.context.extensionUri, 'media'),
                vscode.Uri.joinPath(this.context.extensionUri, 'dist'),
            ],
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Listen for messages from the webview
        webviewPanel.webview.onDidReceiveMessage(
            (message) => void this.handleWebviewMessage(document, webviewPanel, message),
            undefined,
            []
        );

        webviewPanel.onDidChangeViewState((event) => {
            if (event.webviewPanel.active) {
                this.activeSession = { document, panel: webviewPanel };
            }
        });

        webviewPanel.onDidDispose(() => {
            if (this.activeSession?.panel === webviewPanel) {
                this.activeSession = undefined;
            }
        });

        // When the webview is ready, send the map data
        // (the webview will post a 'ready' message when initialized)
    }

    public async generateRoomClusterForActiveEditor(): Promise<void> {
        if (!this.activeSession) {
            vscode.window.showWarningMessage('Open a Celeste map in the custom editor before generating a room cluster.');
            return;
        }

        await this.runProceduralGenerator(this.activeSession.document, this.activeSession.panel);
    }

    private async handleWebviewMessage(
        document: CelesteMapDocument,
        panel: vscode.WebviewPanel,
        message: any
    ): Promise<void> {
        switch (message.type) {
            case 'ready':
                // Send the loaded map data and settings
                panel.webview.postMessage({
                    type: 'loadMap',
                    data: document.mapData,
                });
                panel.webview.postMessage({
                    type: 'updateSettings',
                    settings: this.getEditorSettings(),
                });
                break;

            case 'mapModified':
                document.mapData = message.data;
                CelesteMapEditorProvider._onDidChangeCustomDocument.fire({
                    document,
                });
                break;

            case 'requestSave':
                vscode.commands.executeCommand('workbench.action.files.save');
                break;

            case 'addRoom':
                // Handled in webview; update document
                document.mapData = message.data;
                CelesteMapEditorProvider._onDidChangeCustomDocument.fire({
                    document,
                });
                break;

            case 'openProceduralGenerator':
                await this.runProceduralGenerator(document, panel);
                break;

            case 'log':
                console.log(`[Celeste Map Editor] ${message.message}`);
                break;
        }
    }

    private async runProceduralGenerator(
        document: CelesteMapDocument,
        panel: vscode.WebviewPanel
    ): Promise<void> {
        const replaceChoice = await vscode.window.showWarningMessage(
            'Replace the current rooms with a generated room cluster?',
            { modal: true },
            'Replace Rooms'
        );

        if (replaceChoice !== 'Replace Rooms') {
            return;
        }

        const randomizerPick = await vscode.window.showQuickPick(
            [
                {
                    label: 'Pseudo Randomizer',
                    description: 'Deterministic seeded PCG',
                    mode: 'pseudo' as RandomizerMode,
                },
                {
                    label: 'True Randomizer',
                    description: 'Non-deterministic cryptographic randomness',
                    mode: 'true' as RandomizerMode,
                },
            ],
            {
                placeHolder: 'Choose the randomization mode',
            }
        );

        if (!randomizerPick) {
            return;
        }

        const houseKitPick = await vscode.window.showQuickPick(
            getAvailableHouseKits().map((kit) => ({
                label: kit.label,
                description: kit.description,
                id: kit.id,
            })),
            {
                placeHolder: 'Choose a room kit preset',
            }
        );

        if (!houseKitPick) {
            return;
        }

        const layoutPick = await vscode.window.showQuickPick(
            [
                {
                    label: 'Grid',
                    description: 'Classic full-grid cluster with every adjacent room connected',
                    mode: 'grid' as RoomLayoutMode,
                },
                {
                    label: 'Critical Path',
                    description: 'One start-to-goal route across the full room set',
                    mode: 'criticalPath' as RoomLayoutMode,
                },
                {
                    label: 'Critical Path + Branches',
                    description: 'Main route with optional side rooms for rewards and detours',
                    mode: 'criticalPathBranches' as RoomLayoutMode,
                },
                {
                    label: 'Open Skeleton',
                    description: 'Tree-like overworld structure with hubs and a few loops',
                    mode: 'openSkeleton' as RoomLayoutMode,
                },
            ],
            {
                placeHolder: 'Choose the room layout mode',
            }
        );

        if (!layoutPick) {
            return;
        }

        const archetypePick = await vscode.window.showQuickPick(
            getAvailableChapterArchetypes().map((archetype) => ({
                label: archetype.label,
                description: `${archetype.description} Recommended layout: ${archetype.recommendedLayout}`,
                id: archetype.id,
            })),
            {
                placeHolder: 'Choose the chapter archetype',
            }
        );

        if (!archetypePick) {
            return;
        }

        let generatorMode: GeneratorMode = 'procedural';
        let templatePaletteId: string | undefined;

        if (archetypePick.id === 'celesteCategory') {
            const generatorModePick = await vscode.window.showQuickPick(
                [
                    {
                        label: 'Procedural',
                        description: 'Use the existing generator path with archetype and topology heuristics.',
                        mode: 'procedural' as GeneratorMode,
                    },
                    {
                        label: 'Hybrid Template-Backed',
                        description: 'Use curated Celeste Category room families on top of the generated chapter skeleton.',
                        mode: 'hybrid' as GeneratorMode,
                    },
                ],
                {
                    placeHolder: 'Choose the generator mode for this chapter',
                }
            );

            if (!generatorModePick) {
                return;
            }

            generatorMode = generatorModePick.mode;

            if (generatorMode === 'hybrid') {
                const templatePalettePick = await vscode.window.showQuickPick(
                    getAvailableTemplatePalettes(archetypePick.id).map((palette) => ({
                        label: palette.label,
                        description: palette.description,
                        id: palette.id,
                    })),
                    {
                        placeHolder: 'Choose the hybrid template palette',
                    }
                );

                if (!templatePalettePick) {
                    return;
                }

                templatePaletteId = templatePalettePick.id;
            }
        }

        const clusterSizePick = await vscode.window.showQuickPick(
            [
                { label: '2 x 2', description: '4 rooms', width: 2, height: 2 },
                { label: '3 x 2', description: '6 rooms', width: 3, height: 2 },
                { label: '3 x 3', description: '9 rooms', width: 3, height: 3 },
            ],
            {
                placeHolder: 'Choose the room cluster size',
            }
        );

        if (!clusterSizePick) {
            return;
        }

        const roomSizePick = await vscode.window.showQuickPick(
            [
                { label: '320 x 184', description: 'Classic Celeste room', width: 320, height: 184 },
                { label: '320 x 240', description: 'Taller vertical room', width: 320, height: 240 },
                { label: '480 x 184', description: 'Wider traversal room', width: 480, height: 184 },
            ],
            {
                placeHolder: 'Choose the per-room size',
            }
        );

        if (!roomSizePick) {
            return;
        }

        let seed: number | undefined;
        if (randomizerPick.mode === 'pseudo') {
            const seedInput = await vscode.window.showInputBox({
                prompt: 'Enter a numeric seed for deterministic generation',
                value: String(Date.now() >>> 0),
                validateInput: (value) => {
                    if (value.trim().length === 0) {
                        return 'Enter a numeric seed.';
                    }

                    return Number.isFinite(Number(value)) ? undefined : 'Seed must be a valid number.';
                },
            });

            if (!seedInput) {
                return;
            }

            seed = Number(seedInput);
        }

        const result = await generateRoomClusterWithNativeFallback(this.context.extensionUri.fsPath, document.mapData, {
            randomizerMode: randomizerPick.mode,
            seed,
            generatorMode,
            layoutMode: layoutPick.mode,
            archetype: archetypePick.id,
            templatePaletteId,
            clusterWidth: clusterSizePick.width,
            clusterHeight: clusterSizePick.height,
            roomWidth: roomSizePick.width,
            roomHeight: roomSizePick.height,
            kitId: houseKitPick.id as HouseKitId,
        });

        document.mapData = result.map;
        CelesteMapEditorProvider._onDidChangeCustomDocument.fire({
            document,
        });

        panel.webview.postMessage({
            type: 'loadMap',
            data: document.mapData,
        });

        vscode.window.showInformationMessage(result.summary);
    }

    private getEditorSettings(): EditorSettings {
        const config = vscode.workspace.getConfiguration('celesteMapEditor');
        return {
            gridSize: config.get('gridSize', 8),
            showGrid: config.get('showGrid', true),
            celestePath: config.get('celestePath', ''),
            defaultRoomWidth: config.get('defaultRoomWidth', 320),
            defaultRoomHeight: config.get('defaultRoomHeight', 184),
        };
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = getNonce();

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
    <title>Celeste Map Editor</title>
    <style>
        /* ─── Reset & Layout ─────────────────────────────────────────── */

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            overflow: hidden;
            background: #1e1e1e;
            color: #d4d4d4;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 13px;
            display: flex;
            flex-direction: column;
            height: 100vh;
            user-select: none;
        }

        /* ─── Toolbar ────────────────────────────────────────────────── */

        #toolbar {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            background: #252526;
            border-bottom: 1px solid #3c3c3c;
            flex-shrink: 0;
        }

        #toolbar button {
            background: #3c3c3c;
            color: #d4d4d4;
            border: 1px solid #555;
            padding: 4px 10px;
            cursor: pointer;
            border-radius: 3px;
            font-size: 12px;
        }

        #toolbar button:hover {
            background: #505050;
        }

        #toolbar button.active {
            background: #0e639c;
            border-color: #1177bb;
            color: #fff;
        }

        #toolbar .separator {
            width: 1px;
            height: 20px;
            background: #555;
            margin: 0 4px;
        }

        #toolbar .info {
            margin-left: auto;
            color: #888;
            font-size: 11px;
        }

        /* ─── Main Area ──────────────────────────────────────────────── */

        #main {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        /* ─── Side Panel ─────────────────────────────────────────────── */

        #side-panel {
            width: 220px;
            background: #252526;
            border-right: 1px solid #3c3c3c;
            display: flex;
            flex-direction: column;
            overflow-y: auto;
            flex-shrink: 0;
        }

        .panel-section {
            border-bottom: 1px solid #3c3c3c;
        }

        .panel-header {
            padding: 6px 10px;
            background: #2d2d2d;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #aaa;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .panel-header:hover {
            background: #333;
        }

        .panel-body {
            padding: 6px;
        }

        /* ─── Tile Palette ───────────────────────────────────────────── */

        #tile-palette {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 3px;
            padding: 6px;
        }

        .tile-entry {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 4px 2px;
            border: 1px solid transparent;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
        }

        .tile-entry:hover {
            border-color: #555;
            background: #333;
        }

        .tile-entry.selected {
            border-color: #0e639c;
            background: #0e639c33;
        }

        .tile-swatch {
            width: 24px;
            height: 24px;
            border: 1px solid #555;
            border-radius: 2px;
            margin-bottom: 2px;
        }

        .tile-label {
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }

        /* ─── Layers Panel ───────────────────────────────────────────── */

        .layer-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 3px;
        }

        .layer-item:hover {
            background: #333;
        }

        .layer-item.active {
            background: #0e639c33;
            border-left: 2px solid #0e639c;
        }

        .layer-item .visibility {
            cursor: pointer;
            opacity: 0.7;
            font-size: 14px;
        }

        .layer-item .visibility:hover {
            opacity: 1;
        }

        .layer-item .layer-name {
            flex: 1;
        }

        /* ─── Rooms Panel ────────────────────────────────────────────── */

        .room-item {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 8px;
            cursor: pointer;
            border-radius: 3px;
        }

        .room-item:hover {
            background: #333;
        }

        .room-item.active {
            background: #0e639c33;
            border-left: 2px solid #0e639c;
        }

        #add-room-btn {
            width: 100%;
            margin-top: 4px;
            padding: 4px 8px;
            background: #3c3c3c;
            color: #d4d4d4;
            border: 1px solid #555;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }

        #add-room-btn:hover {
            background: #0e639c;
        }

        /* ─── Canvas Container ───────────────────────────────────────── */

        #canvas-container {
            flex: 1;
            position: relative;
            overflow: hidden;
        }

        #map-canvas {
            position: absolute;
            top: 0;
            left: 0;
            image-rendering: pixelated;
        }

        /* ─── Status Bar ─────────────────────────────────────────────── */

        #status-bar {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 2px 8px;
            background: #007acc;
            color: #fff;
            font-size: 11px;
            flex-shrink: 0;
        }

        #status-bar .status-item {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        /* ─── Room Properties Dialog ─────────────────────────────────── */

        .dialog-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 100;
            justify-content: center;
            align-items: center;
        }

        .dialog-overlay.visible {
            display: flex;
        }

        .dialog {
            background: #252526;
            border: 1px solid #555;
            border-radius: 6px;
            padding: 20px;
            min-width: 320px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }

        .dialog h3 {
            margin-bottom: 12px;
            color: #e0e0e0;
        }

        .dialog label {
            display: block;
            margin-bottom: 4px;
            color: #aaa;
            font-size: 12px;
        }

        .dialog input, .dialog select {
            width: 100%;
            padding: 4px 8px;
            margin-bottom: 10px;
            background: #3c3c3c;
            border: 1px solid #555;
            border-radius: 3px;
            color: #d4d4d4;
            font-size: 13px;
        }

        .dialog-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
        }

        .dialog-buttons button {
            padding: 6px 16px;
            border: 1px solid #555;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            background: #3c3c3c;
            color: #d4d4d4;
        }

        .dialog-buttons button.primary {
            background: #0e639c;
            border-color: #1177bb;
            color: #fff;
        }
    </style>
</head>
<body>
    <!-- Toolbar -->
    <div id="toolbar">
        <button id="tool-select" class="tool-btn active" data-tool="select" title="Select (V)">&#9654; Select</button>
        <button id="tool-pencil" class="tool-btn" data-tool="pencil" title="Pencil (B)">&#9998; Pencil</button>
        <button id="tool-rect" class="tool-btn" data-tool="rectangle" title="Rectangle (R)">&#9634; Rect</button>
        <button id="tool-fill" class="tool-btn" data-tool="fill" title="Fill (G)">&#9673; Fill</button>
        <button id="tool-eraser" class="tool-btn" data-tool="eraser" title="Eraser (E)">&#9447; Eraser</button>
        <div class="separator"></div>
        <button id="btn-zoom-in" title="Zoom In">+</button>
        <button id="btn-zoom-out" title="Zoom Out">-</button>
        <button id="btn-zoom-fit" title="Fit to View">Fit</button>
        <div class="separator"></div>
        <button id="btn-toggle-grid" title="Toggle Grid">Grid</button>
        <button id="btn-toggle-validation" title="Toggle Validation Overlay">Overlay</button>
        <button id="btn-toggle-topology" title="Toggle Topology Overview">Topology</button>
        <button id="btn-generate-cluster" title="Generate a procedural room cluster">Generate</button>
        <div class="info" id="toolbar-info">Ready</div>
    </div>

    <!-- Main Area -->
    <div id="main">
        <!-- Side Panel -->
        <div id="side-panel">
            <!-- Rooms -->
            <div class="panel-section">
                <div class="panel-header">
                    <span>Rooms</span>
                    <span id="room-count">0</span>
                </div>
                <div class="panel-body" id="rooms-list"></div>
                <div class="panel-body">
                    <button id="add-room-btn">+ Add Room</button>
                </div>
            </div>

            <!-- Layers -->
            <div class="panel-section">
                <div class="panel-header">
                    <span>Layers</span>
                </div>
                <div class="panel-body" id="layers-list"></div>
            </div>

            <!-- Tile Palette -->
            <div class="panel-section">
                <div class="panel-header">
                    <span>Tiles</span>
                </div>
                <div id="tile-palette"></div>
            </div>
        </div>

        <!-- Canvas -->
        <div id="canvas-container">
            <canvas id="map-canvas"></canvas>
        </div>
    </div>

    <!-- Status Bar -->
    <div id="status-bar">
        <span class="status-item" id="status-pos">Pos: 0, 0</span>
        <span class="status-item" id="status-tile">Tile: 0, 0</span>
        <span class="status-item" id="status-zoom">Zoom: 100%</span>
        <span class="status-item" id="status-room">Room: -</span>
        <span class="status-item" id="status-layer">Layer: FG Tiles</span>
    </div>

    <!-- Add Room Dialog -->
    <div class="dialog-overlay" id="add-room-dialog">
        <div class="dialog">
            <h3>Add New Room</h3>
            <label for="room-name">Room Name</label>
            <input type="text" id="room-name" value="lvl_new" />
            <label for="room-width">Width (pixels, multiple of 8)</label>
            <input type="number" id="room-width" value="320" step="8" min="8" />
            <label for="room-height">Height (pixels, multiple of 8)</label>
            <input type="number" id="room-height" value="184" step="8" min="8" />
            <div class="dialog-buttons">
                <button id="dialog-cancel">Cancel</button>
                <button id="dialog-ok" class="primary">Add</button>
            </div>
        </div>
    </div>

    <!-- Editor Script -->
    <script nonce="${nonce}">
    (function() {
        // ─── VS Code API ───────────────────────────────────────────────
        const vscode = acquireVsCodeApi();

        // ─── State ─────────────────────────────────────────────────────
        let mapData = null;
        let settings = { gridSize: 8, showGrid: true };
        let currentRoomIndex = 0;
        let currentTool = 'select';
        let currentTileChar = '1';
        let activeLayer = 'tilesFg';
        let showValidationOverlay = true;
        let showTopologyOverview = true;
        let topologyHitRegions = [];

        const layerDefs = [
            { id: 'tilesFg',  label: 'FG Tiles',   visible: true },
            { id: 'tilesBg',  label: 'BG Tiles',   visible: true },
            { id: 'entities', label: 'Entities',    visible: true },
            { id: 'triggers', label: 'Triggers',    visible: true },
            { id: 'decalsFg', label: 'FG Decals',   visible: true },
            { id: 'decalsBg', label: 'BG Decals',   visible: true },
        ];

        // Default tile palette
        const tilePalette = [
            { char: '0', label: 'Air',        color: 'transparent' },
            { char: '1', label: 'Dirt',        color: '#8B4513' },
            { char: '3', label: 'Snow',        color: '#E8E8E8' },
            { char: '4', label: 'Girder',      color: '#808080' },
            { char: '5', label: 'Tower',       color: '#696969' },
            { char: '6', label: 'Stone',       color: '#A0A0A0' },
            { char: '7', label: 'Cement',      color: '#B0B0B0' },
            { char: '8', label: 'Rock',        color: '#606060' },
            { char: '9', label: 'Wood',        color: '#DEB887' },
            { char: 'a', label: 'Wood Stone',  color: '#C8B07A' },
            { char: 'b', label: 'Cliffside',   color: '#707060' },
            { char: 'c', label: 'Pool Edges',  color: '#4080C0' },
            { char: 'd', label: 'Temple A',    color: '#A09060' },
            { char: 'e', label: 'Temple B',    color: '#908050' },
            { char: 'f', label: 'Cliffside 2', color: '#606050' },
            { char: 'g', label: 'Reflection',  color: '#5060A0' },
            { char: 'h', label: 'Summit',      color: '#9090A0' },
            { char: 'i', label: 'Core Ice',    color: '#A0C0E0' },
            { char: 'j', label: 'Core Fire',   color: '#E06030' },
            { char: 'k', label: 'Farewell',    color: '#6070A0' },
        ];

        // ─── Canvas & Viewport ─────────────────────────────────────────
        const canvas = document.getElementById('map-canvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('canvas-container');

        let viewport = { offsetX: 0, offsetY: 0, zoom: 2 };
        let isDragging = false;
        let isPainting = false;
        let lastMouseX = 0, lastMouseY = 0;
        let canvasWidth = 0, canvasHeight = 0;

        // ─── Entity Colors ─────────────────────────────────────────────
        const entityColors = {
            'player':           '#00ff00',
            'spinner':          '#ff4444',
            'spring':           '#44ff44',
            'refill':           '#ff44ff',
            'strawberry':       '#ff0000',
            'goldenBerry':      '#ffcc00',
            'jumpThru':         '#886644',
            'crumbleBlock':     '#887766',
            'dashBlock':        '#4488ff',
            'fallingBlock':     '#cc8844',
            'moveBlock':        '#6666cc',
            'zipMover':         '#cc66cc',
            'touchSwitch':      '#44cccc',
            'switchGate':       '#cccc44',
            'spikesUp':         '#ff2222',
            'spikesDown':       '#ff2222',
            'spikesLeft':       '#ff2222',
            'spikesRight':      '#ff2222',
        };

        function getEntityColor(name) {
            const lower = name.toLowerCase();
            for (const [key, color] of Object.entries(entityColors)) {
                if (lower.includes(key.toLowerCase())) return color;
            }
            return '#cccccc';
        }

        // ─── Initialize UI ─────────────────────────────────────────────

        function initUI() {
            buildTilePalette();
            buildLayersList();
            setupToolbar();
            setupCanvas();
            setupKeyboard();
            setupDialog();
        }

        function buildTilePalette() {
            const paletteEl = document.getElementById('tile-palette');
            paletteEl.innerHTML = '';
            for (const entry of tilePalette) {
                const div = document.createElement('div');
                div.className = 'tile-entry' + (entry.char === currentTileChar ? ' selected' : '');
                div.dataset.char = entry.char;
                div.innerHTML =
                    '<div class="tile-swatch" style="background:' +
                    (entry.color === 'transparent' ? '#1e1e1e; border-style: dashed' : entry.color) +
                    '"></div>' +
                    '<span class="tile-label">' + entry.label + '</span>';
                div.addEventListener('click', () => {
                    currentTileChar = entry.char;
                    document.querySelectorAll('.tile-entry').forEach(e => e.classList.remove('selected'));
                    div.classList.add('selected');
                });
                paletteEl.appendChild(div);
            }
        }

        function buildLayersList() {
            const layersEl = document.getElementById('layers-list');
            layersEl.innerHTML = '';
            for (const layer of layerDefs) {
                const div = document.createElement('div');
                div.className = 'layer-item' + (layer.id === activeLayer ? ' active' : '');
                div.innerHTML =
                    '<span class="visibility">' + (layer.visible ? '👁' : '🚫') + '</span>' +
                    '<span class="layer-name">' + layer.label + '</span>';

                div.querySelector('.visibility').addEventListener('click', (e) => {
                    e.stopPropagation();
                    layer.visible = !layer.visible;
                    div.querySelector('.visibility').textContent = layer.visible ? '👁' : '🚫';
                    render();
                });

                div.addEventListener('click', () => {
                    activeLayer = layer.id;
                    document.querySelectorAll('.layer-item').forEach(e => e.classList.remove('active'));
                    div.classList.add('active');
                    document.getElementById('status-layer').textContent = 'Layer: ' + layer.label;
                });

                layersEl.appendChild(div);
            }
        }

        function buildRoomsList() {
            const roomsEl = document.getElementById('rooms-list');
            roomsEl.innerHTML = '';
            if (!mapData) return;

            document.getElementById('room-count').textContent = mapData.rooms.length;

            for (let i = 0; i < mapData.rooms.length; i++) {
                const room = mapData.rooms[i];
                const validation = getRoomValidation(room.name);
                const div = document.createElement('div');
                div.className = 'room-item' + (i === currentRoomIndex ? ' active' : '');
                div.textContent = validation ? room.name + ' [' + validationLabel(validation.status) + ']' : room.name;
                div.addEventListener('click', () => {
                    currentRoomIndex = i;
                    document.querySelectorAll('.room-item').forEach(e => e.classList.remove('active'));
                    div.classList.add('active');
                    document.getElementById('status-room').textContent = buildRoomStatus(room.name);
                    fitToView();
                    render();
                });
                roomsEl.appendChild(div);
            }
        }

        function setupToolbar() {
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    currentTool = btn.dataset.tool;
                    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });

            document.getElementById('btn-zoom-in').addEventListener('click', () => {
                viewport.zoom = Math.min(viewport.zoom * 1.5, 16);
                updateZoomStatus();
                render();
            });

            document.getElementById('btn-zoom-out').addEventListener('click', () => {
                viewport.zoom = Math.max(viewport.zoom / 1.5, 0.25);
                updateZoomStatus();
                render();
            });

            document.getElementById('btn-zoom-fit').addEventListener('click', fitToView);

            document.getElementById('btn-toggle-grid').addEventListener('click', () => {
                settings.showGrid = !settings.showGrid;
                render();
            });

            document.getElementById('btn-toggle-validation').addEventListener('click', () => {
                showValidationOverlay = !showValidationOverlay;
                document.getElementById('btn-toggle-validation').classList.toggle('active', showValidationOverlay);
                render();
            });

            document.getElementById('btn-toggle-validation').classList.add('active');

            document.getElementById('btn-toggle-topology').addEventListener('click', () => {
                showTopologyOverview = !showTopologyOverview;
                document.getElementById('btn-toggle-topology').classList.toggle('active', showTopologyOverview);
                render();
            });

            document.getElementById('btn-toggle-topology').classList.add('active');

            document.getElementById('btn-generate-cluster').addEventListener('click', () => {
                vscode.postMessage({ type: 'openProceduralGenerator' });
            });
        }

        function setupDialog() {
            document.getElementById('add-room-btn').addEventListener('click', () => {
                document.getElementById('add-room-dialog').classList.add('visible');
            });

            document.getElementById('dialog-cancel').addEventListener('click', () => {
                document.getElementById('add-room-dialog').classList.remove('visible');
            });

            document.getElementById('dialog-ok').addEventListener('click', () => {
                const name = document.getElementById('room-name').value || 'lvl_new';
                const w = parseInt(document.getElementById('room-width').value) || 320;
                const h = parseInt(document.getElementById('room-height').value) || 184;
                addRoom(name, w, h);
                document.getElementById('add-room-dialog').classList.remove('visible');
            });
        }

        // ─── Canvas Setup ──────────────────────────────────────────────

        function setupCanvas() {
            resizeCanvas();
            window.addEventListener('resize', () => {
                resizeCanvas();
                render();
            });

            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('mouseleave', onMouseUp);
            canvas.addEventListener('wheel', onWheel, { passive: false });
            canvas.addEventListener('contextmenu', e => e.preventDefault());
        }

        function resizeCanvas() {
            canvasWidth = container.clientWidth;
            canvasHeight = container.clientHeight;
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            canvas.style.width = canvasWidth + 'px';
            canvas.style.height = canvasHeight + 'px';
        }

        function setupKeyboard() {
            document.addEventListener('keydown', (e) => {
                switch (e.key.toLowerCase()) {
                    case 'v': setTool('select'); break;
                    case 'b': setTool('pencil'); break;
                    case 'r': setTool('rectangle'); break;
                    case 'g': setTool('fill'); break;
                    case 'e': setTool('eraser'); break;
                    case 's':
                        if (e.ctrlKey) {
                            e.preventDefault();
                            vscode.postMessage({ type: 'requestSave' });
                        }
                        break;
                }
            });
        }

        function setTool(tool) {
            currentTool = tool;
            document.querySelectorAll('.tool-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.tool === tool);
            });
        }

        // ─── Mouse Handlers ────────────────────────────────────────────

        function screenToWorld(sx, sy) {
            return {
                x: (sx - viewport.offsetX) / viewport.zoom,
                y: (sy - viewport.offsetY) / viewport.zoom,
            };
        }

        function worldToTile(wx, wy) {
            const room = getCurrentRoom();
            if (!room) return { tx: 0, ty: 0 };
            return {
                tx: Math.floor(wx / settings.gridSize),
                ty: Math.floor(wy / settings.gridSize),
            };
        }

        function onMouseDown(e) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            if (e.button === 0) {
                const topologyNode = hitTestTopologyOverview(mx, my);
                if (topologyNode) {
                    focusRoomByName(topologyNode.roomName);
                    return;
                }
            }

            if (e.button === 1 || (e.button === 0 && e.altKey)) {
                // Middle click or Alt+left: pan
                isDragging = true;
                lastMouseX = mx;
                lastMouseY = my;
                canvas.style.cursor = 'grabbing';
                return;
            }

            if (e.button === 0) {
                const world = screenToWorld(mx, my);
                const tile = worldToTile(world.x, world.y);

                if (currentTool === 'pencil' || currentTool === 'eraser') {
                    isPainting = true;
                    paintTile(tile.tx, tile.ty);
                } else if (currentTool === 'fill') {
                    floodFill(tile.tx, tile.ty);
                }
            }
        }

        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const world = screenToWorld(mx, my);
            const tile = worldToTile(world.x, world.y);

            // Update status bar
            document.getElementById('status-pos').textContent = 
                'Pos: ' + Math.round(world.x) + ', ' + Math.round(world.y);
            document.getElementById('status-tile').textContent = 
                'Tile: ' + tile.tx + ', ' + tile.ty;

            if (isDragging) {
                viewport.offsetX += mx - lastMouseX;
                viewport.offsetY += my - lastMouseY;
                lastMouseX = mx;
                lastMouseY = my;
                render();
                return;
            }

            if (isPainting) {
                paintTile(tile.tx, tile.ty);
            }
        }

        function onMouseUp(e) {
            if (isDragging) {
                isDragging = false;
                canvas.style.cursor = 'default';
            }
            if (isPainting) {
                isPainting = false;
                notifyMapModified();
            }
        }

        function onWheel(e) {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const newZoom = Math.max(0.25, Math.min(16, viewport.zoom * zoomFactor));

            // Zoom toward cursor
            viewport.offsetX = mx - (mx - viewport.offsetX) * (newZoom / viewport.zoom);
            viewport.offsetY = my - (my - viewport.offsetY) * (newZoom / viewport.zoom);
            viewport.zoom = newZoom;

            updateZoomStatus();
            render();
        }

        function updateZoomStatus() {
            document.getElementById('status-zoom').textContent = 
                'Zoom: ' + Math.round(viewport.zoom * 100) + '%';
        }

        // ─── Tile Operations ───────────────────────────────────────────

        function getCurrentRoom() {
            if (!mapData || currentRoomIndex >= mapData.rooms.length) return null;
            return mapData.rooms[currentRoomIndex];
        }

        function getCurrentTopologyNode() {
            const room = getCurrentRoom();
            if (!room || !mapData || !mapData.previewMetadata || !mapData.previewMetadata.nodes) return null;
            return mapData.previewMetadata.nodes.find(node => node.roomName === room.name) || null;
        }

        function getRoomValidation(roomName) {
            if (!mapData || !mapData.previewMetadata || !mapData.previewMetadata.nodes) return null;
            const node = mapData.previewMetadata.nodes.find(node => node.roomName === roomName);
            return node ? node.validation || null : null;
        }

        function focusRoomByName(roomName) {
            if (!mapData) return;
            const index = mapData.rooms.findIndex(room => room.name === roomName);
            if (index < 0) return;

            currentRoomIndex = index;
            buildRoomsList();
            document.getElementById('status-room').textContent = buildRoomStatus(roomName);
            fitToView();
            render();
        }

        function validationLabel(status) {
            if (status === 'likelyViable') return 'likely viable';
            if (status === 'unstable') return 'unstable';
            return 'uncertain';
        }

        function buildRoomStatus(roomName) {
            const validation = getRoomValidation(roomName);
            return validation
                ? 'Room: ' + roomName + ' | ' + validationLabel(validation.status) + ' | mean ' + validation.meanSupportDistance + ' | var ' + validation.supportDistanceVariance
                : 'Room: ' + roomName;
        }

        function buildValidationSummaryText() {
            const summary = mapData && mapData.previewMetadata ? mapData.previewMetadata.validationSummary : null;
            if (!summary) {
                return '';
            }

            return ' | Validation: ' + summary.likelyViable + ' likely viable, ' + summary.uncertain + ' uncertain, ' + summary.unstable + ' unstable';
        }

        function getTileGrid() {
            const room = getCurrentRoom();
            if (!room) return null;
            if (activeLayer === 'tilesFg') return room.tilesFg;
            if (activeLayer === 'tilesBg') return room.tilesBg;
            return null;
        }

        function paintTile(tx, ty) {
            const grid = getTileGrid();
            if (!grid) return;
            if (tx < 0 || tx >= grid.width || ty < 0 || ty >= grid.height) return;

            const idx = ty * grid.width + tx;
            const charToPlace = currentTool === 'eraser' ? '0' : currentTileChar;

            if (grid.tiles[idx] !== charToPlace) {
                grid.tiles[idx] = charToPlace;
                render();
            }
        }

        function floodFill(startX, startY) {
            const grid = getTileGrid();
            if (!grid) return;
            if (startX < 0 || startX >= grid.width || startY < 0 || startY >= grid.height) return;

            const targetChar = grid.tiles[startY * grid.width + startX];
            const fillChar = currentTool === 'eraser' ? '0' : currentTileChar;
            if (targetChar === fillChar) return;

            const stack = [[startX, startY]];
            const visited = new Set();

            while (stack.length > 0) {
                const [x, y] = stack.pop();
                const key = x + ',' + y;
                if (visited.has(key)) continue;
                if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) continue;

                const idx = y * grid.width + x;
                if (grid.tiles[idx] !== targetChar) continue;

                grid.tiles[idx] = fillChar;
                visited.add(key);

                stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
            }

            render();
            notifyMapModified();
        }

        function addRoom(name, width, height) {
            if (!mapData) return;

            const tileW = Math.floor(width / 8);
            const tileH = Math.floor(height / 8);

            // Place the new room to the right of existing rooms
            let maxX = 0;
            for (const room of mapData.rooms) {
                maxX = Math.max(maxX, room.x + room.width);
            }

            const newRoom = {
                name: name,
                x: maxX + 16,
                y: 0,
                width: width,
                height: height,
                tileWidth: tileW,
                tileHeight: tileH,
                music: '',
                musicLayer1: true,
                musicLayer2: true,
                musicLayer3: true,
                musicLayer4: true,
                altMusic: '',
                ambience: '',
                dark: false,
                underwater: false,
                space: false,
                disableDownTransition: false,
                cameraOffsetX: 0,
                cameraOffsetY: 0,
                windPattern: 'None',
                color: 0,
                tilesFg: {
                    width: tileW,
                    height: tileH,
                    tiles: new Array(tileW * tileH).fill('0'),
                },
                tilesBg: {
                    width: tileW,
                    height: tileH,
                    tiles: new Array(tileW * tileH).fill('0'),
                },
                objTiles: null,
                entities: [],
                triggers: [],
                decalsFg: [],
                decalsBg: [],
            };

            mapData.rooms.push(newRoom);
            currentRoomIndex = mapData.rooms.length - 1;
            buildRoomsList();
            fitToView();
            render();
            notifyMapModified();
        }

        // ─── Rendering ─────────────────────────────────────────────────

        function render() {
            if (!ctx) return;

            // Clear
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            if (!mapData || mapData.rooms.length === 0) {
                ctx.fillStyle = '#555';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No map loaded — open a .bin file or create a new map', canvasWidth / 2, canvasHeight / 2);
                return;
            }

            ctx.save();
            ctx.translate(viewport.offsetX, viewport.offsetY);
            ctx.scale(viewport.zoom, viewport.zoom);

            const room = getCurrentRoom();
            if (room) {
                // Draw room background
                ctx.fillStyle = '#16213e';
                ctx.fillRect(0, 0, room.width, room.height);

                // Draw background tiles
                const bgLayer = layerDefs.find(l => l.id === 'tilesBg');
                if (bgLayer && bgLayer.visible && room.tilesBg) {
                    renderTileGrid(room.tilesBg, 0.5);
                }

                // Draw foreground tiles
                const fgLayer = layerDefs.find(l => l.id === 'tilesFg');
                if (fgLayer && fgLayer.visible && room.tilesFg) {
                    renderTileGrid(room.tilesFg, 1.0);
                }

                // Draw entities
                const entLayer = layerDefs.find(l => l.id === 'entities');
                if (entLayer && entLayer.visible) {
                    renderEntities(room.entities);
                }

                if (showValidationOverlay) {
                    renderValidationOverlay(room);
                }

                // Draw triggers
                const trigLayer = layerDefs.find(l => l.id === 'triggers');
                if (trigLayer && trigLayer.visible) {
                    renderTriggers(room.triggers);
                }

                // Draw decals
                const fgDecLayer = layerDefs.find(l => l.id === 'decalsFg');
                if (fgDecLayer && fgDecLayer.visible) {
                    renderDecals(room.decalsFg, '#ff88ff');
                }

                const bgDecLayer = layerDefs.find(l => l.id === 'decalsBg');
                if (bgDecLayer && bgDecLayer.visible) {
                    renderDecals(room.decalsBg, '#8888ff');
                }

                // Draw grid
                if (settings.showGrid) {
                    renderGrid(room.width, room.height);
                }

                // Draw room border
                ctx.strokeStyle = '#0e639c';
                ctx.lineWidth = 1 / viewport.zoom;
                ctx.strokeRect(0, 0, room.width, room.height);
            }

            ctx.restore();

            if (showTopologyOverview) {
                renderTopologyOverview();
            } else {
                topologyHitRegions = [];
            }
        }

        function renderTileGrid(grid, opacity) {
            ctx.globalAlpha = opacity;
            const gs = settings.gridSize;

            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.width; x++) {
                    const char = grid.tiles[y * grid.width + x];
                    if (char === '0' || !char) continue;

                    const entry = tilePalette.find(t => t.char === char);
                    ctx.fillStyle = entry ? entry.color : '#888888';
                    ctx.fillRect(x * gs, y * gs, gs, gs);
                }
            }
            ctx.globalAlpha = 1.0;
        }

        function renderEntities(entities) {
            for (const entity of entities) {
                const color = getEntityColor(entity.name);
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.6;

                const w = entity.width || 8;
                const h = entity.height || 8;
                ctx.fillRect(entity.x, entity.y, w, h);

                // Draw entity label
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#fff';
                const fontSize = Math.max(6, Math.min(10, 8 / viewport.zoom * 2));
                ctx.font = fontSize + 'px sans-serif';
                ctx.fillText(entity.name, entity.x + 1, entity.y + h + fontSize + 1);

                // Draw nodes
                if (entity.nodes && entity.nodes.length > 0) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.5;
                    for (const node of entity.nodes) {
                        ctx.beginPath();
                        ctx.moveTo(entity.x + w / 2, entity.y + h / 2);
                        ctx.lineTo(node.x, node.y);
                        ctx.stroke();

                        ctx.fillStyle = color;
                        ctx.fillRect(node.x - 2, node.y - 2, 4, 4);
                    }
                    ctx.globalAlpha = 1.0;
                }
            }
        }

        function renderTriggers(triggers) {
            for (const trigger of triggers) {
                ctx.strokeStyle = '#ffaa00';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                ctx.fillStyle = '#ffaa0033';

                const w = trigger.width || 16;
                const h = trigger.height || 16;
                ctx.fillRect(trigger.x, trigger.y, w, h);
                ctx.strokeRect(trigger.x, trigger.y, w, h);

                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#ffaa00';
                const fontSize = Math.max(5, Math.min(8, 6 / viewport.zoom * 2));
                ctx.font = fontSize + 'px sans-serif';
                ctx.fillText(trigger.name, trigger.x + 1, trigger.y + fontSize + 1);
                ctx.globalAlpha = 1.0;
            }
        }

        function renderValidationOverlay(room) {
            const validation = getRoomValidation(room.name);
            if (!validation || !validation.sampledRoute || validation.sampledRoute.length === 0) {
                return;
            }

            const color = getValidationColor(validation.status);
            const route = validation.sampledRoute;

            ctx.save();
            ctx.lineWidth = Math.max(1 / viewport.zoom, 2 / viewport.zoom);
            ctx.strokeStyle = color;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.95;

            ctx.beginPath();
            ctx.moveTo(route[0].x, route[0].y);
            for (let index = 1; index < route.length; index++) {
                ctx.lineTo(route[index].x, route[index].y);
            }
            ctx.stroke();

            ctx.globalAlpha = 0.3;
            for (const point of route) {
                ctx.beginPath();
                ctx.arc(point.x, point.y, Math.max(1.5 / viewport.zoom, 2.5 / viewport.zoom), 0, Math.PI * 2);
                ctx.fill();
            }

            if (validation.anchors && validation.anchors.length > 0) {
                ctx.globalAlpha = 1.0;
                for (const anchor of validation.anchors) {
                    ctx.fillRect(
                        anchor.x - Math.max(3 / viewport.zoom, 4 / viewport.zoom),
                        anchor.y - Math.max(3 / viewport.zoom, 4 / viewport.zoom),
                        Math.max(6 / viewport.zoom, 8 / viewport.zoom),
                        Math.max(6 / viewport.zoom, 8 / viewport.zoom)
                    );
                }
            }

            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineWidth = Math.max(2 / viewport.zoom, 3 / viewport.zoom);
            ctx.font = Math.max(8 / viewport.zoom, 10 / viewport.zoom) + 'px sans-serif';
            const label = validationLabel(validation.status) + ' | mean ' + validation.meanSupportDistance + ' | var ' + validation.supportDistanceVariance;
            const labelX = route[Math.min(route.length - 1, Math.floor(route.length / 2))].x + 8 / viewport.zoom;
            const labelY = route[Math.min(route.length - 1, Math.floor(route.length / 2))].y - 8 / viewport.zoom;
            ctx.strokeText(label, labelX, labelY);
            ctx.fillText(label, labelX, labelY);
            ctx.restore();
        }

        function renderTopologyOverview() {
            const preview = mapData && mapData.previewMetadata;
            const nodes = preview && preview.nodes ? preview.nodes : null;
            if (!nodes || nodes.length === 0) {
                topologyHitRegions = [];
                return;
            }

            const panelWidth = 240;
            const panelHeight = 180;
            const margin = 12;
            const panelX = canvasWidth - panelWidth - margin;
            const panelY = margin;
            const innerX = panelX + 18;
            const innerY = panelY + 28;
            const innerWidth = panelWidth - 36;
            const innerHeight = panelHeight - 52;
            const minColumn = Math.min(...nodes.map(node => node.column));
            const maxColumn = Math.max(...nodes.map(node => node.column));
            const minRow = Math.min(...nodes.map(node => node.row));
            const maxRow = Math.max(...nodes.map(node => node.row));
            const mainPath = new Set(preview.mainPathNodeIds || []);
            const currentNode = getCurrentTopologyNode();
            const layout = new Map();

            topologyHitRegions = [];

            ctx.save();
            ctx.fillStyle = 'rgba(13, 18, 32, 0.9)';
            ctx.strokeStyle = 'rgba(90, 120, 170, 0.9)';
            ctx.lineWidth = 1;
            ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
            ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

            ctx.fillStyle = '#d7e3ff';
            ctx.font = '12px sans-serif';
            ctx.fillText('Chapter Topology', panelX + 12, panelY + 16);

            for (const node of nodes) {
                const normalizedX = maxColumn === minColumn ? 0.5 : (node.column - minColumn) / Math.max(1, maxColumn - minColumn);
                const normalizedY = maxRow === minRow ? 0.5 : (node.row - minRow) / Math.max(1, maxRow - minRow);
                const x = innerX + normalizedX * innerWidth;
                const y = innerY + normalizedY * innerHeight;
                layout.set(node.id, { x, y, roomName: node.roomName, node });
            }

            const drawnEdges = new Set();
            for (const node of nodes) {
                const from = layout.get(node.id);
                if (!from) continue;

                for (const connectionId of node.connections) {
                    const edgeKey = node.id < connectionId ? node.id + ':' + connectionId : connectionId + ':' + node.id;
                    if (drawnEdges.has(edgeKey)) {
                        continue;
                    }
                    drawnEdges.add(edgeKey);

                    const to = layout.get(connectionId);
                    if (!to) continue;

                    const isMainPathEdge = mainPath.has(node.id) && mainPath.has(connectionId);
                    ctx.beginPath();
                    ctx.strokeStyle = isMainPathEdge ? 'rgba(98, 174, 255, 0.95)' : 'rgba(120, 130, 160, 0.55)';
                    ctx.lineWidth = isMainPathEdge ? 2.5 : 1.2;
                    ctx.moveTo(from.x, from.y);
                    ctx.lineTo(to.x, to.y);
                    ctx.stroke();
                }
            }

            for (const node of nodes) {
                const point = layout.get(node.id);
                if (!point) continue;

                const radius = currentNode && currentNode.id === node.id ? 8 : 6;
                const fillColor = getValidationColor(node.validation ? node.validation.status : 'uncertain');

                ctx.beginPath();
                ctx.fillStyle = fillColor;
                ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = currentNode && currentNode.id === node.id ? '#ffffff' : 'rgba(18, 22, 36, 0.95)';
                ctx.lineWidth = currentNode && currentNode.id === node.id ? 2.5 : 1.5;
                ctx.stroke();

                if (node.role === 'start' || node.role === 'goal' || node.role === 'checkpoint') {
                    ctx.fillStyle = '#ffffff';
                    ctx.font = '10px sans-serif';
                    const marker = node.role === 'start' ? 'S' : node.role === 'goal' ? 'G' : 'C';
                    ctx.fillText(marker, point.x - 3, point.y - 10);
                }

                topologyHitRegions.push({
                    roomName: node.roomName,
                    x: point.x,
                    y: point.y,
                    radius: radius + 5,
                });
            }

            ctx.fillStyle = '#9fb3d9';
            ctx.font = '10px sans-serif';
            ctx.fillText('Green: likely viable', panelX + 12, panelY + panelHeight - 22);
            ctx.fillText('Yellow: uncertain  Red: unstable', panelX + 12, panelY + panelHeight - 8);
            ctx.restore();
        }

        function hitTestTopologyOverview(screenX, screenY) {
            for (const region of topologyHitRegions) {
                const dx = screenX - region.x;
                const dy = screenY - region.y;
                if (Math.hypot(dx, dy) <= region.radius) {
                    return region;
                }
            }
            return null;
        }

        function getValidationColor(status) {
            if (status === 'likelyViable') return '#32d17c';
            if (status === 'unstable') return '#ff5f56';
            return '#ffbd2e';
        }

        function renderDecals(decals, color) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5;
            for (const decal of decals) {
                ctx.fillRect(decal.x - 4, decal.y - 4, 8, 8);
            }
            ctx.globalAlpha = 1.0;
        }

        function renderGrid(width, height) {
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.5 / viewport.zoom;
            const gs = settings.gridSize;

            ctx.beginPath();
            for (let x = 0; x <= width; x += gs) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
            }
            for (let y = 0; y <= height; y += gs) {
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
            }
            ctx.stroke();
        }

        function fitToView() {
            const room = getCurrentRoom();
            if (!room) return;

            const padding = 40;
            const scaleX = (canvasWidth - padding * 2) / room.width;
            const scaleY = (canvasHeight - padding * 2) / room.height;
            viewport.zoom = Math.min(scaleX, scaleY, 4);
            viewport.offsetX = (canvasWidth - room.width * viewport.zoom) / 2;
            viewport.offsetY = (canvasHeight - room.height * viewport.zoom) / 2;
            updateZoomStatus();
            render();
        }

        // ─── Communication ─────────────────────────────────────────────

        function notifyMapModified() {
            vscode.postMessage({ type: 'mapModified', data: mapData });
        }

        window.addEventListener('message', (event) => {
            const msg = event.data;
            switch (msg.type) {
                case 'loadMap':
                    mapData = msg.data;
                    currentRoomIndex = 0;
                    buildRoomsList();
                    if (mapData.rooms.length > 0) {
                        document.getElementById('status-room').textContent = buildRoomStatus(mapData.rooms[0].name);
                    }
                    document.getElementById('toolbar-info').textContent = 
                        'Package: ' + mapData.packageName + ' | Rooms: ' + mapData.rooms.length + buildValidationSummaryText();
                    fitToView();
                    break;

                case 'updateSettings':
                    settings = { ...settings, ...msg.settings };
                    render();
                    break;

                case 'setTool':
                    setTool(msg.tool);
                    break;
            }
        });

        // ─── Init ──────────────────────────────────────────────────────
        initUI();
        vscode.postMessage({ type: 'ready' });
    })();
    </script>
</body>
</html>`;
    }
}

// ─── Map Document ──────────────────────────────────────────────────────────────

export class CelesteMapDocument implements vscode.CustomDocument {
    public mapData: CelesteMap;

    constructor(public readonly uri: vscode.Uri) {
        this.mapData = createEmptyMap();
    }

    async load(): Promise<void> {
        try {
            const rawData = await vscode.workspace.fs.readFile(this.uri);
            const buffer = rawData.buffer.slice(
                rawData.byteOffset,
                rawData.byteOffset + rawData.byteLength
            ) as ArrayBuffer;
            this.mapData = parseMapBinary(buffer);
        } catch (err) {
            console.error('[Celeste Map Editor] Failed to parse map:', err);
            this.mapData = createEmptyMap(this.uri.path.split('/').pop()?.replace('.bin', '') || 'newmap');
        }
    }

    dispose(): void {
        // nothing to dispose
    }
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function getNonce(): string {
    return crypto.randomBytes(24).toString('base64').replace(/[^a-zA-Z0-9]/g, 'A');
}
