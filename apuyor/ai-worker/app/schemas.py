from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

MediaId = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,128}$")]


class TransformRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: MediaId
    source_media_id: MediaId
    target_profile_id: MediaId
    consent_reference: MediaId
    # The API gateway must verify consent before forwarding this request.
    forced_label_state: bool = False


class VoiceConvertRequest(TransformRequest):
    voice_profile_id: MediaId


class JobAccepted(BaseModel):
    job_id: str
    status: Literal["completed"]
    result_media_id: str
    safety_label_applied: Literal[True] = True


class JobFallback(BaseModel):
    job_id: str
    status: Literal["fallback"] = "fallback"
    fallback_code: Literal["INFERENCE_TIMEOUT", "INFERENCE_FAILED", "INFERENCE_UNAVAILABLE", "WORKER_BUSY"]
    action: Literal["manual_review"] = "manual_review"
    safety_label_applied: Literal[True] = True
    detail: str = Field(max_length=160)
