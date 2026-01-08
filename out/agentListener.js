"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentListener = void 0;
const vscode = require("vscode");
const ws_1 = require("ws");
class AgentListener {
    constructor(port = 3000) {
        this.port = port;
        this.wss = null;
        this._onPlanReceived = new vscode.EventEmitter();
        // 외부에서 이 이벤트를 구독하여 하이라이트를 실행할 수 있습니다.
        this.onPlanReceived = this._onPlanReceived.event;
    }
    /**
     * 서버 시작
     */
    start() {
        this.wss = new ws_1.WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => {
            console.log(`[Shisa-Kanko] AI Agent connected on port ${this.port}`);
            ws.on('message', (data) => {
                try {
                    const plan = JSON.parse(data.toString());
                    console.log(`[Shisa-Kanko] Received plan: ${plan.planId}`);
                    // 수신된 데이터를 이벤트를 통해 전파
                    this._onPlanReceived.fire(plan);
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to parse AI plan: ${error}`);
                }
            });
            ws.on('close', () => {
                console.log('[Shisa-Kanko] AI Agent disconnected');
            });
        });
        vscode.window.setStatusBarMessage(`$(radio-tower) Shisa-Kanko: Listening on port ${this.port}`, 5000);
    }
    /**
     * 서버 중지 (익스텐션 비활성화 시 호출)
     */
    dispose() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        this._onPlanReceived.dispose();
    }
}
exports.AgentListener = AgentListener;
//# sourceMappingURL=agentListener.js.map