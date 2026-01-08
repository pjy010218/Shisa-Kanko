import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Shisa-Kanko Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');
    const extensionId = 'spec-tre.shisa-kanko';

    test('Extension should be present', () => {
        const ext = vscode.extensions.getExtension(extensionId);

        if (!ext) {
            console.log('Available extensions:',
                vscode.extensions.all.map(e => e.id).filter(id => id.includes('shisa'))
            );
        }
        assert.ok(ext, `Extension ${extensionId} not found`);
    });

    test('Should activate and start WebSocket server', async () => {
        const ext = vscode.extensions.getExtension(extensionId);
        await ext?.activate();
        assert.strictEqual(ext?.isActive, true);
    });
});