#!/usr/bin/env python3
"""Generate a bcrypt hash for use in .env PASSWORD_HASH.
Usage: python generate_hash.py <password>
"""
import sys
import bcrypt

if len(sys.argv) != 2:
    print("Usage: python generate_hash.py <password>", file=sys.stderr)
    sys.exit(1)

hash = bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt()).decode()
print(hash.replace('$', '$$'))
