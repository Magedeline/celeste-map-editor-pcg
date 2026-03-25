/**
 * Celeste Map Editor - VS Code Extension Entry Point
 * 
 * Registers the custom editor provider and commands.
 */

import * as vscode from 'vscode';
import { CelesteMapEditorProvider } from './celesteMapEditorProvider';
import { createEmptyMap } from './mapParser';
import { serializeMapBinary, serializeMapJson } from './mapSerializer';
import { createCompatibilityBundle } from './compatibility';

export function activate(context: vscode.ExtensionContext) {
    console.log('[Celeste Map Editor] Extension activated');

    const provider = new CelesteMapEditorProvider(context);

    // Register the custom editor provider
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            CelesteMapEditorProvider.viewType,
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    // Register the "New Map" command
    context.subscriptions.push(
        vscode.commands.registerCommand('celesteMapEditor.newMap', async () => {
            const packageName = await vscode.window.showInputBox({
                prompt: 'Enter the package name for the new map',
                value: 'newmap',
                placeHolder: 'e.g., MyMod/1-MyFirstLevel',
            });

            if (!packageName) {
                return;
            }

            const folderUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.workspace.workspaceFolders?.[0]?.uri,
                filters: { 'Celeste Map': ['bin'] },
                saveLabel: 'Create Map',
            });

            if (!folderUri) {
                return;
            }

            const emptyMap = createEmptyMap(packageName);
            const data = serializeMapBinary(emptyMap);
            await vscode.workspace.fs.writeFile(folderUri, new Uint8Array(data));

            // Open the new map in the editor
            await vscode.commands.executeCommand('vscode.openWith', folderUri, CelesteMapEditorProvider.viewType);
        })
    );

    // Register the "Export as JSON" command
    context.subscriptions.push(
        vscode.commands.registerCommand('celesteMapEditor.exportJson', async () => {
            const editor = vscode.window.activeTextEditor;
            
            // Show file picker for the source .bin file
            const sourceUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'Celeste Map': ['bin'] },
                openLabel: 'Select Map to Export',
            });

            if (!sourceUri || sourceUri.length === 0) {
                return;
            }

            try {
                const { parseMapBinary } = await import('./mapParser');
                const rawData = await vscode.workspace.fs.readFile(sourceUri[0]);
                const buffer = rawData.buffer.slice(
                    rawData.byteOffset,
                    rawData.byteOffset + rawData.byteLength
                ) as ArrayBuffer;
                const map = parseMapBinary(buffer);
                const json = serializeMapJson(map);

                const saveUri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(sourceUri[0].fsPath.replace('.bin', '.json')),
                    filters: { 'JSON': ['json'] },
                });

                if (saveUri) {
                    await vscode.workspace.fs.writeFile(saveUri, new TextEncoder().encode(json));
                    vscode.window.showInformationMessage(`Map exported to ${saveUri.fsPath}`);
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to export map: ${err.message}`);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('celesteMapEditor.generateRoomCluster', async () => {
            await provider.generateRoomClusterForActiveEditor();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('celesteMapEditor.exportCompatibilityBundle', async () => {
            const sourceUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'Celeste Map': ['bin'] },
                openLabel: 'Select Map for Compatibility Export',
            });

            if (!sourceUri || sourceUri.length === 0) {
                return;
            }

            const targetFolder = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                openLabel: 'Choose Export Folder',
            });

            if (!targetFolder || targetFolder.length === 0) {
                return;
            }

            try {
                const { parseMapBinary } = await import('./mapParser');
                const rawData = await vscode.workspace.fs.readFile(sourceUri[0]);
                const buffer = rawData.buffer.slice(
                    rawData.byteOffset,
                    rawData.byteOffset + rawData.byteLength
                ) as ArrayBuffer;
                const map = parseMapBinary(buffer);

                const config = vscode.workspace.getConfiguration('celesteMapEditor');
                const bundle = createCompatibilityBundle(map, {
                    loennModulePrefix: config.get('loennModulePrefix', 'CelesteMapEditor'),
                    monoGameNamespace: config.get('monoGameNamespace', 'CelesteMapEditor.Interop'),
                    loennPluginPath: config.get('loennPluginPath', ''),
                });

                const rootFolder = targetFolder[0];
                for (const file of bundle.files) {
                    const segments = file.relativePath.split('/');
                    const fileName = segments.pop();
                    if (!fileName) {
                        continue;
                    }

                    let folderUri = rootFolder;
                    for (const segment of segments) {
                        folderUri = vscode.Uri.joinPath(folderUri, segment);
                    }

                    await vscode.workspace.fs.createDirectory(folderUri);
                    const fileUri = vscode.Uri.joinPath(folderUri, fileName);
                    await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(file.content));
                }

                vscode.window.showInformationMessage(`Compatibility bundle exported to ${rootFolder.fsPath}`);
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to export compatibility bundle: ${err.message}`);
            }
        })
    );
}

export function deactivate() {
    console.log('[Celeste Map Editor] Extension deactivated');
}
