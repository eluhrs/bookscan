"""Tests for signed photo URL generation and verification."""
import time
import pytest
from app.services.photo_urls import generate_signed_photo_url, verify_signed_url


def test_generate_signed_url_structure():
    url = generate_signed_photo_url(
        isbn="9780743273565",
        n=1,
        base_url="https://bookscan.luhrs.net",
        secret="testsecret123",
    )
    assert url.startswith("https://bookscan.luhrs.net/photos/9780743273565_1.jpg?")
    assert "expires=" in url
    assert "token=" in url


def test_generate_signed_url_different_n():
    url = generate_signed_photo_url(
        isbn="9780743273565",
        n=3,
        base_url="https://bookscan.luhrs.net",
        secret="testsecret123",
    )
    assert "/photos/9780743273565_3.jpg?" in url


def test_verify_valid_token():
    secret = "testsecret123"
    url = generate_signed_photo_url(
        isbn="9780743273565", n=1, base_url="https://example.com", secret=secret
    )
    from urllib.parse import urlparse, parse_qs
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    expires = int(params["expires"][0])
    token = params["token"][0]

    assert verify_signed_url(
        filename="9780743273565_1.jpg",
        expires=expires,
        token=token,
        secret=secret,
    )


def test_verify_expired_token():
    secret = "testsecret123"
    import hmac, hashlib
    filename = "9780743273565_1.jpg"
    expires = int(time.time()) - 100  # already expired
    msg = f"{filename}:{expires}"
    token = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()

    assert not verify_signed_url(
        filename=filename, expires=expires, token=token, secret=secret,
    )


def test_verify_wrong_token():
    secret = "testsecret123"
    expires = int(time.time()) + 3600
    assert not verify_signed_url(
        filename="9780743273565_1.jpg",
        expires=expires,
        token="wrong",
        secret=secret,
    )


def test_verify_wrong_filename():
    secret = "testsecret123"
    url = generate_signed_photo_url(
        isbn="9780743273565", n=1, base_url="https://example.com", secret=secret
    )
    from urllib.parse import urlparse, parse_qs
    parsed = urlparse(url)
    params = parse_qs(parsed.query)
    expires = int(params["expires"][0])
    token = params["token"][0]

    assert not verify_signed_url(
        filename="9780743273565_2.jpg",
        expires=expires,
        token=token,
        secret=secret,
    )
