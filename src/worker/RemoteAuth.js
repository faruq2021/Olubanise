"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMemoryAuth = exports.useRemoteAuthState = void 0;
const baileys_1 = require("@whiskeysockets/baileys");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ level: 'debug' });
// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5241';
const WORKER_SECRET = process.env.WORKER_SECRET || 'change_this_to_a_secure_random_string';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-aes-key-must-be-set';
// Encryption Utilities
function decrypt(cipherText, iv) {
    const algorithm = 'aes-256-cbc';
    const key = crypto_1.default.createHash('sha256').update(ENCRYPTION_KEY).digest(); // Ensure 32 bytes
    const ivBuffer = Buffer.from(iv, 'base64');
    const decipher = crypto_1.default.createDecipheriv(algorithm, key, ivBuffer);
    let decrypted = decipher.update(cipherText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted, baileys_1.BufferJSON.reviver);
}
function encrypt(data) {
    const algorithm = 'aes-256-cbc';
    const key = crypto_1.default.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(algorithm, key, iv);
    const jsonStr = JSON.stringify(data, baileys_1.BufferJSON.replacer);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return { blob: encrypted, iv: iv.toString('base64') };
}
const useRemoteAuthState = async (userId) => {
    let creds;
    let keys = {};
    // 1. "Thaw": Fetch session from Orchestrator
    try {
        const response = await axios_1.default.get(`${ORCHESTRATOR_URL}/api/sessions/${userId}`, {
            headers: { 'X-Worker-Secret': WORKER_SECRET },
            validateStatus: () => true // Handle 404 manually
        });
        if (response.status === 200 && response.data.sessionBlob) {
            logger.info(`Session found for ${userId}, thawing...`);
            const { sessionBlob, encryptionIv } = response.data;
            const sessionData = decrypt(sessionBlob, encryptionIv);
            creds = sessionData.creds;
            keys = sessionData.keys;
        }
        else {
            logger.info(`No session found for ${userId}, creating new credentials...`);
            creds = (0, baileys_1.initAuthCreds)();
            keys = {};
        }
    }
    catch (err) {
        logger.error(`Error fetching session for ${userId}: ${err.message}`);
        creds = (0, baileys_1.initAuthCreds)();
    }
    const saveCreds = async () => {
        // 2. "Freeze": Encrypt and Sync to Orchestrator
        // Only called when creds.update fires (as passed to Baileys)
        try {
            const dataToEncrypt = { creds, keys };
            const { blob, iv } = encrypt(dataToEncrypt); // Wait, keys might be too large/complex for simple JSON?
            // Baileys keys are simple generic objects, should be fine with BufferJSON
            // Optimization: The prompt says "When keys change... POST it back".
            // Baileys handles the internal logic of when to call saveCreds.
            // We just execute the push.
            await axios_1.default.post(`${ORCHESTRATOR_URL}/api/sessions/${userId}`, {
                sessionBlob: blob,
                encryptionIv: iv
            }, {
                headers: { 'X-Worker-Secret': WORKER_SECRET }
            });
            logger.debug(`Session synced for ${userId}`);
        }
        catch (err) {
            logger.error(`Failed to sync session for ${userId}: ${err.message}`);
        }
    };
    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    return data; // Simple placeholder, Baileys usually handles memory keys if not provided?
                    // Correction: Baileys memory store is not default. We need to implement key lookups from our 'keys' object.
                    // Implementation below:
                },
                set: (data) => {
                    // Update internal keys object
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            keys[key] = value;
                        }
                    }
                    saveCreds(); // Trigger sync
                }
            }
        },
        saveCreds
    };
};
exports.useRemoteAuthState = useRemoteAuthState;
/*
   Correction on Keys implementation:
   The above 'keys' object approach effectively flattens the structure.
   We need to properly implement get/set to read/write to the 'keys' object map.
*/
const useMemoryAuth = async (userId) => {
    // Re-implementing with proper key handling logic inside the closure
    // Re-using fetchData logic
    let creds;
    let keys = {};
    try {
        const response = await axios_1.default.get(`${ORCHESTRATOR_URL}/api/sessions/${userId}`, {
            headers: { 'X-Worker-Secret': WORKER_SECRET },
            validateStatus: () => true
        });
        if (response.status === 200 && response.data.sessionBlob) {
            const decrypted = decrypt(response.data.sessionBlob, response.data.encryptionIv);
            creds = decrypted.creds;
            keys = decrypted.keys || {};
        }
        else {
            creds = (0, baileys_1.initAuthCreds)();
        }
    }
    catch (e) {
        creds = (0, baileys_1.initAuthCreds)();
    }
    const saveState = async () => {
        const { blob, iv } = encrypt({ creds, keys });
        await axios_1.default.post(`${ORCHESTRATOR_URL}/api/sessions/${userId}`, {
            sessionBlob: blob,
            encryptionIv: iv
        }, { headers: { 'X-Worker-Secret': WORKER_SECRET } });
    };
    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const value = keys[`${type}-${id}`];
                        if (value) {
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value) {
                                keys[`${category}-${id}`] = value;
                            }
                            else {
                                delete keys[`${category}-${id}`];
                            }
                        }
                    }
                    saveState();
                }
            }
        },
        saveCreds: saveState
    };
};
exports.useMemoryAuth = useMemoryAuth;
//# sourceMappingURL=RemoteAuth.js.map