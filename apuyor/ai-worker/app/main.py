import hmac
import asyncio
import io
from contextlib import asynccontextmanager
from collections.abc import Callable
from typing import Annotated

import soundfile
from PIL import Image, UnidentifiedImageError
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status

from .config import settings
from .inference import InferenceUnavailable, adapter
from .schemas import EmbeddingAccepted, JobAccepted, JobFallback, TransformRequest, VoiceConvertRequest
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
_embedding_slots = asyncio.Semaphore(max(1, settings.max_concurrent_inference_jobs))


def release_embedding_slot(task: asyncio.Task[str]) -> None:
    if not task.cancelled():
        task.exception()
    _embedding_slots.release()


async def extract_embedding(operation: Callable[..., str], data: bytes, *args: object) -> EmbeddingAccepted:
    if _embedding_slots.locked():
        raise HTTPException(status_code=503, detail="Embedding capacity is busy.")
    await _embedding_slots.acquire()
    slot_owned = True
    try:
        task = asyncio.create_task(asyncio.to_thread(operation, data, *args))
        try:
            embedding_id = await asyncio.wait_for(
                asyncio.shield(task),
                timeout=max(1.0, settings.inference_timeout_seconds),
            )
        except asyncio.TimeoutError as error:
            task.add_done_callback(release_embedding_slot)
            slot_owned = False
            raise HTTPException(status_code=504, detail="Embedding extraction exceeded its time limit.") from error
        except InferenceUnavailable as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except Exception as error:
            raise HTTPException(status_code=500, detail="Embedding extraction failed.") from error
        return EmbeddingAccepted(embedding_profile_id=embedding_id)
    finally:
        if slot_owned:
            _embedding_slots.release()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/embeddings/face", response_model=EmbeddingAccepted)
async def face_embedding_endpoint(_: WorkerAuth, file: UploadFile = File(...)) -> EmbeddingAccepted:
    data = await file.read(10 * 1024 * 1024 + 1)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Target face image must be 10 MB or smaller.")
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG"}:
                raise HTTPException(status_code=415, detail="Target face must be a JPEG or PNG image.")
            image.verify()
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=415, detail="Uploaded image is invalid.") from error
    return await extract_embedding(adapter.extract_face_embedding, data)


@app.post("/v1/embeddings/voice", response_model=EmbeddingAccepted)
async def voice_embedding_endpoint(_: WorkerAuth, file: UploadFile = File(...)) -> EmbeddingAccepted:
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Voice sample must be 15 MB or smaller.")
    try:
        audio, sample_rate = soundfile.read(io.BytesIO(data), dtype="float32")
    except (RuntimeError, OSError, ValueError) as error:
        raise HTTPException(status_code=415, detail="Upload a valid WAV or MP3 audio sample.") from error
    duration = len(audio) / sample_rate if sample_rate else 0
    if not 5 <= duration <= 15:
        raise HTTPException(status_code=400, detail="Voice samples must be between 5 and 15 seconds.")
    return await extract_embedding(adapter.extract_speaker_embedding, data, sample_rate)


@app.post("/v1/transform/frame", response_model=JobAccepted | JobFallback)
async def transform_frame_endpoint(request: TransformRequest, _: WorkerAuth) -> JobAccepted | JobFallback:
    return await transform_frame(request)


@app.post("/v1/transform/video", response_model=JobAccepted | JobFallback)
async def transform_video_endpoint(request: TransformRequest, _: WorkerAuth) -> JobAccepted | JobFallback:
    return await transform_video(request)


@app.post("/v1/voice/convert", response_model=JobAccepted | JobFallback)
async def convert_voice_endpoint(request: VoiceConvertRequest, _: WorkerAuth) -> JobAccepted | JobFallback:
    return await convert_voice(request)
