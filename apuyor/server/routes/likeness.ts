import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { LikenessProfile } from '../models/LikenessProfile.js';
import { extractMediaEmbedding } from '../aiWorker.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
const uploadRoot = path.resolve(process.env.LIKELINESS_UPLOAD_DIR || 'private_uploads');
const receiveUpload: RequestHandler = (req, res, next) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Reference media must be 100 MB or smaller.' : 'Unable to receive the uploaded file.' });
      return;
    }
    if (error) {
      res.status(400).json({ error: 'Unable to receive the uploaded file.' });
      return;
    }
    next();
  });
};

const receiveVoiceUpload: RequestHandler = (req, res, next) => {
  voiceUpload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Voice samples must be 15 MB or smaller.' : 'Unable to receive the audio sample.' });
      return;
    }
    if (error) {
      res.status(400).json({ error: 'Unable to receive the audio sample.' });
      return;
    }
    next();
  });
};

async function createDevTestConsent(userId: string): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return;
  const now = new Date();
  await ConsentRecord.create({
    userId,
    confirmationCodeHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    status: 'verified',
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    referenceVideoPath: `dev-auto/${userId}/test-consent.mp4`,
    forcedLabelState: true,
    verifiedAt: now,
  });
}

function detectMedia(buffer: Buffer): { type: 'image' | 'video'; extension: string; mime: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { type: 'image', extension: 'jpg', mime: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { type: 'image', extension: 'png', mime: 'image/png' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { type: 'image', extension: 'webp', mime: 'image/webp' };
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return { type: 'video', extension: 'mp4', mime: 'video/mp4' };
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return { type: 'video', extension: 'webm', mime: 'video/webm' };
  return null;
}

function detectAudio(buffer: Buffer): { extension: 'wav' | 'mp3'; mime: string; duration: number } | null {
  if (buffer.length >= 44 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    let offset = 12;
    let byteRate = 0;
    let dataLength = 0;
    while (offset + 8 <= buffer.length) {
      const chunkName = buffer.toString('ascii', offset, offset + 4);
      const chunkLength = buffer.readUInt32LE(offset + 4);
      const chunkStart = offset + 8;
      if (chunkStart + chunkLength > buffer.length) return null;
      if (chunkName === 'fmt ' && chunkLength >= 16) byteRate = buffer.readUInt32LE(chunkStart + 8);
      if (chunkName === 'data') dataLength = chunkLength;
      offset = chunkStart + chunkLength + (chunkLength % 2);
    }
    if (byteRate > 0 && dataLength > 0) {
      return { extension: 'wav', mime: 'audio/wav', duration: dataLength / byteRate };
    }
    return null;
  }

  let offset = 0;
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
    const tagSize = (buffer[6] & 0x7f) * 0x200000 + (buffer[7] & 0x7f) * 0x4000 + (buffer[8] & 0x7f) * 0x80 + (buffer[9] & 0x7f);
    offset = 10 + tagSize + ((buffer[5] & 0x10) ? 10 : 0);
  }
  const mpeg1Layer3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  let duration = 0;
  let frames = 0;
  while (offset + 4 <= buffer.length) {
    const header = buffer.readUInt32BE(offset);
    if ((header & 0xffe00000) !== 0xffe00000) break;
    const version = (header >>> 19) & 0x3;
    const layer = (header >>> 17) & 0x3;
    const bitrateIndex = (header >>> 12) & 0xf;
    const sampleIndex = (header >>> 10) & 0x3;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleIndex === 3) break;
    const bitrate = (version === 3 ? mpeg1Layer3Bitrates : mpeg2Layer3Bitrates)[bitrateIndex] * 1000;
    const baseSampleRate = [44100, 48000, 32000][sampleIndex];
    const sampleRate = version === 3 ? baseSampleRate : version === 2 ? baseSampleRate / 2 : baseSampleRate / 4;
    const padding = (header >>> 9) & 1;
    const frameLength = Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + padding;
    if (frameLength < 4 || offset + frameLength > buffer.length) break;
    duration += (version === 3 ? 1152 : 576) / sampleRate;
    frames += 1;
    offset += frameLength;
  }
  if (!frames) return null;
  return { extension: 'mp3', mime: 'audio/mpeg', duration };
}

router.use(requireAuth);

router.get('/consents', async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const query = { userId, status: 'verified' as const, expiresAt: { $gt: new Date() } };
    let records = await ConsentRecord.find(query)
      .select('_id expiresAt').sort({ expiresAt: 1 }).lean();
    if (records.length === 0 && process.env.NODE_ENV === 'development') {
      await createDevTestConsent(req.user!.id);
      records = await ConsentRecord.find(query).select('_id expiresAt').sort({ expiresAt: 1 }).lean();
    }
    res.json({ consents: records.map((record) => ({ id: record._id.toString(), expiresAt: record.expiresAt })) });
  } catch {
    res.status(500).json({ error: 'Unable to load verified consent records.' });
  }
});

router.get('/mine', async (req, res) => {
  try {
    const profiles = await LikenessProfile.find({ userId: req.user!.id })
      .select('_id status expiresAt referenceMediaPath referenceMediaType referenceVideoPath forcedLabelState embeddingStatus createdAt')
      .sort({ createdAt: -1 }).lean();
    res.json({ profiles });
  } catch {
    res.status(500).json({ error: 'Unable to load likeness profiles.' });
  }
});

router.get('/:id/media', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ error: 'Invalid likeness profile id.' });
    return;
  }
  try {
    const profile = await LikenessProfile.findOne({ _id: req.params.id, userId: req.user!.id })
      .select('referenceMediaPath referenceMediaType').lean();
    if (!profile?.referenceMediaPath) {
      res.status(404).json({ error: 'Likeness media not found.' });
      return;
    }
    const mediaPath = path.resolve(uploadRoot, profile.referenceMediaPath);
    if (!mediaPath.startsWith(`${uploadRoot}${path.sep}`)) {
      res.status(400).json({ error: 'Invalid likeness media path.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    const extension = path.extname(mediaPath).toLowerCase();
    const contentType = extension === '.wav' ? 'audio/wav'
      : extension === '.mp3' ? 'audio/mpeg'
        : extension === '.png' ? 'image/png'
          : extension === '.webp' ? 'image/webp'
            : extension === '.webm' ? 'video/webm'
              : extension === '.mp4' ? 'video/mp4'
                : extension === '.mov' ? 'video/quicktime'
                  : 'image/jpeg';
    res.type(contentType);
    res.sendFile(mediaPath, (error) => {
      if (error && !res.headersSent) res.status(404).json({ error: 'Likeness media file is unavailable.' });
    });
  } catch {
    res.status(500).json({ error: 'Unable to load likeness media.' });
  }
});

router.post('/upload', receiveUpload, async (req, res) => {
  const consentRecordId = req.body?.consentRecordId;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Choose a reference image or video to upload.' });
    return;
  }
  const consentIdIsValid = typeof consentRecordId === 'string' && mongoose.isValidObjectId(consentRecordId);
  if (!consentIdIsValid && process.env.NODE_ENV !== 'development') {
    res.status(400).json({ error: 'Select an active, verified consent record.' });
    return;
  }
  const media = detectMedia(file.buffer);
  if (!media) {
    res.status(415).json({ error: 'File content must be a JPEG, PNG, WebP, MP4, or WebM.' });
    return;
  }
  if (media.type === 'image' && file.size > 10 * 1024 * 1024) {
    res.status(413).json({ error: 'Target face images must be 10 MB or smaller.' });
    return;
  }

  let savedPath: string | undefined;
  try {
    let consent = consentIdIsValid ? await ConsentRecord.findOne({
      _id: consentRecordId,
      userId: req.user!.id,
      status: 'verified',
      expiresAt: { $gt: new Date() },
    }).select('+confirmationCodeHash').lean() : null;
    if (!consent && process.env.NODE_ENV === 'development') {
      await createDevTestConsent(req.user!.id);
      consent = await ConsentRecord.findOne({
        userId: req.user!.id,
        status: 'verified',
        expiresAt: { $gt: new Date() },
        referenceVideoPath: { $regex: '^dev-auto/' },
      }).select('+confirmationCodeHash').sort({ createdAt: -1 }).lean();
    }
    if (!consent) {
      res.status(403).json({ error: 'An active verified consent record for your account is required.' });
      return;
    }

    const relativePath = path.join('likeness', req.user!.id, `${randomUUID()}.${media.extension}`);
    savedPath = path.resolve(uploadRoot, relativePath);
    await mkdir(path.dirname(savedPath), { recursive: true });
    await writeFile(savedPath, file.buffer, { flag: 'wx', mode: 0o600 });

    const embedding = media.type === 'image' && media.mime !== 'image/webp'
      ? await extractMediaEmbedding('face', file.buffer, media.mime, `target.${media.extension}`)
      : {
        status: 'unavailable' as const,
        message: 'Face embeddings require a JPEG or PNG image.',
      };
    const profile = await LikenessProfile.create({
      userId: req.user!.id,
      confirmationCodeHash: consent.confirmationCodeHash,
      status: 'pending',
      expiresAt: consent.expiresAt,
      referenceMediaPath: relativePath.replaceAll(path.sep, '/'),
      referenceMediaType: media.type,
      forcedLabelState: consent.forcedLabelState,
      embeddingStatus: media.type === 'image' ? embedding.status : 'unavailable',
      ...(media.type === 'image' && embedding.embeddingProfileId ? { embeddingProfileId: embedding.embeddingProfileId } : {}),
    });
    res.status(201).json({
      message: `Reference media uploaded. Admin approval is required before it can be used. ${embedding.message}`,
      profile: {
        _id: profile.id,
        status: profile.status,
        expiresAt: profile.expiresAt,
        referenceMediaPath: profile.referenceMediaPath,
        referenceMediaType: profile.referenceMediaType,
        forcedLabelState: profile.forcedLabelState,
        embeddingStatus: profile.embeddingStatus,
      },
    });
  } catch {
    if (savedPath) await rm(savedPath, { force: true }).catch(() => undefined);
    res.status(500).json({ error: 'Unable to save likeness media.' });
  }
});

router.post('/voice-upload', receiveVoiceUpload, async (req, res) => {
  const consentRecordId = req.body?.consentRecordId;
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Choose a WAV or MP3 voice sample to upload.' });
    return;
  }
  if (typeof consentRecordId !== 'string' || !mongoose.isValidObjectId(consentRecordId)) {
    res.status(400).json({ error: 'Select an active, verified consent record.' });
    return;
  }
  const audio = detectAudio(file.buffer);
  if (!audio) {
    res.status(415).json({ error: 'File content must be a valid WAV or MP3 audio sample.' });
    return;
  }
  if (audio.duration < 5 || audio.duration > 15) {
    res.status(400).json({ error: 'Voice samples must be between 5 and 15 seconds.' });
    return;
  }

  let savedPath: string | undefined;
  try {
    const consent = await ConsentRecord.findOne({
      _id: consentRecordId,
      userId: req.user!.id,
      status: 'verified',
      expiresAt: { $gt: new Date() },
    }).select('+confirmationCodeHash').lean();
    if (!consent) {
      res.status(403).json({ error: 'An active verified consent record for your account is required.' });
      return;
    }

    const relativePath = path.join('likeness', req.user!.id, `${randomUUID()}.${audio.extension}`);
    savedPath = path.resolve(uploadRoot, relativePath);
    await mkdir(path.dirname(savedPath), { recursive: true });
    await writeFile(savedPath, file.buffer, { flag: 'wx', mode: 0o600 });
    const embedding = await extractMediaEmbedding('voice', file.buffer, audio.mime, `voice-sample.${audio.extension}`);
    const profile = await LikenessProfile.create({
      userId: req.user!.id,
      confirmationCodeHash: consent.confirmationCodeHash,
      status: 'pending',
      expiresAt: consent.expiresAt,
      referenceMediaPath: relativePath.replaceAll(path.sep, '/'),
      referenceMediaType: 'audio',
      forcedLabelState: consent.forcedLabelState,
      embeddingStatus: embedding.status,
      ...(embedding.embeddingProfileId ? { embeddingProfileId: embedding.embeddingProfileId } : {}),
    });
    res.status(201).json({
      message: `Voice sample uploaded. Admin approval is required before it can be used. ${embedding.message}`,
      profile: {
        _id: profile.id,
        status: profile.status,
        expiresAt: profile.expiresAt,
        referenceMediaPath: profile.referenceMediaPath,
        referenceMediaType: profile.referenceMediaType,
        forcedLabelState: profile.forcedLabelState,
        embeddingStatus: profile.embeddingStatus,
      },
    });
  } catch {
    if (savedPath) await rm(savedPath, { force: true }).catch(() => undefined);
    res.status(500).json({ error: 'Unable to save voice sample.' });
  }
});

export default router;
