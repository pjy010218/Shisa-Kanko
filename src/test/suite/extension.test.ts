import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Shisa-Kanko Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('shisa-kanko.shisa-kanko'));
    });

    test('Should activate and start WebSocket server', async () => {
        const ext = vscode.extensions.getExtension('shisa-kanko.shisa-kanko');
        await ext?.activate();
        assert.strictEqual(ext?.isActive, true);
    });
});