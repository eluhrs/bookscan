from datetime import datetime, timedelta, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import bcrypt
from jose import JWTError, jwt
from app.config import settings
from app.schemas import Token

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode({"sub": username, "exp": expire}, settings.secret_key, algorithm="HS256")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> str:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_refresh_token_if_eligible(token: str) -> str | None:
    """Return a fresh token if the current one is valid and has > 1 hour remaining."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        remaining = (exp - datetime.now(timezone.utc)).total_seconds()
        if remaining > 3600:
            return create_access_token(payload["sub"])
    except JWTError:
        pass
    return None


@router.post("/login", response_model=Token)
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    if form_data.username != settings.app_username:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if not bcrypt.checkpw(form_data.password.encode(), settings.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    return Token(access_token=create_access_token(form_data.username), token_type="bearer")


@router.get("/me")
async def me(user: Annotated[str, Depends(get_current_user)]):
    return {"username": user}
