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
exports.AgentListener = void 0;
const vscode = __importStar(require("vscode"));
const ws_1 = require("ws");
class AgentListener {
    constructor(port = 3000, secretStorage) {
        this.port = port;
        this.secretStorage = secretStorage;
        this.wss = null;
        this._onPlanReceived = new vscode.EventEmitter();
        // 외부에서 이 이벤트를 구독하여 하이라이트를 실행할 수 있습니다.
        this.onPlanReceived = this._onPlanReceived.event;
    }
    /**
     * 서버 시작
     */
    async start() {
        // Initialize token
        this.token = await this.getOrCreateToken();
        this.startServer();
    }
    startServer() {
        if (this.wss) {
            this.dispose();
        }
        this.wss = new ws_1.WebSocketServer({
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
        this.wss.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                vscode.window.showErrorMessage(`[Shisa-Kanko] Port ${this.port} is already in use. Please configure a different port in settings.`);
            }
            else {
                vscode.window.showErrorMessage(`[Shisa-Kanko] WebSocket Server Error: ${error.message}`);
            }
        });
        vscode.window.setStatusBarMessage(`$(radio-tower) Shisa-Kanko: Listening on port ${this.port}`, 5000);
    }
    /**
     * Restart server on a new port
     */
    async restart(newPort) {
        this.port = newPort;
        if (this.wss) {
            this.wss.close(() => {
                this.startServer();
            });
        }
        else {
            this.startServer();
        }
    }
    /**
     * Get or create a secure token
     */
    async getOrCreateToken() {
        let token = await this.secretStorage.get('shisa-kanko.token');
        if (!token) {
            token = this.generateToken();
            await this.secretStorage.store('shisa-kanko.token', token);
        }
        return token;
    }
    generateToken() {
        return require('crypto').randomBytes(16).toString('hex');
    }
    async getToken() {
        const token = await this.getOrCreateToken();
        if (!this.token)
            this.token = token; // Ensure local cache is in sync
        return token;
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