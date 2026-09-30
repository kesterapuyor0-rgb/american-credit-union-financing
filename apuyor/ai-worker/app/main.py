import hmac
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status

from .config import settings
from .schemas import JobAccepted, JobFallback, TransformRequest, VoiceConvertRequest
from .service import convert_voice, transform_frame, transform_video


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not settings.ai_worker_api_key or len(settings.ai_worker_api_key) < 32:
        raise RuntimeError("AI_WORKER_API_KEY must be set to at least 32 characters.")
    yield


app = FastAPI(title="Apuyor Engine AI Worker", version="1.0.0", lifespan=lifespan)


async def require_worker_key(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = settings.ai_worker_api_key
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not expected or not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Worker authentication required.")


WorkerAuth = Annotated[None, Depends(require_worker_key)]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/transform/frame", response_model=JobAccepted | JobFallback)
async def transform_frame_endpoint(request: TransformRequest, _: WorkerAuth) -> JobAccepted | JobFallback:
    return await transform_frame(request)


@app.post("/v1/transform/video", response_model=JobAccepted | JobFallback)
async def transform_video_endpoint(request: TransformRequest, _: WorkerAuth) -> JobAccepted | JobFallback:
    return await transform_video(request)


@app.post("/v1/voice/convert", response_model=JobAccepted | JobFallback)
async def convert_voice_endpoint(request: VoiceConvertRequest, _: WorkerAuth) -> JobAccepted | JobFallback:
    return await convert_voice(request)
