import makeWASocket, { DisconnectReason, WASocket } from '@whiskeysockets/baileys';
import { useMemoryAuth } from './RemoteAuth.js';
import pino from 'pino';
import axios from 'axios';
import { Boom } from '@hapi/boom';

const logger = pino({ level: 'info' });

// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5241';
const WORKER_SECRET = process.env.WORKER_SECRET || 'change_this_to_a_secure_random_string';

export class WorkerManager {
    private sessions: Map<string, WASocket> = new Map();

    constructor() { }

    public async connectToWhatsApp(userId: string) {
        if (this.sessions.has(userId)) {
            logger.info(`Session for ${userId} already active.`);
            return;
        }

        logger.info(`Initializing session for ${userId}...`);

        // 1. Thaw Auth State
        const { state, saveCreds } = await useMemoryAuth(userId);

        // 2. Create Socket
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true, // For Phase 3 demo
            browser: ['Olubanise', 'Chrome', '1.0.0'],
            logger: pino({ level: 'silent' }) // Reduce noise
        });

        // 3. Persist on Creds Update
        sock.ev.on('creds.update', saveCreds);

        // 4. Handle Connection Updates
        sock.ev.on('connection.update', (update: Partial<any>) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                logger.info(`[${userId}] QR Code received. Scan to login.`);
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                logger.warn(`[${userId}] Connection closed. Reconnecting: ${shouldReconnect}`);

                // Clean up map
                this.sessions.delete(userId);

                if (shouldReconnect) {
                    this.connectToWhatsApp(userId);
                }
            } else if (connection === 'open') {
                logger.info(`[${userId}] Connection opened!`);
                this.sessions.set(userId, sock);
            }
        });

        // 5. Handle Incoming Messages
        sock.ev.on('messages.upsert', async (m: { messages: any[], type: string }) => {
            const msg = m.messages[0];
            if (!msg.key.fromMe && m.type === 'notify') {
                logger.info(`[${userId}] Message received from ${msg.key.remoteJid}`);

                const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (!text) return;

                try {
                    // Forward to .NET Orchestrator
                    const response = await axios.post(`${ORCHESTRATOR_URL}/api/intelligence/chat`, {
                        userId: userId,
                        prompt: text
                    }, {
                        headers: { 'X-Worker-Secret': WORKER_SECRET }
                    });

                    if (response.data && response.data.response) {
                        const reply = response.data.response;
                        // Send Reply
                        await sock.sendMessage(msg.key.remoteJid!, { text: reply });
                        logger.info(`[${userId}] Reply sent.`);
                    }
                } catch (err: any) {
                    logger.error(`[${userId}] Intelligence Proxy Error: ${err.message}`);
                    await sock.sendMessage(msg.key.remoteJid!, { text: "⚠️ Olubanise is experiencing high traffic. Please try again." });
                }
            }
        });
    }
}

// Entry point for standalone testing (ESM compatible)
// if (import.meta.url === `file://${process.argv[1]}`) {
//     const manager = new WorkerManager();
//     // Test with a dummy UUID
//     const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";
//     manager.connectToWhatsApp(TEST_USER_ID);
// }
