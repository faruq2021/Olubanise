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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkerManager = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const RemoteAuth_1 = require("./RemoteAuth");
const pino_1 = __importDefault(require("pino"));
const axios_1 = __importDefault(require("axios"));
const boom_1 = require("@hapi/boom");
const logger = (0, pino_1.default)({ level: 'info' });
// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5241';
const WORKER_SECRET = process.env.WORKER_SECRET || 'change_this_to_a_secure_random_string';
class WorkerManager {
    sessions = new Map();
    constructor() { }
    async connectToWhatsApp(userId) {
        if (this.sessions.has(userId)) {
            logger.info(`Session for ${userId} already active.`);
            return;
        }
        logger.info(`Initializing session for ${userId}...`);
        // 1. Thaw Auth State
        const { state, saveCreds } = await (0, RemoteAuth_1.useMemoryAuth)(userId);
        // 2. Create Socket
        const sock = (0, baileys_1.default)({
            auth: state,
            printQRInTerminal: true, // For Phase 3 demo
            browser: ['Olubanise', 'Chrome', '1.0.0'],
            logger: (0, pino_1.default)({ level: 'silent' }) // Reduce noise
        });
        // 3. Persist on Creds Update
        sock.ev.on('creds.update', saveCreds);
        // 4. Handle Connection Updates
        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                logger.info(`[${userId}] QR Code received. Scan to login.`);
            }
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
                logger.warn(`[${userId}] Connection closed. Reconnecting: ${shouldReconnect}`);
                // Clean up map
                this.sessions.delete(userId);
                if (shouldReconnect) {
                    this.connectToWhatsApp(userId);
                }
            }
            else if (connection === 'open') {
                logger.info(`[${userId}] Connection opened!`);
                this.sessions.set(userId, sock);
            }
        });
        // 5. Handle Incoming Messages
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.key.fromMe && m.type === 'notify') {
                logger.info(`[${userId}] Message received from ${msg.key.remoteJid}`);
                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (!text)
                    return;
                try {
                    // Forward to .NET Orchestrator
                    const response = await axios_1.default.post(`${ORCHESTRATOR_URL}/api/intelligence/chat`, {
                        userId: userId,
                        prompt: text
                    }, {
                        headers: { 'X-Worker-Secret': WORKER_SECRET }
                    });
                    if (response.data && response.data.response) {
                        const reply = response.data.response;
                        // Send Reply
                        await sock.sendMessage(msg.key.remoteJid, { text: reply });
                        logger.info(`[${userId}] Reply sent.`);
                    }
                }
                catch (err) {
                    logger.error(`[${userId}] Intelligence Proxy Error: ${err.message}`);
                    await sock.sendMessage(msg.key.remoteJid, { text: "⚠️ Olubanise is experiencing high traffic. Please try again." });
                }
            }
        });
    }
}
exports.WorkerManager = WorkerManager;
// Entry point for standalone testing
if (require.main === module) {
    const manager = new WorkerManager();
    // Test with a dummy UUID
    const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
    manager.connectToWhatsApp(TEST_USER_ID);
}
//# sourceMappingURL=WorkerManager.js.map