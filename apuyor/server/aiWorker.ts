export type EmbeddingResult = {
  status: 'ready' | 'unavailable' | 'failed';
  embeddingProfileId?: string;
  message: string;
};

export async function extractMediaEmbedding(
  kind: 'face' | 'voice',
  bytes: Buffer,
  mime: string,
  filename: string,
): Promise<EmbeddingResult> {
  const baseUrl = process.env.AI_WORKER_URL?.trim().replace(/\/+$/, '');
  const apiKey = process.env.AI_WORKER_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return { status: 'unavailable', message: 'Embedding worker is not configured.' };
  }

  try {
    const body = new FormData();
    body.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), filename);
    const response = await fetch(`${baseUrl}/v1/embeddings/${kind}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
      signal: AbortSignal.timeout(65_000),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string'
        ? payload.detail
        : 'Embedding extraction failed.';
      console.warn(`AI worker ${kind} embedding request failed (${response.status}): ${detail}`);
      return {
        status: response.status === 503 ? 'unavailable' : 'failed',
        message: detail,
      };
    }
    if (!payload || typeof payload !== 'object' ||
        !('embedding_profile_id' in payload) || typeof payload.embedding_profile_id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(payload.embedding_profile_id)) {
      console.error(`AI worker returned an invalid ${kind} embedding response.`);
      return { status: 'failed', message: 'Embedding worker returned an invalid response.' };
    }
    return {
      status: 'ready',
      embeddingProfileId: payload.embedding_profile_id,
      message: 'Embedding extracted successfully.',
    };
  } catch (error) {
    console.error(`AI worker ${kind} embedding request could not be completed:`, error);
    return { status: 'failed', message: 'Embedding worker could not be reached.' };
  }
}
