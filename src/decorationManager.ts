import * as vscode from 'vscode';
import { AgentModificationPlan, ModificationTarget } from './types';

export class DecorationManager {
    private logicDecoration: vscode.TextEditorDecorationType;
    private refactorDecoration: vscode.TextEditorDecorationType;
    private suggestionDecoration: vscode.TextEditorDecorationType;

    // fsPath -> Map of decoration types -> decoration options
    private activeDecorations = new Map<string, Map<vscode.TextEditorDecorationType, vscode.DecorationOptions[]>>();

    // Persistent tracking of last modification time per file
    private lastModificationTimes = new Map<string, number>();

    constructor() {
        this.logicDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(0, 150, 255, 0.4)',
            outline: '2.5px solid rgba(0, 150, 255, 0.8)',
            isWholeLine: true,
            overviewRulerColor: 'blue',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
        });
        this.refactorDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(75, 200, 75, 0.4)',
            outline: '2.5px solid rgba(75, 200, 75, 0.8)',
            isWholeLine: true,
            overviewRulerColor: 'green',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
        });
        this.suggestionDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 204, 0, 0.4)',
            outline: '2.5px solid rgba(255, 204, 0, 0.8)',
            isWholeLine: true,
            overviewRulerColor: 'yellow',
            overviewRulerLane: vscode.OverviewRulerLane.Full,
        });
    }

    public async applyPlan(plan: AgentModificationPlan) {
        for (const target of plan.targets) {
            let absolutePath = target.filePath;
            if (!require('path').isAbsolute(target.filePath) && vscode.workspace.workspaceFolders) {
                absolutePath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, target.filePath).fsPath;
            }

            let dtype = this.suggestionDecoration;
            if (target.changeType === 'logic_change') {
                dtype = this.logicDecoration;
            } else if (target.changeType === 'refactor') {
                dtype = this.refactorDecoration;
            }

            const options: vscode.DecorationOptions[] = target.lines.map(line => ({
                range: new vscode.Range(line - 1, 0, line - 1, 2000),
                hoverMessage: target.reason ? new vscode.MarkdownString(`**[Shisa-Kanko HUD]**\n\n${target.reason}`) : undefined
            }));

            if (!this.activeDecorations.has(absolutePath)) this.activeDecorations.set(absolutePath, new Map());
            const fileMap = this.activeDecorations.get(absolutePath)!;

            const existingOptions = fileMap.get(dtype) || [];
            fileMap.set(dtype, [...existingOptions, ...options]);

            this.lastModificationTimes.set(absolutePath, Date.now());
        }
        this.updateVisibleEditors();
    }

    public updateEditor(editor: vscode.TextEditor) {
        const path = editor.document.uri.fsPath;
        const fileMap = this.activeDecorations.get(path);

        [this.logicDecoration, this.refactorDecoration, this.suggestionDecoration].forEach(d => editor.setDecorations(d, []));

        if (fileMap) {
            for (const [dtype, options] of fileMap) {
                editor.setDecorations(dtype, options);
            }
        }
    }

    public updateVisibleEditors() {
        vscode.window.visibleTextEditors.forEach(e => this.updateEditor(e));
    }

    public getActivePaths(): string[] {
        return Array.from(this.activeDecorations.keys());
    }

    public getLastModified(path: string): number {
        return this.lastModificationTimes.get(path) || 0;
    }

    public getFirstHighlightRange(uri: vscode.Uri): vscode.Range | undefined {
        const fileMap = this.activeDecorations.get(uri.fsPath);
        if (!fileMap) return undefined;

        const allOptions = Array.from(fileMap.values()).flat();
        const allRanges = allOptions.map(o => o.range);
        return allRanges.sort((a, b) => a.start.line - b.start.line)[0];
    }

    public clear(path?: string) {
        if (path) {
            this.activeDecorations.delete(path);
            this.lastModificationTimes.delete(path);
        } else {
            this.activeDecorations.clear();
            this.lastModificationTimes.clear();
        }
        this.updateVisibleEditors();
    }

    public clearAll() {
        this.clear();
    }

    /**
     * Autonomous observation: detect large changes and auto-highlight them.
     */
    public async observeChange(event: vscode.TextDocumentChangeEvent): Promise<boolean> {
        const config = vscode.workspace.getConfiguration('shisa-kanko');
        const observerMode = config.get<string>('observerMode', 'selective');

        if (observerMode === 'none') return false;

        const path = event.document.uri.fsPath;
        const activeEditor = vscode.window.activeTextEditor;

        // DISCRIMINATOR: Detect if this is likely a human user typing
        if (activeEditor && activeEditor.document.uri.fsPath === path) {
            // If there's only one change and it's small (character addition/deletion), it's likely the user
            if (event.contentChanges.length === 1) {
                const change = event.contentChanges[0];
                const isTyping = change.text.length <= 2 && change.rangeLength <= 2;
                if (isTyping) return false;
            }

            // If the edit is at the current cursor position, it's likely manual
            const cursor = activeEditor.selection.active;
            const isAtCursor = event.contentChanges.some(c => c.range.contains(cursor) || c.range.start.line === cursor.line);

            // If it's a small edit at cursor, skip. 
            // We only observe "Autonomous" edits that happen away from cursor or across many lines.
            const isSmallEdit = event.contentChanges.every(c => c.text.length < 20 && c.text.split('\n').length === 1);
            if (isAtCursor && isSmallEdit && observerMode === 'selective') {
                return false;
            }
        }

        // Threshold for "Significant" AI change
        const isSignificant = event.contentChanges.some(change => {
            const lineCount = change.text.split('\n').length;
            // AI refactors are usually batch injections
            return lineCount > 1 || change.text.length > 50;
        });

        if (isSignificant) {
            const target: ModificationTarget = {
                filePath: path,
                lines: event.contentChanges.map(c => {
                    const startLine = c.range.start.line + 1;
                    const addedLineCount = c.text.split('\n').length;
                    return Array.from({ length: addedLineCount }, (_, i) => startLine + i);
                }).flat(),
                changeType: 'refactor',
                reason: 'Background modification detected (AI Agent?)'
            };

            const plan: AgentModificationPlan = {
                planId: 'auto-' + Date.now(),
                status: 'suggestion',
                targets: [target]
            };

            await this.applyPlan(plan);
            return true;
        }
        return false;
    }

    public dispose() {
        this.logicDecoration.dispose();
        this.refactorDecoration.dispose();
        this.suggestionDecoration.dispose();
    }
}