import * as vscode from 'vscode';
import { AgentListener } from './agentListener';
import { DecorationManager } from './decorationManager';
import { AIFileDecorationProvider } from './fileDecorationProvider';

let agentListener: AgentListener | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('[Shisa-Kanko] Activating Observer HUD...');
    const decorationManager = new DecorationManager();
    const fileDecorationProvider = new AIFileDecorationProvider();

    const config = vscode.workspace.getConfiguration('shisa-kanko');
    const port = config.get<number>('port', 3000);
    agentListener = new AgentListener(port);
    agentListener.start();

    vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('shisa-kanko.port')) {
            vscode.window.showInformationMessage('포트 설정이 변경되었습니다. 변경 사항을 적용하려면 VS Code를 재시작하거나 익스텐션을 다시 로드해주세요.');
        }
    });

    // Consistent helper to update everything at once using fsPaths
    const syncHUD = () => {
        const allActivePaths = decorationManager.getActivePaths();
        fileDecorationProvider.update(allActivePaths);
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

    const clearCommand = vscode.commands.registerCommand('shisa-kanko.clearHighlights', () => {
        decorationManager.clearAll();
        syncHUD();
        vscode.window.showInformationMessage('[Shisa-Kanko] Highlights cleared.');
    });

    // Autonomous Observation: Watch for edits and highlight significant ones
    const documentChangeSub = vscode.workspace.onDidChangeTextDocument(async e => {
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

    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(fileDecorationProvider),
        decorationManager,
        editorChangeSub,
        documentChangeSub,
        saveSub,
        clearCommand,
        hideDiffsCommand,
        showDiffsCommand
    );
}

export function deactivate() { }