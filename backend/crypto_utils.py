# backend/crypto_utils.py
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.backends import default_backend
import hashlib
import secrets
import base64

# Standard 2048-bit MODP Group (RFC 3526)
P = int(
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D"
    "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D"
    "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9"
    "DE2BCBF6955817183995497CEA956AE515D2261898FA0510"
    "15728E5A8AACAA68FFFFFFFFFFFFFFFF",
    16
)
G = 2


def generate_dh_keypair():
    """
    Generate DH private and public key pair using raw integer math
    (compatible with frontend JavaScript implementation)
    Returns: (private_key_hex, public_key_hex)
    """
    # Generate random 256-bit private key
    private_key = int.from_bytes(secrets.token_bytes(32), byteorder='big')

    # Compute public key: g^private_key mod p
    public_key = pow(G, private_key, P)

    # Return as hex strings
    private_key_hex = format(private_key, 'x')
    public_key_hex = format(public_key, 'x')

    return private_key_hex, public_key_hex


def compute_shared_secret(private_key_hex, peer_public_key_hex):
    """
    Compute shared secret from our private key and peer's public key
    Both keys are hex strings from the raw DH implementation
    Returns: shared_secret as bytes
    """
    # Convert hex strings to integers
    private_key = int(private_key_hex, 16)
    peer_public_key = int(peer_public_key_hex, 16)

    # Compute shared secret: peer_public_key^private_key mod p
    shared_secret_int = pow(peer_public_key, private_key, P)

    # Convert to bytes (pad to appropriate length)
    shared_secret_hex = format(shared_secret_int, 'x')
    # Ensure even length for bytes conversion
    if len(shared_secret_hex) % 2:
        shared_secret_hex = '0' + shared_secret_hex
    shared_secret_bytes = bytes.fromhex(shared_secret_hex)

    return shared_secret_bytes


def derive_aes_key(shared_secret_bytes, salt=b"woosh-chat-salt"):
    """
    Derive a 256-bit AES key from the shared secret using HMAC (compatible with frontend)
    Frontend uses: HMAC-SHA256(info + chr(1), HMAC-SHA256(shared_secret, salt))
    Returns: base64 encoded AES key
    """
    import hmac

    # Step 1: PRK = HMAC-SHA256(salt, shared_secret)
    prk = hmac.new(salt, shared_secret_bytes, hashlib.sha256).digest()

    # Step 2: OKM = HMAC-SHA256(prk, info || 0x01)
    info = b"aes-session-key" + bytes([1])
    aes_key = hmac.new(prk, info, hashlib.sha256).digest()

    return base64.b64encode(aes_key).decode('utf-8')
