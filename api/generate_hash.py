#!/usr/bin/env python3
"""Generate a bcrypt hash for use in .env PASSWORD_HASH.
Usage: python generate_hash.py <password>
"""
import sys
from passlib.context import CryptContext

if len(sys.argv) != 2:
    print("Usage: python generate_hash.py <password>", file=sys.stderr)
    sys.exit(1)

ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(ctx.hash(sys.argv[1]))
