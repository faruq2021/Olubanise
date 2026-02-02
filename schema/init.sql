-- Olubanise DB Schema

-- Users table
CREATE TABLE IF NOT EXISTS Users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table (Decimal 18,4 for precision)
CREATE TABLE IF NOT EXISTS Wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    balance DECIMAL(18, 4) DEFAULT 0.0000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- WhatsAppSessions table
CREATE TABLE IF NOT EXISTS WhatsAppSessions (
    user_id UUID PRIMARY KEY REFERENCES Users(id) ON DELETE CASCADE,
    session_blob TEXT, -- The serialized/encrypted authentication data
    encryption_iv VARCHAR(255), -- To ensure AES-256 encryption is unique per user
    status VARCHAR(50) DEFAULT 'disconnected', -- disconnected, connecting, connected, error
    system_prompt TEXT DEFAULT 'You are Olubanise, a helpful AI personal assistant. Be concise and professional.',
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TransactionLogs table
CREATE TABLE IF NOT EXISTS TransactionLogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES Users(id),
    wallet_id UUID NOT NULL REFERENCES Wallets(id),
    amount DECIMAL(18, 4) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL, -- CREDIT, DEBIT
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON Users(email);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON Wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON WhatsAppSessions(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_user_id ON TransactionLogs(user_id);
