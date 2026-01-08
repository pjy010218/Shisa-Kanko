import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { AgentModificationPlan } from './types';

export class AgentListener implements vscode.Disposable {
    private wss: WebSocketServer | null = null;
    private _onPlanReceived = new vscode.EventEmitter<AgentModificationPlan>();

    // 외부에서 이 이벤트를 구독하여 하이라이트를 실행할 수 있습니다.
    public readonly onPlanReceived = this._onPlanReceived.event;

    constructor(private port: number = 3000) { }

    /**
     * 서버 시작
     */
    public start() {
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('connection', (ws: WebSocket) => {
            console.log(`[Shisa-Kanko] AI Agent connected on port ${this.port}`);

            ws.on('message', (data: string) => {
                try {
                    const plan: AgentModificationPlan = JSON.parse(data.toString());
                    console.log(`[Shisa-Kanko] Received plan: ${plan.planId}`);

                    // 수신된 데이터를 이벤트를 통해 전파
                    this._onPlanReceived.fire(plan);
                } catch (error) {
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
    public dispose() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
        this._onPlanReceived.dispose();
    }
}