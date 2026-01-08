import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { AgentModificationPlan } from './types';

export class AgentListener implements vscode.Disposable {
    private wss: WebSocketServer | null = null;
    private _onPlanReceived = new vscode.EventEmitter<AgentModificationPlan>();
    private token: string | undefined;

    // 외부에서 이 이벤트를 구독하여 하이라이트를 실행할 수 있습니다.
    public readonly onPlanReceived = this._onPlanReceived.event;

    constructor(
        private port: number = 3000,
        private secretStorage: vscode.SecretStorage
    ) { }

    /**
     * 서버 시작
     */
    public async start() {
        // Initialize token
        this.token = await this.getOrCreateToken();

        this.startServer();
    }

    private startServer() {
        if (this.wss) {
            this.dispose();
        }

        this.wss = new WebSocketServer({
            port: this.port,
            verifyClient: (info, cb) => {
                const incomingToken = info.req.headers['x-shisa-token'];
                if (!this.token) {
                    // Start sequence not complete or no token available
                    cb(false, 503, 'Service Unavailable');
                    return;
                }
                if (incomingToken !== this.token) {
                    cb(false, 401, 'Unauthorized: Invalid or missing x-shisa-token');
                    return;
                }
                cb(true);
            }
        });

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

        this.wss.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
                vscode.window.showErrorMessage(`[Shisa-Kanko] Port ${this.port} is already in use. Please configure a different port in settings.`);
            } else {
                vscode.window.showErrorMessage(`[Shisa-Kanko] WebSocket Server Error: ${error.message}`);
            }
        });

        vscode.window.setStatusBarMessage(`$(radio-tower) Shisa-Kanko: Listening on port ${this.port}`, 5000);
    }

    /**
     * Restart server on a new port
     */
    public async restart(newPort: number) {
        this.port = newPort;
        if (this.wss) {
            this.wss.close(() => {
                this.startServer();
            });
        } else {
            this.startServer();
        }
    }

    /**
     * Get or create a secure token
     */
    private async getOrCreateToken(): Promise<string> {
        let token = await this.secretStorage.get('shisa-kanko.token');
        if (!token) {
            token = this.generateToken();
            await this.secretStorage.store('shisa-kanko.token', token);
        }
        return token;
    }

    private generateToken(): string {
        return require('crypto').randomBytes(16).toString('hex');
    }

    public async getToken(): Promise<string> {
        const token = await this.getOrCreateToken();
        if (!this.token) this.token = token; // Ensure local cache is in sync
        return token;
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