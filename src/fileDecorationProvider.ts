import * as vscode from 'vscode';

export class AIFileDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
    private activePaths = new Set<string>();

    /**
     * Update using fsPaths
     */
    public update(paths: string[]) {
        this.activePaths = new Set(paths);
        this._onDidChangeFileDecorations.fire(undefined);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (this.activePaths.has(uri.fsPath)) {
            return {
                badge: 'AI',
                tooltip: 'AI modification planned',
                color: new vscode.ThemeColor('shisa.kanko.fileDecoration'),
                propagate: true
            };
        }
        return undefined;
    }
}