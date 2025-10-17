// src/utils/crypto.js
import CryptoJS from "crypto-js";

// Standard 2048-bit MODP Group 14 (RFC 3526) - same as backend
const P_HEX =
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1" +
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD" +
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245" +
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED" +
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D" +
    "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F" +
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D" +
    "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B" +
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9" +
    "DE2BCBF6955817183995497CEA956AE515D2261898FA0510" +
    "15728E5A8AACAA68FFFFFFFFFFFFFFFF";

const G = 2;

/**
 * Generate Diffie-Hellman keypair
 * Returns: { privateKey: string, publicKey: string }
 */
export function generateDHKeypair() {
    const p = BigInt("0x" + P_HEX);
    const g = BigInt(G);

    // Generate random private key (256 bits for security)
    const privateKeyBytes = CryptoJS.lib.WordArray.random(32);
    const privateKeyHex = privateKeyBytes.toString(CryptoJS.enc.Hex);
    const privateKey = BigInt("0x" + privateKeyHex);

    // Compute public key: g^privateKey mod p
    const publicKey = modPow(g, privateKey, p);

    return {
        privateKey: privateKey.toString(16),
        publicKey: publicKey.toString(16),
    };
}

/**
 * Compute shared secret from private key and peer's public key
 */
export function computeSharedSecret(privateKeyHex, peerPublicKeyHex) {
    const p = BigInt("0x" + P_HEX);
    const privateKey = BigInt("0x" + privateKeyHex);
    const peerPublicKey = BigInt("0x" + peerPublicKeyHex);

    // Compute shared secret: peerPublicKey^privateKey mod p
    const sharedSecret = modPow(peerPublicKey, privateKey, p);

    return sharedSecret.toString(16);
}

/**
 * Derive AES key from shared secret using HKDF-like approach
 */
export function deriveAESKey(sharedSecretHex) {
    const salt = "woosh-chat-salt";
    const info = "aes-session-key";

    // Convert shared secret to WordArray
    const sharedSecretWords = CryptoJS.enc.Hex.parse(sharedSecretHex);

    // Simple HKDF simulation using HMAC-SHA256
    const prk = CryptoJS.HmacSHA256(sharedSecretWords, salt);
    const aesKey = CryptoJS.HmacSHA256(info + String.fromCharCode(1), prk);

    return aesKey.toString(CryptoJS.enc.Base64);
}

/**
 * Modular exponentiation: (base^exponent) mod modulus
 */
function modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

    let result = 1n;
    base = base % modulus;

    while (exponent > 0n) {
        if (exponent % 2n === 1n) {
            result = (result * base) % modulus;
        }
        exponent = exponent >> 1n;
        base = (base * base) % modulus;
    }

    return result;
}

/**
 * Encrypt message using AES-256
 */
export function encryptMessage(message, aesKeyBase64) {
    const key = CryptoJS.enc.Base64.parse(aesKeyBase64);
    const encrypted = CryptoJS.AES.encrypt(message, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
}

/**
 * Decrypt message using AES-256
 */
export function decryptMessage(encryptedMessage, aesKeyBase64) {
    const key = CryptoJS.enc.Base64.parse(aesKeyBase64);
    const decrypted = CryptoJS.AES.decrypt(encryptedMessage, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
}
