import asyncio
import logging
from collections.abc import Callable

from .config import settings
from .inference import InferenceUnavailable, adapter
from .schemas import JobAccepted, JobFallback, TransformRequest, VoiceConvertRequest

logger = logging.getLogger("apuyor.ai_worker")
_inference_slots = asyncio.Semaphore(max(1, settings.max_concurrent_inference_jobs))


async def run_job(
    job_id: str,
    operation: Callable[..., object],
    request: TransformRequest | VoiceConvertRequest,
) -> JobAccepted | JobFallback:
    if _inference_slots.locked():
        return JobFallback(job_id=job_id, fallback_code="WORKER_BUSY", detail="Inference capacity is busy.")
    await _inference_slots.acquire()
    slot_owned = True
    try:
        inference_task = asyncio.create_task(asyncio.to_thread(operation, request))
        try:
            result = await asyncio.wait_for(
                asyncio.shield(inference_task), timeout=max(1.0, settings.inference_timeout_seconds)
            )
        except asyncio.TimeoutError:
            # Threads running GPU kernels cannot be safely killed. Hold the slot
            # until the timed-out operation really exits so retries cannot pile up.
            inference_task.add_done_callback(lambda _task: _inference_slots.release())
            slot_owned = False
            raise
        if not result.safety_label_applied:
            logger.error("Inference returned unlabeled output for job %s", job_id)
            return JobFallback(job_id=job_id, fallback_code="INFERENCE_FAILED", detail="Safety label could not be confirmed.")
        return JobAccepted(job_id=job_id, result_media_id=result.result_media_id)
    except asyncio.TimeoutError:
        logger.warning("Inference timed out for job %s", job_id)
        return JobFallback(job_id=job_id, fallback_code="INFERENCE_TIMEOUT", detail="Inference exceeded its time limit.")
    except InferenceUnavailable:
        logger.exception("Inference backend unavailable for job %s", job_id)
        return JobFallback(job_id=job_id, fallback_code="INFERENCE_UNAVAILABLE", detail="Inference backend is unavailable.")
    except Exception:
        logger.exception("Inference failed for job %s", job_id)
        return JobFallback(job_id=job_id, fallback_code="INFERENCE_FAILED", detail="Inference failed safely.")
    finally:
        if slot_owned:
            _inference_slots.release()


async def transform_frame(request: TransformRequest) -> JobAccepted | JobFallback:
    return await run_job(request.job_id, adapter.transform_frame, request)


async def transform_video(request: TransformRequest) -> JobAccepted | JobFallback:
    return await run_job(request.job_id, adapter.transform_video, request)


async def convert_voice(request: VoiceConvertRequest) -> JobAccepted | JobFallback:
    return await run_job(request.job_id, adapter.convert_voice, request)
