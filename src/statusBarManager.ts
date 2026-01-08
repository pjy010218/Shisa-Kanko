import * as vscode from 'vscode';
import { DecorationManager } from './decorationManager';

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private decorationManager: DecorationManager) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'shisa-kanko.showActiveSignals';
        this.update(0);
        this.statusBarItem.show();

        vscode.commands.registerCommand('shisa-kanko.showActiveSignals', () => this.showActiveSignals());
    }

    public update(count: number) {
        if (count > 0) {
            this.statusBarItem.text = `$(radio-tower) ${count} Signals`;
            this.statusBarItem.tooltip = 'Shisa-Kanko: Active AI Highlights (Click to view lists)';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = `$(radio-tower) Shisa-Kanko`;
            this.statusBarItem.tooltip = 'Shisa-Kanko: Waiting for AI Agent...';
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    private async showActiveSignals() {
        const fileDetails = this.decorationManager.getActiveFileDetails();

        if (fileDetails.length === 0) {
            vscode.window.showInformationMessage('No active AI signals.');
            return;
        }

        const items: vscode.QuickPickItem[] = fileDetails.map(detail => {
            const uri = vscode.Uri.file(detail.path);
            return {
                label: `$(file) ${require('path').basename(detail.path)}`,
                description: `${detail.signalCount} signals`,
                detail: detail.path,
                // Store data for later use if needed, but QuickPickItem structure is fixed.
                // We'll use the 'detail' (path) to navigate.
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a file to jump to the AI activity'
        });

        if (selected && selected.detail) {
            const doc = await vscode.workspace.openTextDocument(selected.detail);
            const editor = await vscode.window.showTextDocument(doc);

            // Jump to first highlight
            const firstRange = this.decorationManager.getFirstHighlightRange(doc.uri);
            if (firstRange) {
                editor.revealRange(firstRange, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(firstRange.start, firstRange.start);
            }
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }
}
