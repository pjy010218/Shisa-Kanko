"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processInternalAIRequest = processInternalAIRequest;
exports.registerChatParticipant = registerChatParticipant;
const vscode = require("vscode");
const path = require("path");
/**
 * Core logic for the internal AI agent.
 * Can be called by Chat Participant handle or by Command Palette.
 */
async function processInternalAIRequest(prompt, decorationManager, stream) {
    const report = (msg) => {
        if (stream)
            stream.markdown(msg);
        else
            vscode.window.showInformationMessage(`[Shisa-Kanko] ${msg}`);
    };
    const reportError = (msg) => {
        if (stream)
            stream.markdown(`**Error**: ${msg}`);
        else
            vscode.window.showErrorMessage(`[Shisa-Kanko] ${msg}`);
    };
    console.log('[Shisa-Kanko] Internal agent processing prompt:', prompt);
    // 1. Select the chat model
    let models = [];
    try {
        models = await vscode.lm.selectChatModels();
    }
    catch (e) {
        console.error('[Shisa-Kanko] Failed to select chat models:', e);
        reportError('Failed to access AI models. Please ensure GitHub Copilot or equivalent is active.');
        return;
    }
    let model = models.find(m => m.family === 'gpt-4') || models[0];
    if (!model) {
        reportError('No suitable AI model found.');
        return;
    }
    console.log(`[Shisa-Kanko] Using model: ${model.name} (${model.id})`);
    // 2. Prompt the model
    const messages = [
        vscode.LanguageModelChatMessage.User(`You are Shisa-Kanko, a helpful AI assistant. 
        Your goal is to help the user with their code while providing a "Heads-Up Display" (HUD) of your changes.
        
        INSTRUCTIONS:
        1. Explain what you are doing in natural language.
        2. Provide any code blocks the user needs.
        3. At the very end of your response, provide an internal JSON plan for the highlighter.
        
        FORMAT FOR JSON (Put this after all your text, starting with exactly "[INTERNAL_PLAN]"):
        [INTERNAL_PLAN]
        {"targets": [{"filePath": "relative/path/to/file", "lines": [1, 2], "changeType": "logic_change", "reason": "why"}]}
        
        CRITICAL: 
        - Use ONLY these changeType values: 'logic_change', 'refactor', 'suggestion'.
        - Do not include the JSON or [INTERNAL_PLAN] in markdown blocks.
        
        User Query: ${prompt}`)
    ];
    let accumulatedResponse = '';
    let jsonBuffer = '';
    let isPlanStarted = false;
    try {
        const chatRequest = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        for await (const fragment of chatRequest.stream) {
            if (fragment instanceof vscode.LanguageModelTextPart) {
                accumulatedResponse += fragment.value;
                // If we detect the plan start, we stop streaming to the user UI
                if (!isPlanStarted && accumulatedResponse.includes('[INTERNAL_PLAN]')) {
                    isPlanStarted = true;
                    // Stream the part before the marker if any was caught in this fragment
                    const parts = fragment.value.split('[INTERNAL_PLAN]');
                    if (parts[0] && stream)
                        stream.markdown(parts[0]);
                }
                else if (!isPlanStarted) {
                    if (stream)
                        stream.markdown(fragment.value);
                }
            }
        }
    }
    catch (err) {
        console.error('[Shisa-Kanko] Error sending request to model:', err);
        reportError('Error communicating with AI model.');
        return;
    }
    // 3. Parse Code Blocks and JSON
    try {
        // Extract the JSON part after the marker
        const planMarker = '[INTERNAL_PLAN]';
        const markerIndex = accumulatedResponse.indexOf(planMarker);
        if (markerIndex === -1) {
            console.log('[Shisa-Kanko] No [INTERNAL_PLAN] marker found in response');
            return;
        }
        const jsonPart = accumulatedResponse.substring(markerIndex + planMarker.length).trim();
        const jsonMatch = jsonPart.match(/\{"targets":.*?\}/s);
        if (!jsonMatch) {
            console.log('[Shisa-Kanko] No valid JSON found after marker');
            return;
        }
        const planData = JSON.parse(jsonMatch[0]);
        // Find Code Blocks for application
        const codeBlockRegex = /```(?:\w+)?\n?([\s\S]*?)```/g;
        let codeBlocks = [];
        let match;
        // Search in the whole response (before the plan)
        while ((match = codeBlockRegex.exec(accumulatedResponse)) !== null) {
            codeBlocks.push(match[1].trim());
        }
        const plan = {
            planId: 'internal-' + Date.now(),
            status: 'suggestion',
            targets: (planData.targets || []).map((t) => ({
                ...t,
                changeType: ['logic_change', 'refactor', 'suggestion'].includes(t.changeType) ? t.changeType : 'suggestion'
            }))
        };
        if (plan.targets.length > 0) {
            const workspaceEdit = new vscode.WorkspaceEdit();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            for (let i = 0; i < plan.targets.length; i++) {
                const target = plan.targets[i];
                let resolvedPath = target.filePath;
                if (!path.isAbsolute(resolvedPath) && workspaceFolders) {
                    const workspaceFolder = workspaceFolders[0];
                    const workspaceName = workspaceFolder.name;
                    if (resolvedPath.startsWith(workspaceName + '/') || resolvedPath.startsWith(workspaceName + '\\')) {
                        resolvedPath = resolvedPath.substring(workspaceName.length + 1);
                    }
                    target.filePath = vscode.Uri.joinPath(workspaceFolder.uri, resolvedPath).fsPath;
                }
                const uri = vscode.Uri.file(target.filePath);
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    if (codeBlocks.length > 0) {
                        const startLine = Math.max(1, Math.min(...target.lines));
                        const endLine = Math.min(doc.lineCount + 1, Math.max(...target.lines));
                        const range = doc.validateRange(new vscode.Range(startLine - 1, 0, endLine, 0));
                        const codeToApply = codeBlocks[Math.min(i, codeBlocks.length - 1)];
                        workspaceEdit.replace(uri, range, codeToApply.endsWith('\n') ? codeToApply : codeToApply + '\n');
                    }
                }
                catch (e) {
                    if (codeBlocks.length > 0 && i === 0) {
                        workspaceEdit.createFile(uri, { ignoreIfExists: true });
                        workspaceEdit.insert(uri, new vscode.Position(0, 0), codeBlocks[0]);
                    }
                }
            }
            const success = await vscode.workspace.applyEdit(workspaceEdit);
            if (success) {
                decorationManager.applyPlan(plan);
                // Report silently or with small text to the user
                if (stream)
                    stream.markdown('\n\n*(Visible highlights applied to editor)*');
            }
        }
    }
    catch (e) {
        console.error('[Shisa-Kanko] Critical failure:', e);
    }
}
function registerChatParticipant(context, decorationManager) {
    const handler = async (post, context, stream, token) => {
        await processInternalAIRequest(post.prompt, decorationManager, stream);
        return { metadata: { command: '' } };
    };
    try {
        const participant = vscode.chat.createChatParticipant('shisa', handler);
        participant.iconPath = vscode.Uri.file('shisa.png');
        context.subscriptions.push(participant);
    }
    catch (e) {
        console.log('[Shisa-Kanko] Chat participant registration skip.');
    }
}
//# sourceMappingURL=chatParticipant.js.map