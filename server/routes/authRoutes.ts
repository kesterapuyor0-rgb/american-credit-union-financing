import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { User, Account, VerificationCode, AuditLog } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { createNotification } from '../notifications.js';
import { sendOtpEmail, sendPasswordResetEmail } from '../../lib/email.js';
import {
  signAuthToken,
  signTemp2FAToken,
  verifyTemp2FAToken,
  requireAuth,
  isAdminRole,
  AuthenticatedRequest,
  verifyAuthToken,
  getAuthTokenFromRequest,
} from '../auth.js';

const router = Router();

const normalizeKycStatus = (value: unknown): 'UNVERIFIED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' => {
  switch (String(value || '').toUpperCase()) {
    case 'PENDING':
    case 'PENDING_REVIEW':
      return 'PENDING_REVIEW';
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    default:
      return 'UNVERIFIED';
  }
};

const normalizeRestrictionType = (value: unknown, isRestricted = false): 'NONE' | 'KYC' | 'SECURITY' | 'SOURCE_OF_FUNDS' => {
  if (value === 'KYC' || value === 'SECURITY' || value === 'SOURCE_OF_FUNDS') return value;
  return isRestricted ? 'KYC' : 'NONE';
};

function getLocalDevEmail(): string {
  return (process.env.LOCAL_DEV_EMAIL || 'apuyork@gmail.com').trim().toLowerCase();
}

function isLocalDevEnabled(): boolean {
  return process.env.NODE_ENV !== 'production'
    && process.env.VERCEL !== '1'
    && process.env.LOCAL_DEV_AUTH === 'true'
    && Boolean(process.env.LOCAL_DEV_PASSWORD);
}

function getLocalDevUserId(): string {
  return `local-dev-${getLocalDevEmail()}`;
}

function getLocalDevRole(): 'user' | 'admin' {
  return process.env.LOCAL_DEV_ROLE?.trim().toLowerCase() === 'admin' ? 'admin' : 'user';
}

function isLocalDevLogin(email: unknown): boolean {
  return isLocalDevEnabled() && typeof email === 'string' && email.trim().toLowerCase() === getLocalDevEmail();
}

function localDevPasswordMatches(password: unknown): boolean {
  if (!isLocalDevEnabled() || typeof password !== 'string') return false;
  const expected = Buffer.from(process.env.LOCAL_DEV_PASSWORD || '', 'utf8');
  const supplied = Buffer.from(password, 'utf8');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

router.use((req, res, next) => {
  const path = req.path.replace(/\/$/, '');
  if (req.method === 'POST' && path.endsWith('/login') && isLocalDevLogin(req.body?.email)) {
    next();
    return;
  }

  if (req.method === 'GET' && path.endsWith('/me')) {
    const authToken = getAuthTokenFromRequest(req);
    const payload = verifyAuthToken(authToken || '');
    if (isLocalDevEnabled() && (!authToken || (payload?.id === getLocalDevUserId() && payload.email === getLocalDevEmail()))) {
      next();
      return;
    }
  }

  void requireDatabase(req, res, next);
});

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  const maskedName = name.length > 2
    ? name[0] + '***' + name[name.length - 1]
    : name[0] + '***';
  return `${maskedName}@${parts[1]}`;
}

const hashPasswordResetToken = (token: string) => createHash('sha256').update(token).digest('hex');
const passwordResetRequestMessage = 'If an account with that email exists, a reset link has been sent.';

async function issueLoginOtp(user: { id: string; email: string; phone: string }): Promise<string> {
  await VerificationCode.updateMany(
    { user_id: user.id, purpose: 'login', verified: false },
    { $set: { verified: true } },
  );
  const otpId = `otp_${randomUUID()}`;
  const otpCode = randomInt(100000, 1000000).toString();
  await VerificationCode.create({
    id: otpId,
    user_id: user.id,
    email: user.email,
    phone: user.phone,
    code: otpCode,
    purpose: 'login',
    expires_at: Date.now() + 10 * 60 * 1000,
    verified: false,
    created_at: Date.now(),
  });

  try {
    await sendOtpEmail({ toEmail: user.email, otpCode });
  } catch (emailError) {
    await VerificationCode.updateOne({ id: otpId, verified: false }, { $set: { verified: true } });
    throw emailError;
  }

  return otpId;
}

function getEnrollmentStatus({
  status,
  enrollmentStatus,
  verificationStatus,
  kycStatus,
}: {
  status: unknown;
  enrollmentStatus: unknown;
  verificationStatus: unknown;
  kycStatus: unknown;
}): 'incomplete' | 'action_required' | 'pending_review' | null {
  const normalize = (value: unknown) => typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : '';
  const statuses = [status, enrollmentStatus, verificationStatus, kycStatus].map(normalize);
  const normalizedVerificationStatus = normalize(verificationStatus);
  const normalizedKycStatus = normalize(kycStatus);
  if (normalizedVerificationStatus === 'approved') return null;
  if (normalizedVerificationStatus === 'rejected') return 'action_required';
  if (normalizedKycStatus === 'approved') return null;
  if (normalizedKycStatus === 'rejected') return 'action_required';
  if (statuses.includes('incomplete')) return 'incomplete';
  if (statuses.some((value) => value === 'rejected' || value === 'action_required')) return 'action_required';
  if (statuses.some((value) => ['pending', 'pending_review', 'under_review'].includes(value))) return 'pending_review';
  return null;
}

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Enter a valid email address.' });
      return;
    }

    const user = await User.findOne({ email }).select('id email').lean<any>();
    if (!user) {
      res.json({ success: true, message: passwordResetRequestMessage });
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashPasswordResetToken(token);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
      || process.env.APP_URL?.trim()
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
      || (process.env.NODE_ENV !== 'production' ? 'http://localhost:5173' : '');
    let resetUrl: URL;
    try {
      resetUrl = new URL('/auth/reset-password', configuredAppUrl);
      if (!['http:', 'https:'].includes(resetUrl.protocol)) throw new Error('Reset link URL must use HTTP or HTTPS.');
    } catch (urlError) {
      console.error('Password reset link URL is not configured correctly:', urlError);
      res.status(503).json({ error: 'Unable to process the password reset right now. Please try again later.' });
      return;
    }
    resetUrl.searchParams.set('token', token);
    resetUrl.searchParams.set('email', user.email);

    await User.updateOne(
      { id: user.id },
      { $set: { resetPasswordToken: tokenHash, resetPasswordExpires: expiresAt } },
    );
    try {
      await sendPasswordResetEmail({ email: user.email, resetUrl: resetUrl.toString() });
    } catch (mailError) {
      await User.updateOne(
        { id: user.id, resetPasswordToken: tokenHash },
        { $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } },
      );
      throw mailError;
    }

    res.json({ success: true, message: passwordResetRequestMessage });
  } catch (err) {
    console.error('Password reset email request failed:', err);
    res.status(503).json({ error: 'Unable to process the password reset right now. Please try again later.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res): Promise<void> => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-f0-9]{64}$/i.test(token)) {
      res.status(400).json({ error: 'Invalid or expired reset token.' });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: 'Your new passcode must be between 8 and 128 characters.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedUser = await User.findOneAndUpdate(
      {
        email,
        resetPasswordToken: hashPasswordResetToken(token),
        resetPasswordExpires: { $gt: new Date() },
      },
      {
        $set: { password_hash: passwordHash },
        $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 },
      },
      { new: true, projection: { id: 1 } },
    ).lean<any>();
    if (!updatedUser) {
      res.status(400).json({ error: 'Invalid or expired reset token.' });
      return;
    }

    res.json({ success: true, message: 'Your passcode has been reset. You can now sign in.' });
  } catch (err) {
    console.error('Password reset failed:', err);
    res.status(500).json({ error: 'Unable to reset your passcode right now. Please try again later.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res): Promise<void> => {
  try {
    const { email, password, portal } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please enter your Online ID / Email and Passcode.' });
      return;
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Please enter a valid Online ID / Email and Passcode.' });
      return;
    }

    if (isLocalDevLogin(email)) {
      if (!localDevPasswordMatches(password)) {
        res.status(401).json({ error: 'The Online ID or Passcode entered does not match our records.' });
        return;
      }
      if (portal === 'admin' && getLocalDevRole() !== 'admin') {
        res.status(403).json({ error: 'Local development sign-in is limited to the customer portal.' });
        return;
      }

      const localUser = {
        id: getLocalDevUserId(),
        email: getLocalDevEmail(),
        full_name: process.env.LOCAL_DEV_FULL_NAME?.trim() || 'Local Developer',
        role: getLocalDevRole(),
        phone: process.env.LOCAL_DEV_PHONE?.trim() || 'Not provided',
        profilePicture: '',
        verification_status: 'approved',
      };
      const token = signAuthToken(localUser);
      res.cookie('boa_token', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 8 * 3600 * 1000,
      });
      res.json({ success: true, token, user: localUser });
      return;
    }

    const loginIdentifier = email.trim();
    const escapedEmail = loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { email: { $regex: `^${escapedEmail}$`, $options: 'i' } },
        { id: loginIdentifier },
      ],
    }).select('+password_hash').lean<any>();
    if (!user) {
      res.status(401).json({ error: 'The Online ID or Passcode entered does not match our records.' });
      return;
    }

    const isMatch = typeof user.password_hash === 'string'
      && await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'The Online ID or Passcode entered does not match our records.' });
      return;
    }
    if (user.isActive === false) {
      res.status(403).json({ error: 'This account is deactivated. Contact Member Services for assistance.' });
      return;
    }

    if (portal === 'admin' && !isAdminRole(user.role, user.isAdmin)) {
      res.status(403).json({ error: 'Administrator credentials are required for this portal.' });
      return;
    }

    const normalizedRole = isAdminRole(user.role, user.isAdmin) ? 'admin' : 'user';
    const enrollmentStatus = normalizedRole === 'user'
      ? getEnrollmentStatus({
        status: user.status,
        enrollmentStatus: user.enrollmentStatus,
        verificationStatus: user.verification_status,
        kycStatus: user.kycStatus,
      })
      : null;
    const incompleteEnrollment = enrollmentStatus === 'incomplete';
    const actionRequired = enrollmentStatus === 'action_required';
    const pendingReview = enrollmentStatus === 'pending_review';
    if (incompleteEnrollment || actionRequired || pendingReview) {
      const authToken = signAuthToken({
        id: user.id,
        email: user.email,
        role: normalizedRole,
        full_name: user.full_name,
        phone: user.phone,
      });
      const rejectionReason = user.verification_rejection_reason || '';
      const rejectionDetails = Array.isArray(user.verification_rejection_details) && user.verification_rejection_details.length
        ? user.verification_rejection_details
        : rejectionReason.split(/\r?\n/).map((detail: string) => detail.trim()).filter(Boolean);
      const savedStepValue = Number(user.lastCompletedStep ?? user.enrollmentStep ?? 0);
      const lastCompletedStep = Number.isInteger(savedStepValue) && savedStepValue >= 0 && savedStepValue <= 3 ? savedStepValue : 0;
      const resumeStep = Math.min(3, lastCompletedStep + 1);
      const status = incompleteEnrollment ? 'incomplete' : actionRequired ? 'action_required' : 'pending_review';
      res.cookie('boa_token', authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 8 * 3600 * 1000,
      });
      res.json({
        success: true,
        token: authToken,
        status,
        redirectTo: incompleteEnrollment
          ? `/enroll?step=${resumeStep}`
          : actionRequired
            ? '/enroll/resubmit'
            : '/enrollment/status',
        ...(actionRequired ? { rejectionReason, rejectionDetails } : {}),
        ...(incompleteEnrollment ? { lastCompletedStep, resumeStep } : {}),
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: normalizedRole,
          phone: user.phone,
          address: user.address || '',
          ...(actionRequired ? { rejectionReason, rejectionDetails } : {}),
          verification_status: incompleteEnrollment ? 'incomplete' : actionRequired ? 'rejected' : 'under_review',
          verification_rejection_reason: rejectionReason,
          verification_rejection_details: actionRequired ? rejectionDetails : [],
          ...(incompleteEnrollment ? { lastCompletedStep, enrollmentStep: resumeStep } : {}),
          status,
        },
      });
      return;
    }

    const tempToken = signTemp2FAToken({
      id: user.id,
      email: user.email,
      role: normalizedRole,
      purpose: 'login',
    });

    res.json({
      require2FA: true,
      tempToken,
      maskedEmail: maskEmail(user.email),
      message: 'Send a security verification code to your email to complete sign in.',
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: errorMessage(err, 'Internal server error during authentication.') });
  }
});

// POST /api/auth/verify-2fa
router.post('/verify-2fa', async (req, res): Promise<void> => {
  try {
    const { tempToken, code, otpId } = req.body;

    if (typeof tempToken !== 'string' || typeof code !== 'string' || typeof otpId !== 'string') {
      res.status(400).json({ error: 'Verification token and 6-digit code are required.' });
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Enter a valid 6-digit verification code.' });
      return;
    }

    const payload = verifyTemp2FAToken(tempToken);
    if (!payload || payload.purpose !== 'login') {
      res.status(401).json({ error: 'Verification session expired. Please sign in again.' });
      return;
    }

    const record = await VerificationCode.findOneAndUpdate(
      {
        id: otpId,
        user_id: payload.id,
        purpose: 'login',
        code,
        verified: false,
        expires_at: { $gt: Date.now() },
      },
      { $set: { verified: true } },
      { new: true },
    ).lean<any>();
    if (!record) {
      res.status(400).json({ error: 'Invalid verification code. Please check your code and try again.' });
      return;
    }

    const user = await User.findOne({ id: payload.id }).select('id email full_name role isAdmin isActive isRestricted restrictionType restrictionReason phone profilePicture kycStatus rejectionReason kycSubmittedAt verification_status verification_rejection_reason verification_rejection_details verification_submission.restrictionReviewStatus verification_submission.restrictionReviewReason').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }
    if (user.isActive === false) {
      res.status(403).json({ error: 'This account is deactivated. Contact Member Services for assistance.' });
      return;
    }

    const normalizedRole = isAdminRole(user.role, user.isAdmin) ? 'admin' : 'user';
    const authToken = signAuthToken({
      id: user.id,
      email: user.email,
      role: normalizedRole,
      full_name: user.full_name,
      phone: user.phone,
    });
    if (normalizedRole === 'user') {
      try {
        await createNotification({
          userId: user.id,
          title: 'Sign-in Detected',
          message: `A successful sign-in to your account was detected on ${new Date().toISOString().slice(0, 10)}.`,
          type: 'security',
          category: 'security',
          link: 'security',
        });
      } catch (notificationError) {
        console.error('Unable to record successful sign-in notification:', notificationError);
      }
    }

    // Set HTTP-only cookie
    res.cookie('boa_token', authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 3600 * 1000,
    });

    const actionRequired = normalizedRole === 'user' && user.verification_status === 'rejected';
    const pendingReview = normalizedRole === 'user' && user.verification_status === 'under_review';
    const rejectionReason = user.verification_rejection_reason || '';
    const rejectionDetails = Array.isArray(user.verification_rejection_details) && user.verification_rejection_details.length
      ? user.verification_rejection_details
      : rejectionReason.split(/\r?\n/).map((detail: string) => detail.trim()).filter(Boolean);
    res.json({
      success: true,
      token: authToken,
      status: actionRequired ? 'action_required' : pendingReview ? 'pending_review' : 'authenticated',
      ...(actionRequired ? { rejectionReason, rejectionDetails, redirectTo: '/enroll/resubmit' } : {}),
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: normalizedRole,
        phone: user.phone,
        profilePicture: user.profilePicture || '',
        kycStatus: normalizeKycStatus(user.kycStatus),
        rejectionReason: user.rejectionReason || '',
        kycSubmittedAt: user.kycSubmittedAt || null,
        isRestricted: user.isRestricted === true,
        restrictionType: normalizeRestrictionType(user.restrictionType, user.isRestricted === true),
        restrictionReason: user.restrictionReason || '',
        restrictionReviewStatus: user.verification_submission?.restrictionReviewStatus || 'not_requested',
        restrictionReviewReason: user.verification_submission?.restrictionReviewReason || '',
        verification_status: user.verification_status || 'approved',
        verification_rejection_reason: user.verification_rejection_reason || '',
        verification_rejection_details: rejectionDetails,
        status: actionRequired ? 'action_required' : pendingReview ? 'pending_review' : 'authenticated',
      },
    });
  } catch (err: any) {
    console.error('2FA verification error:', err);
    res.status(500).json({ error: errorMessage(err, 'Verification processing failed.') });
  }
});

// POST /api/auth/send-otp
const sendLoginOtp = async (req: import('express').Request, res: Response): Promise<void> => {
  try {
    const { tempToken, deliveryMethod, channel } = req.body || {};
    if (typeof tempToken !== 'string') {
      res.status(400).json({ error: 'Session token required.' });
      return;
    }
    if ((deliveryMethod ?? channel ?? 'email') !== 'email') {
      res.status(400).json({ error: 'Only email delivery is available for sign-in verification.' });
      return;
    }

    const payload = verifyTemp2FAToken(tempToken);
    if (!payload || payload.purpose !== 'login') {
      res.status(401).json({ error: 'Session expired. Please sign in again.' });
      return;
    }

    const user = await User.findOne({ id: payload.id }).lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const otpId = await issueLoginOtp(user);

    res.json({
      success: true,
      otpId,
      deliveryMethod: 'email',
      message: 'Verification code sent to your email.',
    });
  } catch (err: any) {
    console.error('Sign-in OTP email delivery failed:', err);
    res.status(503).json({ error: errorMessage(err, 'Unable to send a verification code. Please try again later.') });
  }
};
router.post('/send-otp', sendLoginOtp);
router.post('/resend-otp', sendLoginOtp);

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (isLocalDevEnabled() && req.user.id === getLocalDevUserId() && req.user.email === getLocalDevEmail()) {
      res.json({ user: {
        ...req.user,
        profilePicture: '',
        verification_status: 'approved',
      } });
      return;
    }
    const user = await User.findOne({ id: req.user.id }).select('id email full_name role isAdmin isRestricted restrictionType restrictionReason phone address profilePicture kycStatus rejectionReason kycSubmittedAt status enrollmentStatus lastCompletedStep enrollmentStep verification_status verification_rejection_reason verification_rejection_details verification_submission.restrictionReviewStatus verification_submission.restrictionReviewReason').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const enrollmentStatus = getEnrollmentStatus({
      status: user.status,
      enrollmentStatus: user.enrollmentStatus,
      verificationStatus: user.verification_status,
      kycStatus: user.kycStatus,
    });
    const verificationStatus = enrollmentStatus === 'incomplete'
      ? 'incomplete'
      : enrollmentStatus === 'action_required'
        ? 'rejected'
        : enrollmentStatus === 'pending_review'
          ? 'under_review'
          : user.verification_status || 'approved';
    res.json({
      user: {
        ...user,
        profilePicture: user.profilePicture || '',
        kycStatus: normalizeKycStatus(user.kycStatus),
        rejectionReason: user.rejectionReason || user.verification_rejection_reason || '',
        kycSubmittedAt: user.kycSubmittedAt || user.verification_submission?.submittedAt || null,
        restrictionType: normalizeRestrictionType(user.restrictionType, user.isRestricted === true),
        restrictionReviewStatus: user.verification_submission?.restrictionReviewStatus || 'not_requested',
        restrictionReviewReason: user.verification_submission?.restrictionReviewReason || '',
        role: isAdminRole(user.role, user.isAdmin) ? 'admin' : 'user',
        verification_status: verificationStatus,
        status: enrollmentStatus || user.verification_status || 'approved',
        ...(user.status === 'incomplete' || user.enrollmentStatus === 'incomplete'
          ? { lastCompletedStep: user.lastCompletedStep ?? user.enrollmentStep ?? 0, enrollmentStep: user.enrollmentStep }
          : {}),
        rejectionDetails: user.verification_rejection_details || [],
        verification_rejection_reason: user.verification_rejection_reason || '',
        verification_rejection_details: user.verification_rejection_details || [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve user profile.') });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('boa_token');
  res.json({ success: true, message: 'Successfully signed out from American Credit Union Financing .' });
});

// POST /api/auth/register
router.post('/register', async (req, res): Promise<void> => {
  res.setHeader('Content-Type', 'application/json');

  try {
    const { name, fullName, email, phone, address, password, passcode, securityPin, verificationNumber, sampleFile, verificationDocument, governmentIdUrl, userSelfie, selfieUrl } = req.body || {};
    const chosenName = String(name || fullName || '').trim();
    const chosenPassword = password || passcode;

    if (!chosenName || !email || !phone || !chosenPassword) {
      res.status(400).json({
        success: false,
        error: 'Please provide all required fields: name, email, phone, and password.'
      });
      return;
    }
    if (typeof chosenPassword !== 'string') {
      res.status(400).json({ success: false, error: 'Passcode must be provided as text.' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    let existingUser: any = null;
    try {
      existingUser = await User.findOne({ email: cleanEmail })
        .select('+password_hash +governmentIdUrl +selfieUrl id email full_name phone address status enrollmentStatus verification_status kycStatus lastCompletedStep enrollmentStep verification_submission')
        .lean<any>();
    } catch (checkErr) {
      console.error('Database query error checking existing enrollment:', checkErr);
      res.status(500).json({
        success: false,
        error: errorMessage(checkErr, 'Database error validating email uniqueness.'),
      });
      return;
    }
    if (existingUser) {
      const existingStatuses = [
        existingUser.status,
        existingUser.enrollmentStatus,
        existingUser.verification_status,
        existingUser.kycStatus,
      ]
        .filter((status): status is string => typeof status === 'string')
        .map((status) => status.trim().toLowerCase().replace(/[\s-]+/g, '_'));
      if (existingStatuses.some((status) => status === 'rejected' || status === 'action_required')) {
        res.status(409).json({
          success: false,
          code: 'KYC_RESUBMISSION_REQUIRED',
          error: 'An account with this email already exists and requires document re-submission. Please log in to complete your verification.',
          redirectTo: '/login',
        });
        return;
      }
      if (existingStatuses.includes('incomplete') && req.body?.resumeEnrollment !== true) {
        const savedStep = Number(existingUser.lastCompletedStep ?? existingUser.enrollmentStep);
        const resumeStep = Number.isInteger(savedStep) && savedStep >= 1 && savedStep < 3 ? savedStep + 1 : 1;
        res.status(409).json({
          success: false,
          code: 'ENROLLMENT_INCOMPLETE',
          error: 'An incomplete enrollment already exists for this email. Log in to continue where you left off.',
          lastCompletedStep: Number.isInteger(savedStep) && savedStep >= 0 ? savedStep : 0,
          redirectTo: `/enroll?step=${resumeStep}`,
        });
        return;
      }
      if (!existingStatuses.includes('incomplete')) {
        res.status(409).json({
          success: false,
          code: 'ACCOUNT_ALREADY_EXISTS',
          error: 'An online banking profile already exists for this email address. Please sign in.',
          redirectTo: '/login',
        });
        return;
      }
      if (typeof existingUser.password_hash !== 'string' || !await bcrypt.compare(chosenPassword, existingUser.password_hash)) {
        res.status(401).json({
          success: false,
          error: 'The Online ID or Passcode entered does not match our records.',
        });
        return;
      }
    }

    const existingSubmission = existingUser?.verification_submission;
    const submittedSampleFile = sampleFile || (existingSubmission ? {
      name: existingSubmission.sampleFileName,
      type: existingSubmission.sampleFileType,
      size: existingSubmission.sampleFileSize,
    } : null);
    const submittedGovernmentIdUrl = typeof governmentIdUrl === 'string' && governmentIdUrl
      ? governmentIdUrl
      : existingUser?.governmentIdUrl;
    const cleanVerificationNumber = typeof verificationNumber === 'string' && verificationNumber.trim()
      ? verificationNumber.trim()
      : String(existingSubmission?.verificationNumber || '').trim();
    const cleanFileName = typeof submittedSampleFile?.name === 'string' ? submittedSampleFile.name.trim().slice(0, 120) : '';
    const cleanFileType = typeof submittedSampleFile?.type === 'string' ? submittedSampleFile.type.trim().toLowerCase() : '';
    const sampleFileSize = Number(submittedSampleFile?.size);
    const legacyDocumentData = typeof verificationDocument?.data === 'string' ? verificationDocument.data : '';
    const legacyDocumentType = typeof verificationDocument?.contentType === 'string'
      ? verificationDocument.contentType.trim().toLowerCase()
      : '';
    const governmentIdMatch = typeof submittedGovernmentIdUrl === 'string'
      ? submittedGovernmentIdUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/)
      : null;
    const documentData = governmentIdMatch?.[2] || legacyDocumentData;
    const documentContentType = governmentIdMatch?.[1] || legacyDocumentType;
    if (!cleanVerificationNumber || cleanVerificationNumber.length > 100) {
      res.status(400).json({ success: false, error: 'Enter an identity verification value no longer than 100 characters.' });
      return;
    }
    if (!cleanFileName || !/^image\/(jpeg|png|webp|gif)$/.test(cleanFileType)
      || !Number.isInteger(sampleFileSize) || sampleFileSize <= 0 || sampleFileSize > 5 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'Choose a supporting image file (JPEG, PNG, WebP, or GIF) up to 5 MB.' });
      return;
    }
    if (documentContentType !== cleanFileType
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(documentData)) {
      res.status(400).json({ success: false, error: 'Upload a valid supporting image file (JPEG, PNG, WebP, or GIF).'});
      return;
    }
    const documentBuffer = Buffer.from(documentData, 'base64');
    if (documentBuffer.length !== sampleFileSize || documentBuffer.length > 5 * 1024 * 1024
      || documentBuffer.toString('base64') !== documentData) {
      res.status(400).json({ success: false, error: 'The supporting image must be no larger than 5 MB and match its uploaded file.' });
      return;
    }
    const submittedSelfieUrl = typeof selfieUrl === 'string' && selfieUrl
      ? selfieUrl
      : typeof userSelfie === 'string' && userSelfie
        ? userSelfie
        : existingUser?.selfieUrl;
    const selfieMatch = typeof submittedSelfieUrl === 'string'
      ? submittedSelfieUrl.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/)
      : null;
    if (!selfieMatch) {
      res.status(400).json({ success: false, error: 'Upload a valid verification selfie (JPEG, PNG, WebP, or GIF).'});
      return;
    }
    const selfieBuffer = Buffer.from(selfieMatch[2], 'base64');
    if (selfieBuffer.length <= 0 || selfieBuffer.length > 5 * 1024 * 1024
      || selfieBuffer.toString('base64') !== selfieMatch[2]) {
      res.status(400).json({ success: false, error: 'The verification selfie must be no larger than 5 MB.' });
      return;
    }

    if (typeof chosenPassword !== 'string' || chosenPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Passcode must be at least 6 characters in length.'
      });
      return;
    }

    const cleanName = String(fullName || chosenName).trim();
    const cleanPhone = String(phone).trim();
    const cleanAddress = typeof address === 'string' ? address.trim() : '';
    if (cleanAddress.length > 200) {
      res.status(400).json({ success: false, error: 'Residential or mailing address must be 200 characters or fewer.' });
      return;
    }
    const pin = securityPin ? String(securityPin).trim() : '1234';

    const userId = existingUser?.id || ('usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
    const passwordHash = bcrypt.hashSync(chosenPassword, 10);
    const createdAt = new Date().toISOString();
    const pinHash = bcrypt.hashSync(pin, 10);

    try {
      const userUpdates = {
        id: userId, email: cleanEmail, password_hash: passwordHash,
        full_name: cleanName, role: 'user', phone: cleanPhone,
        address: cleanAddress || existingUser?.address || '',
        security_pin: pinHash,
        verification_status: 'under_review',
        status: 'pending_review',
        enrollmentStatus: 'pending_review',
        lastCompletedStep: 3,
        enrollmentStep: 3,
        verification_rejection_reason: '',
        governmentIdUrl: governmentIdMatch
          ? submittedGovernmentIdUrl
          : `data:${documentContentType};base64,${documentData}`,
        selfieUrl: submittedSelfieUrl,
        kycStatus: 'PENDING_REVIEW',
        kycSubmittedAt: new Date(),
        restrictionType: 'KYC',
        userSelfieStatus: 'pending',
        verification_submission: {
          verificationNumber: cleanVerificationNumber,
          sampleFileName: cleanFileName,
          sampleFileType: cleanFileType,
          sampleFileSize,
          submittedAt: new Date(),
        },
        created_at: existingUser?.created_at || createdAt,
      };
      if (existingUser) {
        await User.updateOne({ id: userId, email: cleanEmail }, { $set: userUpdates }, { runValidators: true });
      } else {
        await User.create(userUpdates);
      }
    } catch (dbInsertErr: any) {
      console.error('MongoDB user insertion failed:', dbInsertErr);
      res.status(500).json({
        success: false,
        error: errorMessage(dbInsertErr, 'Could not complete user registration in database.')
      });
      return;
    }

    // 3. Generate unique 10-digit Account Number (safe loop with max attempts)
    let accNum = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 15) {
      attempts++;
      accNum = '48' + Math.floor(10000000 + Math.random() * 90000000).toString();
      isUnique = !(await Account.exists({ account_number: accNum }));
    }
    if (!accNum || !isUnique) {
      accNum = '48' + Date.now().toString().slice(-8);
    }

    const accountId = 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const savingsAccountId = `acc_${randomUUID()}`;
    const routingNumber = '026009593';
    let savingsAccountNumber = '';
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = `48${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
      if (!(await Account.exists({ account_number: candidate }))) {
        savingsAccountNumber = candidate;
        break;
      }
    }
    if (!savingsAccountNumber) {
      res.status(503).json({ success: false, error: 'Could not reserve a unique savings account number. Please try again.' });
      return;
    }

    // 4. Create primary Advantage Plus Checking Account (with try/catch)
    try {
      const existingAccounts = await Account.find({ user_id: userId, account_type: { $in: ['Checking', 'Savings'] } }).lean<any[]>();
      const checkingAccount = existingAccounts.find((account) => account.account_type === 'Checking');
      const savingsAccount = existingAccounts.find((account) => account.account_type === 'Savings');
      if (checkingAccount) accNum = checkingAccount.account_number;
      if (!checkingAccount) {
        await Account.create({
          id: accountId, user_id: userId, account_number: accNum,
          account_type: 'Checking', nickname: 'Advantage Plus Checking',
          balance: 0, currency: 'USD', routing_number: routingNumber,
          status: 'Active', created_at: createdAt,
        });
      }
      if (!savingsAccount) {
        await Account.create({
          id: savingsAccountId, user_id: userId, account_number: savingsAccountNumber,
          account_type: 'Savings', nickname: 'Advantage Savings',
          balance: 0, currency: 'USD', routing_number: routingNumber,
          interest_rate: 0.015, accrued_interest: 0, last_interest_accrual_date: '',
          status: 'Active', created_at: createdAt,
        });
      }
      await User.updateOne({ id: userId }, { $set: { account_number: accNum } });
    } catch (accErr: any) {
      console.error('MongoDB account insertion error:', accErr);
      await Account.deleteMany({ user_id: userId, created_at: createdAt });
      if (!existingUser) await User.deleteOne({ id: userId });
      res.status(500).json({
        success: false,
        error: errorMessage(accErr, 'Failed to open the initial checking account.')
      });
      return;
    }

    // 5. Record initial ledger audit log (non-fatal try/catch)
    try {
      const auditId = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      await AuditLog.create({
        id: auditId, admin_id: 'system', admin_email: 'system@americancreditunion.financing',
        action: 'ACCOUNT_OPENED', target_user_id: userId, target_account_id: accountId,
        amount: 0, details: 'Self-service online registration and Advantage Checking opened ($0.00 USD)',
        created_at: createdAt,
      });
    } catch (auditErr) {
      console.warn('Non-fatal audit log error during registration:', auditErr);
    }

    // New enrollments remain locked out until an administrator approves the submission.
    res.status(201).json({
      success: true,
      message: 'Your enrollment has been submitted for administrator review.',
      user: {
        id: userId,
        email: cleanEmail,
        name: cleanName,
        full_name: cleanName,
        role: 'user',
        phone: cleanPhone,
        address: cleanAddress,
        verification_status: 'under_review',
        kycStatus: 'PENDING_REVIEW',
        kycSubmittedAt: new Date(),
        restrictionType: 'KYC',
      },
      account: {
        id: accountId,
        account_number: accNum,
        routing_number: routingNumber,
        account_type: 'Checking',
        nickname: 'Advantage Plus Checking',
        balance: 0.00,
        currency: 'USD',
        status: 'Active',
      }
    });
  } catch (err: any) {
    console.error('Registration processing unexpected error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : errorMessage(err, 'Failed to process online registration. Please try again later.')
      });
    }
  }
});

export default router;
