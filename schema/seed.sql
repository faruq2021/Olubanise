-- Seed a test user and wallet for Olubanise
-- User ID: 00000000-0000-0000-0000-000000000000
-- Balance: 1000.0000

INSERT INTO Users (id, email, password_hash)
VALUES ('00000000-0000-0000-0000-000000000000', 'test@olubanise.com', 'hashed_password_here')
ON CONFLICT (id) DO NOTHING;

INSERT INTO Wallets (user_id, balance)
VALUES ('00000000-0000-0000-0000-000000000000', 1000.0000)
ON CONFLICT (user_id) DO NOTHING;
