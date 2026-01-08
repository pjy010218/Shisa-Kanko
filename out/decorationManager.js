"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DecorationManager = void 0;
const vscode = __importStar(require("vscode"));
class DecorationManager {
    constructor() {
        // fsPath -> Map of changeType (string) -> decoration options
        // internal identifiers: 'logic_change', 'refactor', 'suggestion'
        this.activeDecorations = new Map();
        // Persistent tracking of last modification time per file
        this.lastModificationTimes = new Map();
        this.reloadStyles();
    }
    reloadStyles() {
        // Dispose existing if methods exist (in restart scenarios)
        if (this.logicDecoration)
            this.logicDecoration.dispose();
        if (this.refactorDecoration)
            this.refactorDecoration.dispose();
        if (this.suggestionDecoration)
            this.suggestionDecoration.dispose();
        const config = vscode.workspace.getConfiguration('shisa-kanko');
        const styleProfile = config.get('hudStyle', 'high-visibility');
        this.logicDecoration = this.createDecoration(styleProfile, 'rgba(0, 150, 255, 0.4)', 'rgba(0, 150, 255, 0.8)', 'blue');
        this.refactorDecoration = this.createDecoration(styleProfile, 'rgba(75, 200, 75, 0.4)', 'rgba(75, 200, 75, 0.8)', 'green');
        this.suggestionDecoration = this.createDecoration(styleProfile, 'rgba(255, 204, 0, 0.4)', 'rgba(255, 204, 0, 0.8)', 'yellow');
        // Re-apply styles to active editors since decoration references changed
        this.updateVisibleEditors();
    }
    createDecoration(profile, bgColor, borderColor, rulerColor) {
        if (profile === 'minimalist') {
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: undefined, // No background
                borderWidth: '0 0 0 4px', // Left border aka Gutter
                borderStyle: 'solid',
                borderColor: borderColor,
                isWholeLine: true,
                overviewRulerColor: rulerColor,
                overviewRulerLane: vscode.OverviewRulerLane.Full
            });
        }
        else if (profile === 'underline') {
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: undefined,
                textDecoration: `underline wavy ${borderColor}`,
                isWholeLine: true,
                overviewRulerColor: rulerColor,
                overviewRulerLane: vscode.OverviewRulerLane.Full
            });
        }
        else {
            // Default: "high-visibility"
            return vscode.window.createTextEditorDecorationType({
                backgroundColor: bgColor,
                outline: `2.5px solid ${borderColor}`,
                isWholeLine: true,
                overviewRulerColor: rulerColor,
                overviewRulerLane: vscode.OverviewRulerLane.Full,
            });
        }
    }
    async applyPlan(plan) {
        for (const target of plan.targets) {
            let absolutePath = target.filePath;
            if (!require('path').isAbsolute(target.filePath) && vscode.workspace.workspaceFolders) {
                absolutePath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, target.filePath).fsPath;
            }
            // Map changeType to our internal keys
            const typeKey = (target.changeType === 'logic_change' || target.changeType === 'refactor') ? target.changeType : 'suggestion';
            const options = target.lines.map(line => ({
                range: new vscode.Range(line - 1, 0, line - 1, 2000),
                hoverMessage: target.reason ? new vscode.MarkdownString(`**[Shisa-Kanko HUD]**\n\n${target.reason}`) : undefined
            }));
            if (!this.activeDecorations.has(absolutePath))
                this.activeDecorations.set(absolutePath, new Map());
            const fileMap = this.activeDecorations.get(absolutePath);
            const existingOptions = fileMap.get(typeKey) || [];
            fileMap.set(typeKey, [...existingOptions, ...options]);
            this.lastModificationTimes.set(absolutePath, Date.now());
        }
        this.updateVisibleEditors();
    }
    updateEditor(editor) {
        const path = editor.document.uri.fsPath;
        const fileMap = this.activeDecorations.get(path);
        // Always clear first
        editor.setDecorations(this.logicDecoration, []);
        editor.setDecorations(this.refactorDecoration, []);
        editor.setDecorations(this.suggestionDecoration, []);
        if (fileMap) {
            const logicOpts = fileMap.get('logic_change');
            if (logicOpts)
                editor.setDecorations(this.logicDecoration, logicOpts);
            const refactorOpts = fileMap.get('refactor');
            if (refactorOpts)
                editor.setDecorations(this.refactorDecoration, refactorOpts);
            const suggestionOpts = fileMap.get('suggestion');
            if (suggestionOpts)
                editor.setDecorations(this.suggestionDecoration, suggestionOpts);
        }
    }
    getTotalSignalCount() {
        let count = 0;
        for (const fileMap of this.activeDecorations.values()) {
            for (const options of fileMap.values()) {
                count += options.length;
            }
        }
        return count;
    }
    getActiveFileDetails() {
        const details = [];
        for (const [path, fileMap] of this.activeDecorations) {
            let count = 0;
            for (const options of fileMap.values()) {
                count += options.length;
            }
            if (count > 0) {
                details.push({ path, signalCount: count });
            }
        }
        return details;
    }
    updateVisibleEditors() {
        vscode.window.visibleTextEditors.forEach(e => this.updateEditor(e));
    }
    getActivePaths() {
        return Array.from(this.activeDecorations.keys());
    }
    getLastModified(path) {
        return this.lastModificationTimes.get(path) || 0;
    }
    getFirstHighlightRange(uri) {
        const fileMap = this.activeDecorations.get(uri.fsPath);
        if (!fileMap)
            return undefined;
        const allOptions = Array.from(fileMap.values()).flat();
        const allRanges = allOptions.map(o => o.range);
        if (allRanges.length === 0)
            return undefined;
        return allRanges.sort((a, b) => a.start.line - b.start.line)[0];
    }
    clear(path) {
        if (path) {
            this.activeDecorations.delete(path);
            this.lastModificationTimes.delete(path);
        }
        else {
            this.activeDecorations.clear();
            this.lastModificationTimes.clear();
        }
        this.updateVisibleEditors();
    }
    clearAll() {
        this.clear();
    }
    /**
     * Autonomous observation: detect large changes and auto-highlight them.
     */
    async observeChange(event) {
        const config = vscode.workspace.getConfiguration('shisa-kanko');
        const observerMode = config.get('observerMode', 'selective');
        if (observerMode === 'none')
            return false;
        const path = event.document.uri.fsPath;
        const activeEditor = vscode.window.activeTextEditor;
        // DISCRIMINATOR: Detect if this is likely a human user typing
        if (activeEditor && activeEditor.document.uri.fsPath === path) {
            // If there's only one change and it's small (character addition/deletion), it's likely the user
            if (event.contentChanges.length === 1) {
                const change = event.contentChanges[0];
                const isTyping = change.text.length <= 2 && change.rangeLength <= 2;
                if (isTyping)
                    return false;
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
            const target = {
                filePath: path,
                lines: event.contentChanges.map(c => {
                    const startLine = c.range.start.line + 1;
                    const addedLineCount = c.text.split('\n').length;
                    return Array.from({ length: addedLineCount }, (_, i) => startLine + i);
                }).flat(),
                changeType: 'refactor',
                reason: 'Background modification detected (AI Agent?)'
            };
            const plan = {
                planId: 'auto-' + Date.now(),
                status: 'suggestion',
                targets: [target]
            };
            await this.applyPlan(plan);
            return true;
        }
        return false;
    }
    dispose() {
        this.logicDecoration.dispose();
        this.refactorDecoration.dispose();
        this.suggestionDecoration.dispose();
    }
}
exports.DecorationManager = DecorationManager;
//# sourceMappingURL=decorationManager.js.map