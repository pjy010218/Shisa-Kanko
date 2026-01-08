"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIFileDecorationProvider = void 0;
const vscode = require("vscode");
class AIFileDecorationProvider {
    constructor() {
        this._onDidChangeFileDecorations = new vscode.EventEmitter();
        this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
        this.activePaths = new Set();
    }
    /**
     * Update using fsPaths
     */
    update(paths) {
        this.activePaths = new Set(paths);
        this._onDidChangeFileDecorations.fire(undefined);
    }
    provideFileDecoration(uri) {
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
exports.AIFileDecorationProvider = AIFileDecorationProvider;
//# sourceMappingURL=fileDecorationProvider.js.map