using System.Security.Cryptography;
using System.Text;

namespace Olubanise.Orchestrator.Services;

public interface IEncryptionService
{
    (string EncryptedData, string IV) Encrypt(string plainText, string key);
    string Decrypt(string cipherText, string key, string iv);
}

public class EncryptionService : IEncryptionService
{
    public (string EncryptedData, string IV) Encrypt(string plainText, string key)
    {
        using Aes aes = Aes.Create();
        aes.Key = DeriveKey(key);
        aes.GenerateIV();
        
        byte[] iv = aes.IV;
        ICryptoTransform encryptor = aes.CreateEncryptor(aes.Key, iv);

        using MemoryStream ms = new();
        using (CryptoStream cs = new(ms, encryptor, CryptoStreamMode.Write))
        {
            using (StreamWriter sw = new(cs))
            {
                sw.Write(plainText);
            }
        }

        return (Convert.ToBase64String(ms.ToArray()), Convert.ToBase64String(iv));
    }

    public string Decrypt(string cipherText, string key, string iv)
    {
        using Aes aes = Aes.Create();
        aes.Key = DeriveKey(key);
        aes.IV = Convert.FromBase64String(iv);

        ICryptoTransform decryptor = aes.CreateDecryptor(aes.Key, aes.IV);

        using MemoryStream ms = new(Convert.FromBase64String(cipherText));
        using CryptoStream cs = new(ms, decryptor, CryptoStreamMode.Read);
        using StreamReader sr = new(cs);
        return sr.ReadToEnd();
    }

    private static byte[] DeriveKey(string key)
    {
        // For production, use a proper KDF like PBKDF2
        // For now, ensuring it's 32 bytes for AES-256
        using var sha256 = SHA256.Create();
        return sha256.ComputeHash(Encoding.UTF8.GetBytes(key));
    }
}
