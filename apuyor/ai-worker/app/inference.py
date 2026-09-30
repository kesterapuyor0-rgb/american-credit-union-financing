from dataclasses import dataclass
from typing import Protocol

from .schemas import TransformRequest, VoiceConvertRequest


@dataclass(frozen=True)
class InferenceResult:
    result_media_id: str
    safety_label_applied: bool


class InferenceAdapter(Protocol):
    def transform_frame(self, request: TransformRequest) -> InferenceResult: ...

    def transform_video(self, request: TransformRequest) -> InferenceResult: ...

    def convert_voice(self, request: VoiceConvertRequest) -> InferenceResult: ...


class InferenceUnavailable(RuntimeError):
    """Raised when no model backend is configured or available."""


class UnconfiguredInferenceAdapter:
    """Safe default: never reports success when there is no model attached."""

    def transform_frame(self, request: TransformRequest) -> InferenceResult:
        raise InferenceUnavailable("Frame inference backend is not configured.")

    def transform_video(self, request: TransformRequest) -> InferenceResult:
        raise InferenceUnavailable("Video inference backend is not configured.")

    def convert_voice(self, request: VoiceConvertRequest) -> InferenceResult:
        raise InferenceUnavailable("Voice inference backend is not configured.")


adapter: InferenceAdapter = UnconfiguredInferenceAdapter()
