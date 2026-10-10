import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Account, AuditLog, Grant, Transaction, User } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { AuthenticatedRequest, requireAdmin, requireApprovedUser } from '../auth.js';

const router = Router();
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BASE64_LENGTH = Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 + 100;
const ALLOWED_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const GRANT_CATEGORIES = new Set([
  'Small Business Expansion',
  'Community Project',
  'Tech/Innovation',
  'Emergency Business Relief',
]);
const GRANT_STATUSES = new Set(['UNDER COMMITTEE EVALUATION', 'APPROVED', 'REJECTED']);

const isValidGrantDocument = (data: unknown, contentType: unknown): data is string => {
  if (typeof data !== 'string' || typeof contentType !== 'string' || !ALLOWED_DOCUMENT_TYPES.has(contentType)) return false;
  const prefix = `data:${contentType};base64,`;
  if (!data.startsWith(prefix)) return false;
  const encoded = data.slice(prefix.length);
  if (!encoded || encoded.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return false;
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > MAX_DOCUMENT_BYTES) return false;
  if (contentType === 'application/pdf') return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
};

router.use(requireDatabase);

router.post('/apply', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      businessName,
      category,
      requestedAmount,
      purpose,
      implementationPlan,
      projectedTimeline,
      documentBase64,
      documentName,
      documentContentType,
    } = req.body || {};
    const cleanBusinessName = typeof businessName === 'string' ? businessName.trim() : '';
    const cleanPurpose = typeof purpose === 'string' ? purpose.trim() : '';
    const cleanPlan = typeof implementationPlan === 'string' ? implementationPlan.trim() : '';
    const cleanTimeline = typeof projectedTimeline === 'string' ? projectedTimeline.trim() : '';
    const cleanDocumentName = typeof documentName === 'string' ? documentName.trim() : '';
    const amount = Number(requestedAmount);

    if (!cleanBusinessName || cleanBusinessName.length > 120
      || !GRANT_CATEGORIES.has(category)
      || !Number.isFinite(amount) || amount <= 0 || amount > 5_000_000
      || !cleanPurpose || cleanPurpose.length > 3000
      || !cleanPlan || cleanPlan.length > 3000
      || !cleanTimeline || cleanTimeline.length > 200
      || !cleanDocumentName || cleanDocumentName.length > 120
      || !isValidGrantDocument(documentBase64, documentContentType)
      || documentBase64.length > MAX_DOCUMENT_BASE64_LENGTH
    ) {
      res.status(400).json({ error: 'Complete all required grant application fields, request no more than $5,000,000, and attach a PDF or image under 5 MB.' });
      return;
    }

    const id = `grant_${randomUUID()}`;
    const grant = await Grant.create({
      id,
      userId: req.user!.id,
      businessName: cleanBusinessName,
      category,
      requestedAmount: amount,
      purpose: cleanPurpose,
      implementationPlan: cleanPlan,
      projectedTimeline: cleanTimeline,
      documentBase64,
      documentName: cleanDocumentName,
      documentContentType,
      status: 'PENDING REVIEW',
      submittedAt: new Date(),
    });

    res.status(201).json({
      application: {
        id: grant.id,
        businessName: grant.businessName,
        category: grant.category,
        requestedAmount: grant.requestedAmount,
        status: grant.status,
        submittedAt: grant.submittedAt,
        adminNotes: grant.adminNotes,
      },
    });
  } catch (err) {
    console.error('Grant application submission failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to submit the grant application.') });
  }
});

router.get('/user', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const applications = await Grant.find({ userId: req.user!.id })
      .select('-documentBase64')
      .sort({ submittedAt: -1 })
      .lean();
    res.json({ applications });
  } catch (err) {
    console.error('Grant application lookup failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to load grant applications.') });
  }
});

router.get('/admin/all', requireAdmin, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const applications = await Grant.find({}).sort({ submittedAt: -1 }).select('+documentBase64').lean<any[]>();
    const users = await User.find({ id: { $in: [...new Set(applications.map((application) => application.userId))] } })
      .select('id full_name email')
      .lean<any[]>();
    const usersById = new Map(users.map((user) => [user.id, user]));
    res.json({
      applications: applications.map((application) => ({
        ...application,
        applicantName: usersById.get(application.userId)?.full_name || 'Member',
        applicantEmail: usersById.get(application.userId)?.email || '',
      })),
    });
  } catch (err) {
    console.error('Admin grant application lookup failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to load grant applications for review.') });
  }
});

router.put('/admin/:id/status', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, adminNotes, rejectionReason, approvedAmount } = req.body || {};
    const notes = typeof adminNotes === 'string' ? adminNotes.trim() : '';
    const reason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
    const amount = Number(approvedAmount);
    if (!GRANT_STATUSES.has(status) || notes.length > 1000
      || (status === 'REJECTED' && (!reason || reason.length > 1000))
      || (status === 'APPROVED' && (!Number.isFinite(amount) || amount <= 0))) {
      res.status(400).json({ error: 'Provide a valid grant status, rejection reason, approval amount, and review notes.' });
      return;
    }

    const session = await mongoose.startSession();
    try {
      let updatedGrant: any = null;
      await session.withTransaction(async () => {
        const grant = await Grant.findOne({
          id: req.params.id,
          status: { $in: ['PENDING REVIEW', 'UNDER COMMITTEE EVALUATION'] },
        }).session(session).lean<any>();
        if (!grant) throw new Error('Grant application not found or no longer available for review.');
        if (status === 'APPROVED' && amount > grant.requestedAmount) {
          throw new Error('The approved amount cannot exceed the requested amount.');
        }

        const fields: Record<string, unknown> = {
          status,
          adminNotes: notes,
          reviewedAt: new Date(),
          reviewedBy: req.user!.id,
        };
        if (status === 'APPROVED') fields.approvedAmount = amount;
        if (status === 'REJECTED') fields.rejectionReason = reason;
        updatedGrant = await Grant.findOneAndUpdate(
          { id: grant.id, status: { $in: ['PENDING REVIEW', 'UNDER COMMITTEE EVALUATION'] } },
          { $set: fields },
          { new: true, session },
        ).lean<any>();
        if (!updatedGrant) throw new Error('Grant application was updated by another reviewer. Refresh and try again.');
        await AuditLog.create([{
          id: `log_grant_${randomUUID()}`,
          admin_id: req.user!.id,
          admin_email: req.user!.email,
          action: `GRANT_${status.replaceAll(' ', '_')}`,
          target_user_id: grant.userId,
          amount: status === 'APPROVED' ? amount : grant.requestedAmount,
          details: `${status} grant ${grant.id} for ${grant.businessName}. ${status === 'REJECTED' ? reason : notes || 'No additional notes.'}`,
          ip_address: req.ip || '127.0.0.1',
          created_at: new Date().toISOString(),
        }], { session });
      });
      res.json({ application: updatedGrant });
    } catch (err) {
      res.status(400).json({ error: errorMessage(err, 'Unable to update grant status.') });
    } finally {
      await session.endSession();
    }
  } catch (err) {
    console.error('Grant review update failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to update grant status.') });
  }
});

router.post('/admin/:id/disburse', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    let result: { applicationId: string; transactionId: string; amount: number } | null = null;
    await session.withTransaction(async () => {
      const grant = await Grant.findOne({ id: req.params.id, status: 'APPROVED', disbursedAt: null })
        .session(session).lean<any>();
      if (!grant || !Number.isFinite(grant.approvedAmount) || grant.approvedAmount <= 0) {
        throw new Error('Only approved grants with a valid award can be disbursed.');
      }
      const accounts = await Account.find({ user_id: grant.userId, status: 'Active' })
        .session(session).lean<any[]>();
      accounts.sort((left, right) => {
        const rank = (account: any) => account.account_type === 'Checking' ? 0 : account.account_type === 'Savings' ? 1 : 2;
        return rank(left) - rank(right) || Number(left.created_at) - Number(right.created_at);
      });
      const account = accounts[0];
      if (!account) throw new Error('The applicant has no active account to receive the grant.');

      const transactionId = `tx_grant_${randomUUID()}`;
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const changedGrant = await Grant.findOneAndUpdate(
        { id: grant.id, status: 'APPROVED', disbursedAt: null },
        { $set: { status: 'DISBURSED', disbursedAt: now, transactionId } },
        { new: true, session },
      ).lean<any>();
      if (!changedGrant) throw new Error('Grant has already been disbursed or its status changed.');

      const creditedAccount = await Account.findOneAndUpdate(
        { id: account.id, user_id: grant.userId, status: 'Active' },
        { $inc: { balance: grant.approvedAmount } },
        { new: true, session },
      ).lean<any>();
      if (!creditedAccount) throw new Error('The selected receiving account is no longer active.');

      await Transaction.create([{
        id: transactionId,
        user_id: grant.userId,
        account_id: account.id,
        type: 'deposit',
        amount: grant.approvedAmount,
        currency: 'USD',
        description: 'Community Grant Disbursement',
        recipient_name: grant.businessName,
        status: 'Completed',
        category: 'Grant',
        date: today,
        created_at: Date.now(),
      }], { session });
      await AuditLog.create([{
        id: `log_grant_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: 'GRANT_DISBURSED',
        target_user_id: grant.userId,
        target_account_id: account.id,
        amount: grant.approvedAmount,
        details: `Disbursed grant ${grant.id} to account ${account.id}.`,
        ip_address: req.ip || '127.0.0.1',
        created_at: now.toISOString(),
      }], { session });
      result = { applicationId: grant.id, transactionId, amount: grant.approvedAmount };
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Grant disbursement failed:', err);
    res.status(400).json({ error: errorMessage(err, 'Unable to disburse grant funds.') });
  } finally {
    await session.endSession();
  }
});

export default router;
