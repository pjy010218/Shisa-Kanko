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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const agentListener_1 = require("./agentListener");
const decorationManager_1 = require("./decorationManager");
const fileDecorationProvider_1 = require("./fileDecorationProvider");
const statusBarManager_1 = require("./statusBarManager");
let agentListener;
let statusBarManager;
function activate(context) {
    console.log('[Shisa-Kanko] Activating Observer HUD...');
    const decorationManager = new decorationManager_1.DecorationManager();
    const fileDecorationProvider = new fileDecorationProvider_1.AIFileDecorationProvider();
    statusBarManager = new statusBarManager_1.StatusBarManager(decorationManager);
    const config = vscode.workspace.getConfiguration('shisa-kanko');
    const port = config.get('port', 3000);
    agentListener = new agentListener_1.AgentListener(port, context.secrets);
    agentListener.start();
    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('shisa-kanko.port')) {
            const newPort = vscode.workspace.getConfiguration('shisa-kanko').get('port', 3000);
            agentListener?.restart(newPort);
            vscode.window.showInformationMessage(`[Shisa-Kanko] Server restarting on port ${newPort}`);
        }
        if (e.affectsConfiguration('shisa-kanko.hudStyle')) {
            decorationManager.reloadStyles();
            vscode.window.setStatusBarMessage('[Shisa-Kanko] HUD Style Updated', 2000);
        }
    });
    // Consistent helper to update everything at once using fsPaths
    const syncHUD = () => {
        const allActivePaths = decorationManager.getActivePaths();
        fileDecorationProvider.update(allActivePaths);
        statusBarManager.update(decorationManager.getTotalSignalCount());
    };
    // Handle plans received from agents (Internal or External via WebSocket)
    agentListener.onPlanReceived(async (plan) => {
        await decorationManager.applyPlan(plan);
        syncHUD();
        vscode.window.showInformationMessage(`[Shisa-Kanko] AI highlights applied for ${plan.targets.length} files.`);
    });
    // Update highlights on editor switch
    const editorChangeSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
            decorationManager.updateEditor(editor);
            const firstRange = decorationManager.getFirstHighlightRange(editor.document.uri);
            if (firstRange) {
                editor.revealRange(firstRange, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(firstRange.start, firstRange.start);
            }
        }
    });
    const showTokenCommand = vscode.commands.registerCommand('shisa-kanko.showToken', async () => {
        if (agentListener) {
            const token = await agentListener.getToken();
            const copyOption = 'Copy to Clipboard';
            const choice = await vscode.window.showInformationMessage(`Shisa-Kanko Connection Token: ${token}`, { modal: true }, copyOption);
            if (choice === copyOption) {
                await vscode.env.clipboard.writeText(token);
                vscode.window.showInformationMessage('Token copied to clipboard.');
            }
        }
    });
    const clearCommand = vscode.commands.registerCommand('shisa-kanko.clearHighlights', () => {
        decorationManager.clearAll();
        syncHUD();
        vscode.window.showInformationMessage('[Shisa-Kanko] Highlights cleared.');
    });
    // Autonomous Observation: Watch for edits and highlight significant ones
    const documentChangeSub = vscode.workspace.onDidChangeTextDocument(async (e) => {
        if (await decorationManager.observeChange(e)) {
            syncHUD();
        }
    });
    // Auto-Clear on Save with Grace Period
    const saveSub = vscode.workspace.onDidSaveTextDocument(doc => {
        const path = doc.uri.fsPath;
        const lastMod = decorationManager.getLastModified(path);
        const now = Date.now();
        // If the file was modified by Shisa-Kanko observation within the last 3 seconds, 
        // we ignore this save event (likely an AI auto-save).
        if (now - lastMod < 3000) {
            console.log(`[Shisa-Kanko] Ignoring save for ${path} (Grace period active).`);
            return;
        }
        console.log(`[Shisa-Kanko] File saved: ${path}. Clearing HUD.`);
        decorationManager.clear(path);
        syncHUD();
    });
    // Option to hide standard VS Code diff decorations for a "Pure HUD" experience
    const hideDiffsCommand = vscode.commands.registerCommand('shisa-kanko.hideStandardDiffs', async () => {
        const config = vscode.workspace.getConfiguration();
        await config.update('scm.diffDecorations', 'none', vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('[Shisa-Kanko] Standard Gutter Diffs hidden. Using HUD mode.');
    });
    const showDiffsCommand = vscode.commands.registerCommand('shisa-kanko.showStandardDiffs', async () => {
        const config = vscode.workspace.getConfiguration();
        await config.update('scm.diffDecorations', 'all', vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('[Shisa-Kanko] Standard Gutter Diffs restored.');
    });
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(fileDecorationProvider), decorationManager, editorChangeSub, documentChangeSub, saveSub, clearCommand, hideDiffsCommand, showDiffsCommand, showTokenCommand, statusBarManager);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map