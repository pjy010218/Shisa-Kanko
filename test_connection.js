const WebSocket = require('ws');

const PORT = 3000;
const WS_URL = `ws://localhost:${PORT}`;

// 1. Test connection WITHOUT header (Should fail)
function testNoHeader() {
    console.log('[Test 1] Connecting without header...');
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        console.error('❌ [Test 1] FAILED: Connected without token!');
        ws.close();
    });

    ws.on('error', (err) => {
        // Expected behavior might be a 401/403 or immediate close depending on implementation
        console.log('✅ [Test 1] PASSED: Connection rejected as expected.');
    });
}

// 2. Test connection WITH INVALID header (Should fail)
function testInvalidToken() {
    console.log('[Test 2] Connecting with INVALID token...');
    const ws = new WebSocket(WS_URL, {
        headers: { 'x-shisa-token': 'INVALID_TOKEN' }
    });

    ws.on('open', () => {
        console.error('❌ [Test 2] FAILED: Connected with invalid token!');
        ws.close();
    });

    ws.on('error', (err) => {
        console.log('✅ [Test 2] PASSED: Connection rejected as expected.');
    });
}

// 3. User Instruction
console.log('--- Shisa-Kanko Security Verification Script ---');
console.log('Ensure the extension is running in VS Code with "F5".');
console.log('To test a VALID connection, you must manually edit this script with the token retrieved from VS Code.');
console.log('------------------------------------------------');

testNoHeader();
setTimeout(testInvalidToken, 2000);
