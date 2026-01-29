import { AuthenticationState } from '@whiskeysockets/baileys';
export declare const useRemoteAuthState: (userId: string) => Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
}>;
export declare const useMemoryAuth: (userId: string) => Promise<{
    state: {
        creds: any;
        keys: {
            get: (type: string, ids: string[]) => any;
            set: (data: any) => void;
        };
    };
    saveCreds: () => Promise<void>;
}>;
//# sourceMappingURL=RemoteAuth.d.ts.map