from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="BookScan API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class TokenRefreshMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer ") and response.status_code < 400:
            from app.auth import get_refresh_token_if_eligible
            token = auth[7:]
            refresh = get_refresh_token_if_eligible(token)
            if refresh:
                response.headers["X-Refresh-Token"] = refresh
        return response


app.add_middleware(TokenRefreshMiddleware)

from app.auth import router as auth_router
from app.routers.books import router as books_router
from app.routers.listings import router as listings_router
from app.routers.photos import router as photos_router
from app.routers.exports import router as exports_router

app.include_router(auth_router, prefix="/api")
app.include_router(books_router, prefix="/api")
app.include_router(listings_router, prefix="/api")
app.include_router(photos_router, prefix="/api")
app.include_router(exports_router, prefix="/api")
