import { AuthenticationState, BufferJSON, initAuthCreds, proto, SignalDataTypeMap } from '@whiskeysockets/baileys';
import axios from 'axios';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ level: 'debug' });

// Configuration
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:5241';
const WORKER_SECRET = process.env.WORKER_SECRET || 'change_this_to_a_secure_random_string';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-aes-key-must-be-set';

// Encryption Utilities
function decrypt(cipherText: string, iv: string): any {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest(); // Ensure 32 bytes
    const ivBuffer = Buffer.from(iv, 'base64');
    const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
    let decrypted = decipher.update(cipherText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted, BufferJSON.reviver);
}

function encrypt(data: any): { blob: string; iv: string } {
    const algorithm = 'aes-256-cbc';
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const jsonStr = JSON.stringify(data, BufferJSON.replacer);
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return { blob: encrypted, iv: iv.toString('base64') };
}



/*
   Correction on Keys implementation:
   The above 'keys' object approach effectively flattens the structure.
   We need to properly implement get/set to read/write to the 'keys' object map.
*/

export const useMemoryAuth = async (userId: string) => {
    // Re-implementing with proper key handling logic inside the closure
    // Re-using fetchData logic
    let creds: any;
    let keys: Record<string, any> = {};

    try {
        const response = await axios.get(`${ORCHESTRATOR_URL}/api/sessions/${userId}`, {
            headers: { 'X-Worker-Secret': WORKER_SECRET },
            validateStatus: () => true
        });

        if (response.status === 200 && response.data.sessionBlob) {
            const decrypted = decrypt(response.data.sessionBlob, response.data.encryptionIv);
            creds = decrypted.creds;
            keys = decrypted.keys || {};
        } else {
            creds = initAuthCreds();
        }
    } catch (e) {
        creds = initAuthCreds();
    }

    const saveState = async () => {
        const { blob, iv } = encrypt({ creds, keys });
        await axios.post(`${ORCHESTRATOR_URL}/api/sessions/${userId}`, {
            sessionBlob: blob,
            encryptionIv: iv
        }, { headers: { 'X-Worker-Secret': WORKER_SECRET } });
    };

    return {
        state: {
            creds,
            keys: {
                get: (type: string, ids: string[]) => {
                    const data: any = {};
                    for (const id of ids) {
                        const value = keys[`${type}-${id}`];
                        if (value) {
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: (data: any) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value) {
                                keys[`${category}-${id}`] = value;
                            } else {
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
}
