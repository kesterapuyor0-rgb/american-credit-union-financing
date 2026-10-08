import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { ConsentRecord } from '../models/ConsentRecord.js';
import { LikenessProfile } from '../models/LikenessProfile.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
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

router.use(requireAuth);

router.get('/consents', async (req, res) => {
  try {
    const query = { userId: req.user!.id, status: 'verified', expiresAt: { $gt: new Date() } };
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
      .select('_id status expiresAt referenceMediaPath referenceMediaType referenceVideoPath forcedLabelState createdAt')
      .sort({ createdAt: -1 }).lean();
    res.json({ profiles });
  } catch {
    res.status(500).json({ error: 'Unable to load likeness profiles.' });
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

    const profile = await LikenessProfile.create({
      userId: req.user!.id,
      confirmationCodeHash: consent.confirmationCodeHash,
      status: 'pending',
      expiresAt: consent.expiresAt,
      referenceMediaPath: relativePath.replaceAll(path.sep, '/'),
      referenceMediaType: media.type,
      forcedLabelState: consent.forcedLabelState,
    });
    res.status(201).json({
      message: 'Reference media uploaded. Admin approval is required before it can be used.',
      profile: {
        _id: profile.id,
        status: profile.status,
        expiresAt: profile.expiresAt,
        referenceMediaPath: profile.referenceMediaPath,
        referenceMediaType: profile.referenceMediaType,
        forcedLabelState: profile.forcedLabelState,
      },
    });
  } catch {
    if (savedPath) await rm(savedPath, { force: true }).catch(() => undefined);
    res.status(500).json({ error: 'Unable to save likeness media.' });
  }
});

export default router;
