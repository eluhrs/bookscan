"""HMAC-signed photo URL generation and verification."""
import hmac
import hashlib
import time


EXPIRY_SECONDS = 48 * 60 * 60  # 48 hours


def generate_signed_photo_url(
    isbn: str,
    n: int,
    base_url: str,
    secret: str,
) -> str:
    """Generate a time-limited signed URL for a photo."""
    filename = f"{isbn}_{n}.jpg"
    expires = int(time.time()) + EXPIRY_SECONDS
    msg = f"{filename}:{expires}"
    token = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return f"{base_url}/photos/{filename}?expires={expires}&token={token}"


def verify_signed_url(
    filename: str,
    expires: int,
    token: str,
    secret: str,
) -> bool:
    """Verify a signed photo URL token. Returns True if valid and not expired."""
    if expires < int(time.time()):
        return False
    msg = f"{filename}:{expires}"
    expected = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(token, expected)
