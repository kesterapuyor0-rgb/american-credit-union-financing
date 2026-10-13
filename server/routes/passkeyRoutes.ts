import { randomUUID } from 'crypto';
import { Router, type Response } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { PasskeyChallenge, PasskeyCredential, User } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { AuthenticatedRequest, isAdminRole, requireAuth, signAuthToken } from '../auth.js';
import { createNotification } from '../notifications.js';

const router = Router();
const challengeLifetimeMs = 5 * 60 * 1000;

router.use(requireDatabase);

function getWebAuthnConfig(): { rpID: string; origins: string[] } {
  const configuredOrigins = process.env.PASSKEY_ORIGIN?.trim()
    || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : '');
  const origins = configuredOrigins.split(',').map((origin) => {
    const parsed = new URL(origin.trim());
    if (parsed.origin !== origin.trim() || (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')) {
      throw new Error('PASSKEY_ORIGIN must contain trusted origins, using HTTPS in production.');
    }
    return parsed.origin;
  }).filter(Boolean);
  if (!origins.length) throw new Error('Set PASSKEY_ORIGIN to the application origin.');

  const rpID = process.env.PASSKEY_RP_ID?.trim() || new URL(origins[0]).hostname;
  if (!rpID || origins.some((origin) => {
    const hostname = new URL(origin).hostname;
    return hostname !== rpID && !hostname.endsWith(`.${rpID}`);
  })) {
    throw new Error('PASSKEY_RP_ID must be the application domain or a parent domain of every configured origin.');
  }
  return { rpID, origins };
}

function isResponseObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRegistrationResponse(value: unknown): value is RegistrationResponseJSON {
  return isResponseObject(value)
    && typeof value.id === 'string'
    && typeof value.rawId === 'string'
    && value.type === 'public-key'
    && isResponseObject(value.response)
    && typeof value.response.clientDataJSON === 'string'
    && typeof value.response.attestationObject === 'string'
    && isResponseObject(value.clientExtensionResults);
}

function isAuthenticationResponse(value: unknown): value is AuthenticationResponseJSON {
  return isResponseObject(value)
    && typeof value.id === 'string'
    && typeof value.rawId === 'string'
    && value.type === 'public-key'
    && isResponseObject(value.response)
    && typeof value.response.clientDataJSON === 'string'
    && typeof value.response.authenticatorData === 'string'
    && typeof value.response.signature === 'string'
    && isResponseObject(value.clientExtensionResults);
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
}

function getEnrollmentStatus(user: Record<string, unknown>): 'incomplete' | 'action_required' | 'pending_review' | null {
  const verificationStatus = normalizeStatus(user.verification_status);
  const kycStatus = normalizeStatus(user.kycStatus);
  if (verificationStatus === 'approved') return null;
  if (verificationStatus === 'rejected' || kycStatus === 'rejected') return 'action_required';
  if (kycStatus === 'approved') return null;

  const statuses = [user.status, user.enrollmentStatus, verificationStatus, kycStatus].map(normalizeStatus);
  if (statuses.includes('incomplete')) return 'incomplete';
  if (statuses.includes('action_required')) return 'action_required';
  if (statuses.some((status) => ['pending', 'pending_review', 'under_review'].includes(status))) return 'pending_review';
  return null;
}

async function findRequestUser(req: AuthenticatedRequest): Promise<any | null> {
  if (!req.user) return null;
  return User.findOne({ id: req.user.id })
    .select('id email full_name role isAdmin isActive verification_status')
    .lean<any>();
}

function rejectIneligibleUser(user: any, res: Response): boolean {
  if (!user) {
    res.status(404).json({ error: 'User profile not found.' });
    return true;
  }
  if (user.isActive === false) {
    res.status(403).json({ error: 'This account is deactivated. Contact Member Services for assistance.' });
    return true;
  }
  if (!isAdminRole(user.role, user.isAdmin) && (user.verification_status || 'approved') !== 'approved') {
    res.status(403).json({ error: 'Only approved accounts can register a passkey.' });
    return true;
  }
  return false;
}

router.post('/register-options', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await findRequestUser(req);
    if (rejectIneligibleUser(user, res)) return;
    const { rpID } = getWebAuthnConfig();
    const credentials = await PasskeyCredential.find({ userId: user.id }).select('credentialId transports').lean<any[]>();
    const options = await generateRegistrationOptions({
      rpName: 'American Credit Union Financing',
      rpID,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.full_name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      excludeCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports,
      })),
      timeout: 60_000,
    });
    const challengeId = randomUUID();
    await PasskeyChallenge.create({
      id: challengeId,
      challenge: options.challenge,
      userId: user.id,
      purpose: 'registration',
      expiresAt: new Date(Date.now() + challengeLifetimeMs),
    });
    res.json({ challengeId, options });
  } catch (error) {
    console.error('Unable to create passkey registration options:', error);
    res.status(503).json({ error: errorMessage(error, 'Unable to start passkey registration.') });
  }
});

router.post('/verify-registration', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { challengeId, response, name } = req.body || {};
  if (typeof challengeId !== 'string' || !isRegistrationResponse(response)
    || response.id.length > 2048 || typeof name !== 'string' || name.trim().length > 50) {
    res.status(400).json({ error: 'Provide a valid passkey registration response and a name up to 50 characters.' });
    return;
  }

  try {
    const user = await findRequestUser(req);
    if (rejectIneligibleUser(user, res)) return;
    const challenge = await PasskeyChallenge.findOneAndDelete({
      id: challengeId,
      userId: user.id,
      purpose: 'registration',
      expiresAt: { $gt: new Date() },
    }).lean<any>();
    if (!challenge) {
      res.status(400).json({ error: 'Passkey registration expired or was already used. Please try again.' });
      return;
    }

    const { rpID, origins } = getWebAuthnConfig();
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
    } catch {
      res.status(400).json({ error: 'The passkey registration could not be verified. Please try again.' });
      return;
    }
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: 'The passkey registration could not be verified. Please try again.' });
      return;
    }

    const credential = verification.registrationInfo.credential;
    const credentialId = credential.id;
    if (await PasskeyCredential.exists({ credentialId })) {
      res.status(409).json({ error: 'This passkey is already registered.' });
      return;
    }

    await PasskeyCredential.create({
      credentialId,
      userId: user.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports || [],
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      name: name.trim() || 'Passkey',
    });
    res.status(201).json({
      success: true,
      credential: {
        id: credentialId,
        name: name.trim() || 'Passkey',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Unable to verify passkey registration:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to save this passkey.') });
  }
});

router.get('/credentials', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const credentials = await PasskeyCredential.find({ userId: req.user!.id })
      .select('credentialId name createdAt lastUsedAt')
      .sort({ createdAt: -1 })
      .lean<any[]>();
    res.json({
      credentials: credentials.map((credential) => ({
        id: credential.credentialId,
        name: credential.name,
        createdAt: credential.createdAt,
        lastUsedAt: credential.lastUsedAt || null,
      })),
    });
  } catch (error) {
    console.error('Unable to list passkeys:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to load passkeys.') });
  }
});

router.delete('/credentials/:credentialId', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const credentialId = String(req.params.credentialId || '');
  if (!credentialId || credentialId.length > 2048) {
    res.status(400).json({ error: 'Provide a valid passkey ID.' });
    return;
  }

  try {
    const result = await PasskeyCredential.deleteOne({ credentialId, userId: req.user!.id });
    if (result.deletedCount !== 1) {
      res.status(404).json({ error: 'Passkey not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Unable to remove passkey:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to remove this passkey.') });
  }
});

router.post('/login-options', async (_req, res: Response): Promise<void> => {
  try {
    const { rpID } = getWebAuthnConfig();
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'required',
      timeout: 60_000,
    });
    const challengeId = randomUUID();
    await PasskeyChallenge.create({
      id: challengeId,
      challenge: options.challenge,
      purpose: 'authentication',
      expiresAt: new Date(Date.now() + challengeLifetimeMs),
    });
    res.json({ challengeId, options });
  } catch (error) {
    console.error('Unable to create passkey authentication options:', error);
    res.status(503).json({ error: errorMessage(error, 'Unable to start passkey sign-in.') });
  }
});

router.post('/verify-login', async (req, res: Response): Promise<void> => {
  const { challengeId, response } = req.body || {};
  if (typeof challengeId !== 'string' || !isAuthenticationResponse(response)
    || response.id.length > 2048) {
    res.status(400).json({ error: 'Provide a valid passkey authentication response.' });
    return;
  }

  try {
    const challenge = await PasskeyChallenge.findOneAndDelete({
      id: challengeId,
      purpose: 'authentication',
      expiresAt: { $gt: new Date() },
    }).lean<any>();
    if (!challenge) {
      res.status(400).json({ error: 'Passkey sign-in expired or was already used. Please try again.' });
      return;
    }

    const credential = await PasskeyCredential.findOne({ credentialId: response.id }).lean<any>();
    if (!credential) {
      res.status(401).json({ error: 'Passkey sign-in failed. Try again or use your password.' });
      return;
    }
    const user = await User.findOne({ id: credential.userId })
      .select('id email full_name role isAdmin isActive isRestricted restrictionReason phone address profilePicture kycStatus status enrollmentStatus lastCompletedStep enrollmentStep verification_status verification_rejection_reason verification_rejection_details')
      .lean<any>();
    if (!user || user.isActive === false) {
      res.status(401).json({ error: 'Passkey sign-in failed. Try again or use your password.' });
      return;
    }

    const { rpID, origins } = getWebAuthnConfig();
    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origins,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, 'base64url'),
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: true,
      });
    } catch {
      res.status(401).json({ error: 'Passkey sign-in failed. Try again or use your password.' });
      return;
    }
    if (!verification.verified) {
      res.status(401).json({ error: 'Passkey sign-in failed. Try again or use your password.' });
      return;
    }

    const { newCounter, credentialID, credentialDeviceType, credentialBackedUp } = verification.authenticationInfo;
    const counterUpdate = await PasskeyCredential.findOneAndUpdate(
      { credentialId: credentialID, userId: user.id, counter: credential.counter },
      {
        $set: {
          counter: newCounter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          lastUsedAt: new Date(),
        },
      },
      { new: true },
    ).select('_id').lean();
    if (!counterUpdate) {
      res.status(409).json({ error: 'This passkey was used in another sign-in attempt. Please try again.' });
      return;
    }

    const role = isAdminRole(user.role, user.isAdmin) ? 'admin' : 'user';
    const authToken = signAuthToken({
      id: user.id,
      email: user.email,
      role,
      full_name: user.full_name,
      phone: user.phone,
    });
    const enrollmentStatus = role === 'user' ? getEnrollmentStatus(user) : null;
    const status = enrollmentStatus === 'incomplete'
      ? 'incomplete'
      : enrollmentStatus === 'action_required'
        ? 'action_required'
        : enrollmentStatus === 'pending_review'
          ? 'pending_review'
          : 'authenticated';
    const rejectionReason = user.verification_rejection_reason || '';
    const rejectionDetails = Array.isArray(user.verification_rejection_details) && user.verification_rejection_details.length
      ? user.verification_rejection_details
      : rejectionReason.split(/\r?\n/).map((detail: string) => detail.trim()).filter(Boolean);
    const resumeStep = Math.min(3, Number(user.lastCompletedStep ?? user.enrollmentStep ?? 0) + 1);

    res.cookie('boa_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600 * 1000,
    });
    if (role === 'user') {
      try {
        await createNotification({
          userId: user.id,
          title: 'Passkey Sign-in Detected',
          message: `A passkey sign-in to your account was detected on ${new Date().toISOString().slice(0, 10)}.`,
          type: 'security',
          category: 'security',
          link: 'security',
        });
      } catch (notificationError) {
        console.error('Unable to record passkey sign-in notification:', notificationError);
      }
    }

    res.json({
      success: true,
      token: authToken,
      status,
      ...(enrollmentStatus === 'incomplete' ? { redirectTo: `/enroll?step=${resumeStep}` } : {}),
      ...(enrollmentStatus === 'action_required' ? { redirectTo: '/enroll/resubmit', rejectionReason, rejectionDetails } : {}),
      ...(enrollmentStatus === 'pending_review' ? { redirectTo: '/enrollment/status' } : {}),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role,
        phone: user.phone,
        address: user.address || '',
        profilePicture: user.profilePicture || '',
        kycStatus: user.kycStatus || 'Pending',
        isRestricted: user.isRestricted === true,
        restrictionReason: user.restrictionReason || '',
        verification_status: enrollmentStatus === 'incomplete'
          ? 'incomplete'
          : enrollmentStatus === 'action_required'
            ? 'rejected'
            : enrollmentStatus === 'pending_review'
              ? 'under_review'
              : user.verification_status || 'approved',
        verification_rejection_reason: rejectionReason,
        verification_rejection_details: rejectionDetails,
        status,
        ...(enrollmentStatus === 'incomplete' ? { lastCompletedStep: user.lastCompletedStep ?? 0, enrollmentStep: resumeStep } : {}),
      },
    });
  } catch (error) {
    console.error('Unable to verify passkey sign-in:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to complete passkey sign-in.') });
  }
});

export default router;
