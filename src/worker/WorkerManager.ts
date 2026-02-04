import makeWASocket, { DisconnectReason, WASocket } from '@whiskeysockets/baileys';
import { useMemoryAuth } from './RemoteAuth.js';
import pino from 'pino';
import axios from 'axios';
import { Boom } from '@hapi/boom';
import QRCode from 'qrcode';

import http from 'http';

const logger = pino({ level: 'info' });

// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5241';
const WORKER_SECRET = process.env.WORKER_SECRET || 'change_this_to_a_secure_random_string';
const PORT = process.env.PORT || 10000;

export class WorkerManager {
    private sessions: Map<string, WASocket> = new Map();

    constructor() { }

    public async connectToWhatsApp(userId: string) {
        if (this.sessions.has(userId)) {
            logger.info(`Session for ${userId} already active.`);
            return;
        }

        logger.info(`Initializing session for ${userId}...`);

        try {
            // 1. Thaw Auth State
            const { state, saveCreds } = await useMemoryAuth(userId);

            // 2. Create Socket
            const sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: ['Olubanise', 'Chrome', '1.0.0'],
                logger: pino({ level: 'silent' })
            });

            // 3. Persist on Creds Update
            sock.ev.on('creds.update', saveCreds);

            // 4. Handle Connection Updates
            sock.ev.on('connection.update', async (update: Partial<any>) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    logger.info(`[${userId}] QR Code received.`);
                    const qrImageUrl = await QRCode.toDataURL(qr);
                    const base64Data = qrImageUrl.replace(/^data:image\/png;base64,/, "");

                    await axios.post(`${ORCHESTRATOR_URL}/api/sessions/${userId}/status`, {
                        status: 'connecting',
                        qr: base64Data
                    }, { headers: { 'X-Worker-Secret': WORKER_SECRET } });
                }

                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
                    logger.warn(`[${userId}] Connection closed. Reconnecting: ${shouldReconnect}`);

                    await axios.post(`${ORCHESTRATOR_URL}/api/sessions/${userId}/status`, {
                        status: shouldReconnect ? 'reconnecting' : 'disconnected'
                    }, { headers: { 'X-Worker-Secret': WORKER_SECRET } });

                    this.sessions.delete(userId);

                    if (shouldReconnect) {
                        this.connectToWhatsApp(userId);
                    }
                } else if (connection === 'open') {
                    logger.info(`[${userId}] Connection opened!`);
                    this.sessions.set(userId, sock);
                    await axios.post(`${ORCHESTRATOR_URL}/api/sessions/${userId}/status`, {
                        status: 'connected'
                    }, { headers: { 'X-Worker-Secret': WORKER_SECRET } });
                }
            });

            // 5. Handle Incoming Messages
            sock.ev.on('messages.upsert', async (m: { messages: any[], type: string }) => {
                const msg = m.messages[0];
                if (!msg.key.fromMe && m.type === 'notify') {
                    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                    if (!text) return;

                    try {
                        const response = await axios.post(`${ORCHESTRATOR_URL}/api/intelligence/chat`, {
                            userId: userId,
                            prompt: text,
                            sourceId: msg.key.remoteJid
                        }, {
                            headers: { 'X-Worker-Secret': WORKER_SECRET }
                        });

                        if (response.data && response.data.response) {
                            await sock.sendMessage(msg.key.remoteJid!, { text: response.data.response });
                        }
                    } catch (err: any) {
                        logger.error(`[${userId}] Proxy Error: ${err.message}`);
                    }
                }
            });
        } catch (err: any) {
            logger.error(`[${userId}] Error: ${err.message}`);
        }
    }
}

// Start the worker and health check server
const manager = new WorkerManager();
const TEST_USER_ID = "00000000-0000-0000-0000-000000000000";

// Tiny server to satisfy Render's port requirement
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Olubanise Worker is running');
}).listen(PORT, () => {
    logger.info(`Health check server listening on port ${PORT}`);
    manager.connectToWhatsApp(TEST_USER_ID);
});
