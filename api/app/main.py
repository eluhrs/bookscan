from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="BookScan API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.auth import router as auth_router
from app.routers.books import router as books_router

app.include_router(auth_router, prefix="/api")
app.include_router(books_router, prefix="/api")

# Routers registered as they are implemented:
# from app.routers.listings import router as listings_router
# app.include_router(listings_router, prefix="/api")
