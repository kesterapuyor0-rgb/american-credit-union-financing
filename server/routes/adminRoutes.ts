import { Router, Response } from 'express';
import { randomInt, randomUUID } from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Account, Transaction, AuditLog, BankCard, CardApplication } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireAdmin, AuthenticatedRequest, isAdminRole } from '../auth.js';
import { maskedCardNumber, numericCardLastFour } from '../cardNumber.js';
import { createNotification } from '../notifications.js';

const router = Router();

router.use(requireDatabase);
router.use(requireAdmin);

const transferDebitAmount = (transaction: any): number =>
  Math.abs(Number(transaction.amount) || 0)
  + Math.max(0, Number(transaction.transfer_fee) || 0)
  + Math.max(0, Number(transaction.transfer_tax) || 0);

const reviewPendingTransaction = async (
  transactionId: string,
  decision: 'approve' | 'reject',
  reason: string,
  req: AuthenticatedRequest,
): Promise<any> => {
  const session = await mongoose.startSession();
  try {
    let response: any;
    await session.withTransaction(async () => {
      const transaction = await Transaction.findOne({ id: transactionId, status: /^pending$/i }).session(session).lean<any>();
      if (!transaction) throw new Error('Pending transaction not found or already reviewed.');

      const related = transaction.related_transaction_id
        ? await Transaction.findOne({ id: transaction.related_transaction_id }).session(session).lean<any>()
        : null;
      if (transaction.related_transaction_id && (!related || !/^pending$/i.test(related.status))) {
        throw new Error('The paired transfer is no longer pending.');
      }

      if (decision === 'approve') {
        const type = String(transaction.type || '').toLowerCase();
        if (type === 'transfer_out' || type === 'transfer_in') {
          if (related) {
            const outgoing = type === 'transfer_out' ? transaction : related;
            const incoming = type === 'transfer_in' ? transaction : related;
            if (String(outgoing.type).toLowerCase() !== 'transfer_out'
              || String(incoming.type).toLowerCase() !== 'transfer_in'
              || outgoing.related_transaction_id !== incoming.id
              || incoming.related_transaction_id !== outgoing.id
              || Math.abs(outgoing.amount) !== Math.abs(incoming.amount)) {
              throw new Error('The paired transfer records are invalid.');
            }
            const debited = await Account.findOneAndUpdate({
              id: outgoing.account_id,
              user_id: outgoing.user_id,
              status: 'Active',
              $expr: { $and: [
                { $gte: [{ $ifNull: ['$balance', 0] }, transferDebitAmount(outgoing)] },
                { $gte: [{ $ifNull: ['$held_balance', 0] }, transferDebitAmount(outgoing)] },
              ] },
            }, { $inc: { balance: -transferDebitAmount(outgoing), held_balance: -transferDebitAmount(outgoing) } }, { new: true, session }).lean<any>();
            if (!debited) throw new Error('The reserved transfer funds are no longer available.');
            const credited = await Account.findOneAndUpdate({
              id: incoming.account_id,
              user_id: incoming.user_id,
              status: 'Active',
            }, { $inc: { balance: Math.abs(incoming.amount) } }, { new: true, session }).lean<any>();
            if (!credited) throw new Error('Transfer destination is no longer active.');
          } else if (type === 'transfer_out') {
            const debited = await Account.findOneAndUpdate({
              id: transaction.account_id,
              user_id: transaction.user_id,
              status: 'Active',
              $expr: { $and: [
                { $gte: [{ $ifNull: ['$balance', 0] }, transferDebitAmount(transaction)] },
                { $gte: [{ $ifNull: ['$held_balance', 0] }, transferDebitAmount(transaction)] },
              ] },
            }, { $inc: { balance: -transferDebitAmount(transaction), held_balance: -transferDebitAmount(transaction) } }, { new: true, session }).lean<any>();
            if (!debited) throw new Error('The reserved transfer funds are no longer available.');
          } else {
            throw new Error('An incoming transfer must have its paired outgoing transaction.');
          }
        } else if (type === 'deposit') {
          const credited = await Account.findOneAndUpdate(
            { id: transaction.account_id, user_id: transaction.user_id, status: 'Active' },
            { $inc: { balance: Math.abs(transaction.amount) } }, { new: true, session },
          ).lean<any>();
          if (!credited) throw new Error('Transaction account is no longer active.');
        } else if (type === 'withdrawal' || type === 'payment' || type === 'card_debit') {
          const debited = await Account.findOneAndUpdate({
            id: transaction.account_id,
            user_id: transaction.user_id,
            status: 'Active',
            $expr: { $gte: [
              { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
              Math.abs(transaction.amount),
            ] },
          }, { $inc: { balance: -Math.abs(transaction.amount) } }, { new: true, session }).lean<any>();
          if (!debited) throw new Error('Transaction account has insufficient available balance.');
        } else {
          throw new Error(`Approval is not configured for transaction type ${transaction.type}.`);
        }
      }

      if (decision === 'reject' && ['transfer_out', 'transfer_in'].includes(String(transaction.type || '').toLowerCase())) {
        const outgoing = String(transaction.type).toLowerCase() === 'transfer_out' ? transaction : related;
        if (!outgoing || String(outgoing.type).toLowerCase() !== 'transfer_out') {
          throw new Error('The paired outgoing transfer could not be found.');
        }
        const released = await Account.findOneAndUpdate({
          id: outgoing.account_id,
          user_id: outgoing.user_id,
          held_balance: { $gte: transferDebitAmount(outgoing) },
        }, { $inc: { held_balance: -transferDebitAmount(outgoing) } }, { new: true, session }).lean<any>();
        if (!released) throw new Error('The reserved transfer amount could not be released.');
      }

      const nextStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';
      const reviewFields = { status: nextStatus, reviewed_at: new Date(), reviewed_by: req.user!.id, review_reason: reason };
      await Transaction.updateOne({ id: transaction.id, status: /^pending$/i }, { $set: reviewFields }, { session });
      if (related) await Transaction.updateOne({ id: related.id, status: /^pending$/i }, { $set: reviewFields }, { session });
      await AuditLog.create([{
        id: `log_tx_review_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: `TRANSACTION_${decision.toUpperCase()}`,
        target_user_id: transaction.user_id,
        target_account_id: transaction.account_id,
        amount: String(transaction.type).toLowerCase() === 'transfer_out'
          ? transferDebitAmount(transaction)
          : Math.abs(transaction.amount),
        details: `${decision === 'approve' ? 'Approved' : 'Rejected'} ${transaction.type} transaction ${transaction.id}${Number(transaction.transfer_fee) + Number(transaction.transfer_tax) > 0 ? ` including $${Number(transaction.transfer_fee).toFixed(2)} wire fee and $${Number(transaction.transfer_tax).toFixed(2)} tax` : ''}. Reason: ${reason}`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
      const transactionType = String(transaction.type || '').toLowerCase();
      const isTransfer = transactionType === 'transfer_out' || transactionType === 'transfer_in';
      const isDeposit = transactionType === 'deposit';
      const notificationAmount = transactionType === 'transfer_out'
        ? transferDebitAmount(transaction)
        : Math.abs(Number(transaction.amount) || 0);
      const notificationName = transaction.recipient_name || 'your account';
      await createNotification({
        userId: transaction.user_id,
        title: isDeposit
          ? `Deposit ${decision === 'approve' ? 'Approved' : 'Rejected'}`
          : isTransfer
            ? `Transfer ${decision === 'approve' ? 'Approved' : 'Rejected'}`
            : `Transaction ${decision === 'approve' ? 'Approved' : 'Rejected'}`,
        message: isDeposit
          ? decision === 'approve'
            ? `$${notificationAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD has been credited to your account.`
            : `Your $${notificationAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD deposit was not approved.`
          : isTransfer
            ? `$${notificationAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD ${decision === 'approve' ? 'to' : 'for'} ${notificationName} was ${decision === 'approve' ? 'approved' : 'not approved'}.${reason ? ` ${reason}` : ''}`
            : `Your ${transactionType.replace(/_/g, ' ')} of $${notificationAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD was ${decision === 'approve' ? 'approved' : 'not approved'}.${reason ? ` ${reason}` : ''}`,
        type: isDeposit ? 'deposit' : isTransfer ? 'transfer' : 'activity',
        category: isDeposit ? 'deposit' : isTransfer ? 'transfer' : 'activity',
        link: 'history',
      }, session);
      response = { transactionId: transaction.id, status: nextStatus, relatedTransactionId: related?.id || null };
    });
    return response;
  } finally {
    await session.endSession();
  }
};

// POST /api/admin/create-admin
// Creates an administrator using an existing administrator session.
router.post('/create-admin', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { email, password, passcode, fullName, phone } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || passcode || '');
    const cleanName = String(fullName || 'Administrator').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanEmail || !cleanPassword || !cleanName || !cleanPhone) {
      res.status(400).json({ error: 'Email, passcode, full name, and phone are required.' });
      return;
    }
    if (cleanPassword.length < 6) {
      res.status(400).json({ error: 'Passcode must be at least 6 characters.' });
      return;
    }
    if (await User.exists({ email: cleanEmail })) {
      res.status(409).json({ error: 'An account already exists for this email.' });
      return;
    }

    const id = 'usr_admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    await User.create({
      id, email: cleanEmail, password_hash: bcrypt.hashSync(cleanPassword, 10),
      full_name: cleanName, role: 'ADMIN', phone: cleanPhone, created_at: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      admin: { id, email: cleanEmail, full_name: cleanName, role: 'ADMIN', phone: cleanPhone },
    });
  } catch (err: any) {
    console.error('Admin creation error:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to create administrator account.') });
  }
});

// GET /api/admin/overview
router.get('/overview', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [totalUsers, totalAccounts, deposits, totalTransactions, pendingTransactions, totalAuditLogs] = await Promise.all([
      User.countDocuments({ role: /^user$/i }), Account.countDocuments(),
      Account.aggregate([
        { $match: { account_type: { $ne: 'Credit Card' } } },
        { $group: { _id: null, sum: { $sum: { $max: [0, { $subtract: ['$balance', { $ifNull: ['$held_balance', 0] }] }] } } } },
      ]),
      Transaction.countDocuments(), Transaction.countDocuments({ status: /^pending$/i }), AuditLog.countDocuments(),
    ]);

    res.json({
      overview: {
        totalUsers,
        totalAccounts,
        totalDepositsUSD: deposits[0]?.sum || 0,
        totalTransactions,
        pendingTransactions,
        totalAuditLogs,
        systemStatus: 'Operational',
        databaseEngine: 'MongoDB Atlas',
      },
    });
  } catch (err: any) {
    console.error('Error fetching admin overview:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to fetch admin overview.') });
  }
});

// GET /api/admin/users
router.get('/users', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;

    let filter: Record<string, any> = {};
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const [matchingAccounts, matchingUsers] = await Promise.all([
        Account.find({ account_number: new RegExp(term, 'i') }).select('user_id').lean<any[]>(),
        User.find({ $or: [{ email: new RegExp(term, 'i') }, { full_name: new RegExp(term, 'i') }] }).select('id').lean<any[]>(),
      ]);
      filter = { id: { $in: [...new Set([...matchingAccounts.map((a) => a.user_id), ...matchingUsers.map((u) => u.id)])] } };
    }

    const users = await User.find(filter).select('id email full_name role isAdmin isRestricted restrictionReason phone verification_status verification_rejection_reason created_at').sort({ created_at: -1 }).lean<any[]>();
    const allAccounts = await Account.find({ user_id: { $in: users.map((u) => u.id) } }).sort({ account_type: 1 }).lean<any[]>();
    const accountsByUser = new Map<string, any[]>();
    for (const account of allAccounts) accountsByUser.set(account.user_id, [...(accountsByUser.get(account.user_id) || []), account]);
    const usersWithAccounts = users.map((u) => {
      const accounts = accountsByUser.get(u.id) || [];
      const totalBalanceUSD = accounts
        .filter((a) => a.account_type !== 'Credit Card')
        .reduce((sum, a) => sum + Math.max(0, a.balance - (a.held_balance || 0)), 0);

      return {
        ...u,
        verification_status: u.verification_status || 'approved',
        verification_rejection_reason: u.verification_rejection_reason || '',
        accounts,
        totalBalanceUSD,
        availableBalanceUSD: totalBalanceUSD,
      };
    });

    res.json({ users: usersWithAccounts });
  } catch (err: any) {
    console.error('Error fetching users for admin:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve users.') });
  }
});

// GET /api/admin/verifications — customer enrollment profiles and submitted documents.
router.get('/verifications', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const applicants = await User.find({ role: { $ne: 'admin' }, isAdmin: { $ne: true } })
      .select('id email full_name phone created_at verification_status verification_rejection_reason verification_submission verificationDocument documentUrl')
      .sort({ created_at: -1 })
      .lean<any[]>();
    res.json({
      applicants: applicants.map((applicant) => ({
        ...applicant,
        verification_status: applicant.verification_status || 'approved',
        verification_rejection_reason: applicant.verification_rejection_reason || '',
      })),
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Failed to load enrollment records.') });
  }
});

// PATCH /api/admin/users/:userId/verification-status
router.patch('/users/:userId/verification-status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = String(req.params.userId || '').trim();
  const status = String(req.body?.verificationStatus || '').trim();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!userId || !['under_review', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Choose a valid enrollment status.' });
    return;
  }
  if (status === 'rejected' && !reason) {
    res.status(400).json({ error: 'A rejection reason is required.' });
    return;
  }
  if (reason.length > 500) {
    res.status(400).json({ error: 'Decision reason must be 500 characters or fewer.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let updatedUser: any;
    await session.withTransaction(async () => {
      const set: Record<string, unknown> = {
        verification_status: status,
        verification_rejection_reason: status === 'rejected' ? reason : '',
      };
      if (status !== 'under_review') set.verification_reviewed_at = new Date();
      updatedUser = await User.findOneAndUpdate(
        { id: userId, role: { $ne: 'admin' }, isAdmin: { $ne: true } },
        {
          $set: set,
          ...(status === 'under_review' ? { $unset: { verification_reviewed_at: 1 } } : {}),
        },
        { new: true, session, runValidators: true },
      ).select('id email full_name verification_status verification_rejection_reason').lean<any>();
      if (!updatedUser) throw new Error('Customer profile not found.');

      await AuditLog.create([{
        id: `log_enrollment_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: `ENROLLMENT_STATUS_${status.toUpperCase()}`,
        target_user_id: userId,
        details: `Set enrollment status to ${status} for ${updatedUser.email}.${status === 'rejected' ? ` Reason: ${reason}` : ''}`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
    });
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    const message = errorMessage(err, 'Unable to update enrollment status.');
    res.status(message === 'Customer profile not found.' ? 404 : 500).json({ error: message });
  } finally {
    await session.endSession();
  }
});

// POST /api/admin/verifications/:userId/decision
router.post('/verifications/:userId/decision', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = String(req.params.userId || '').trim();
  const decision = String(req.body?.decision || '').trim().toLowerCase();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!userId || !['approve', 'reject'].includes(decision)) {
    res.status(400).json({ error: 'Choose an applicant and a valid approve or reject decision.' });
    return;
  }
  if (decision === 'reject' && !reason) {
    res.status(400).json({ error: 'A rejection reason is required.' });
    return;
  }
  if (reason.length > 500) {
    res.status(400).json({ error: 'Decision reason must be 500 characters or fewer.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let reviewedUser: any;
    await session.withTransaction(async () => {
      reviewedUser = await User.findOneAndUpdate(
        { id: userId, verification_status: 'under_review' },
        {
          $set: {
            verification_status: decision === 'approve' ? 'approved' : 'rejected',
            verification_rejection_reason: decision === 'reject' ? reason : '',
            verification_reviewed_at: new Date(),
          },
        },
        { new: true, session, runValidators: true },
      ).select('id email full_name verification_status verification_rejection_reason').lean<any>();
      if (!reviewedUser) throw new Error('Applicant not found or already reviewed.');

      await AuditLog.create([{
        id: `log_verification_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: decision === 'approve' ? 'ENROLLMENT_VERIFICATION_APPROVED' : 'ENROLLMENT_VERIFICATION_REJECTED',
        target_user_id: userId,
        details: `${decision === 'approve' ? 'Approved' : 'Rejected'} enrollment verification for ${reviewedUser.email}.${decision === 'reject' ? ` Reason: ${reason}` : ''}`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
    });
    res.json({ success: true, user: reviewedUser });
  } catch (err) {
    const message = errorMessage(err, 'Unable to record the verification decision.');
    res.status(message.includes('not found or already reviewed') ? 409 : 500).json({ error: message });
  } finally {
    await session.endSession();
  }
});

// PATCH /api/admin/users/:userId/restriction
router.patch('/users/:userId/restriction', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = String(req.params.userId || '').trim();
  const { isRestricted, restrictionReason } = req.body || {};
  if (!userId || typeof isRestricted !== 'boolean' || typeof restrictionReason !== 'string') {
    res.status(400).json({ error: 'A user, restriction status, and reason are required.' });
    return;
  }

  const cleanReason = restrictionReason.trim();
  if (cleanReason.length > 500) {
    res.status(400).json({ error: 'Restriction reason must be 500 characters or fewer.' });
    return;
  }
  if (isRestricted && !cleanReason) {
    res.status(400).json({ error: 'Enter a reason before restricting this account.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let updatedUser: any = null;
    await session.withTransaction(async () => {
      const targetUser = await User.findOne({ id: userId }).select('id role isAdmin').session(session).lean<any>();
      if (!targetUser) throw new Error('USER_NOT_FOUND');
      if (isAdminRole(targetUser.role, targetUser.isAdmin)) throw new Error('ADMIN_RESTRICTION_NOT_ALLOWED');

      updatedUser = await User.findOneAndUpdate(
        { id: userId },
        { $set: { isRestricted, restrictionReason: cleanReason } },
        { new: true, runValidators: true, session },
      ).select('id isRestricted restrictionReason').lean<any>();

      await AuditLog.create([{
        id: `log_restriction_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: isRestricted ? 'USER_RESTRICTED' : 'USER_UNRESTRICTED',
        target_user_id: userId,
        details: `${isRestricted ? 'Restricted' : 'Unrestricted'} customer account. Reason: ${cleanReason || '(cleared)'}`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
    });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (error instanceof Error && error.message === 'ADMIN_RESTRICTION_NOT_ALLOWED') {
      res.status(400).json({ error: 'Administrator accounts cannot be restricted here.' });
      return;
    }
    console.error('Unable to update user restriction:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to update account restriction.') });
  } finally {
    await session.endSession();
  }
});

// GET /api/admin/accounts
router.get('/accounts', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    let accountFilter: Record<string, any> = {};
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUsers = await User.find({ $or: [{ email: new RegExp(term, 'i') }, { full_name: new RegExp(term, 'i') }] }).select('id').lean<any[]>();
      accountFilter = { $or: [{ account_number: new RegExp(term, 'i') }, { user_id: { $in: matchingUsers.map((u) => u.id) } }] };
    }

    const rows = await Account.find(accountFilter).sort({ created_at: -1 }).lean<any[]>();
    const owners = await User.find({ id: { $in: rows.map((a) => a.user_id) } }).select('id full_name email').lean<any[]>();
    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
    const accounts = rows.map((account) => ({ ...account, owner_name: ownersById.get(account.user_id)?.full_name, owner_email: ownersById.get(account.user_id)?.email }));
    res.json({ accounts });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve accounts.') });
  }
});

// GET /api/admin/card-applications
router.get('/card-applications', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await CardApplication.find().sort({ created_at: -1 }).lean<any[]>();
    const [owners, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.user_id) } }).select('id full_name email').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.account_id) } }).select('id nickname account_number').lean<any[]>(),
    ]);
    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    res.json({ applications: rows.map((application) => ({
      ...application,
      customer_name: ownersById.get(application.user_id)?.full_name || 'Unknown customer',
      customer_email: ownersById.get(application.user_id)?.email || '',
      account_number: accountsById.get(application.account_id)?.account_number || '',
      account_nickname: accountsById.get(application.account_id)?.nickname || '',
    })) });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Failed to load card applications.') });
  }
});

// POST /api/admin/card-applications/decision
router.post('/card-applications/decision', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const applicationId = String(req.body?.applicationId || '').trim();
  const decision = String(req.body?.decision || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  if (!applicationId || !['approve', 'reject'].includes(decision) || !reason) {
    res.status(400).json({ error: 'Choose approve or reject and enter a review reason.' });
    return;
  }
  if (reason.length > 500) {
    res.status(400).json({ error: 'Review reasons must be 500 characters or fewer.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let reviewedApplication: any;
    let issuedCard: any = null;
    await session.withTransaction(async () => {
      reviewedApplication = await CardApplication.findOneAndUpdate(
        { id: applicationId, status: 'Pending' },
        { $set: {
          status: decision === 'approve' ? 'Approved' : 'Rejected',
          reviewed_at: new Date(), reviewed_by: req.user!.id, review_reason: reason,
        } },
        { new: true, session }
      ).lean<any>();
      if (!reviewedApplication) throw new Error('This application has already been reviewed or does not exist.');

      if (decision === 'approve') {
        const linkedAccount = await Account.findOne({
          id: reviewedApplication.account_id,
          user_id: reviewedApplication.user_id,
          account_type: 'Checking',
          status: 'Active',
        }).session(session).lean<any>();
        if (!linkedAccount) throw new Error('The linked checking account is no longer active.');
        const last4 = String(randomInt(0, 10000)).padStart(4, '0');
        issuedCard = {
          id: `card_${randomUUID()}`,
          application_id: reviewedApplication.id,
          user_id: reviewedApplication.user_id,
          account_id: reviewedApplication.account_id,
          card_type: reviewedApplication.card_type,
          network: reviewedApplication.network || 'Visa',
          product_name: reviewedApplication.product_name,
          last4,
          masked_number: maskedCardNumber(reviewedApplication.network || 'Visa', last4),
          status: 'Active',
          credit_limit: reviewedApplication.card_type === 'Credit' ? reviewedApplication.requested_limit : 0,
          created_at: new Date(),
        };
        await BankCard.create([issuedCard], { session });
        await CardApplication.updateOne({ id: applicationId }, { $set: { card_id: issuedCard.id } }, { session });
      }

      await AuditLog.create([{
        id: `log_card_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: decision === 'approve' ? 'CARD_APPLICATION_APPROVED' : 'CARD_APPLICATION_REJECTED',
        target_user_id: reviewedApplication.user_id,
        target_account_id: reviewedApplication.account_id,
        amount: reviewedApplication.requested_limit || undefined,
        details: `${decision === 'approve' ? 'Approved' : 'Rejected'} ${reviewedApplication.product_name} application ${applicationId}. Review reason: ${reason}`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
    });
    res.json({ success: true, application: reviewedApplication, card: issuedCard });
  } catch (err) {
    const message = errorMessage(err, 'Unable to review card application.');
    res.status(message.includes('already been reviewed') || message.includes('no longer active') ? 409 : 500)
      .json({ error: message });
  } finally {
    await session.endSession();
  }
});

// POST /api/admin/balance-adjustment
router.post('/balance-adjustment', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const accountId = String(req.body?.accountId || '').trim();
  const action = String(req.body?.action || '').trim().toLowerCase();
  const parsedAmount = Math.round(Number(req.body?.amount) * 100) / 100;
  const reason = String(req.body?.reason || '').trim();
  if (!accountId || !['credit', 'debit', 'hold', 'release'].includes(action) || !reason) {
    res.status(400).json({ error: 'Account, action, positive amount, and reason are required.' });
    return;
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 10000000) {
    res.status(400).json({ error: 'Amount must be greater than $0 and no more than $10,000,000.' });
    return;
  }
  if (reason.length > 500) {
    res.status(400).json({ error: 'Reasons must be 500 characters or fewer.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    const account = await Account.findOne({ id: accountId }).lean<any>();
    if (!account) {
      res.status(404).json({ error: 'Target account not found.' });
      return;
    }
    const targetUser = await User.findOne({ id: account.user_id }).lean<any>();
    const adjustmentAmount = action === 'credit' || action === 'release' ? parsedAmount : -parsedAmount;
    const description = {
      credit: `Bank Credit: ${reason}`,
      debit: `Bank Debit: ${reason}`,
      hold: `Bank Hold Placed: ${reason}`,
      release: `Bank Hold Released: ${reason}`,
    }[action];
    let updatedAccount: any;
    const today = new Date().toISOString().split('T')[0];
    await session.withTransaction(async () => {
      let filter: Record<string, any> = { id: accountId };
      let update: Record<string, any>;
      if (action === 'credit') {
        update = { $inc: { balance: parsedAmount } };
      } else if (action === 'debit') {
        filter.$expr = { $gte: [
          { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
          parsedAmount,
        ] };
        update = { $inc: { balance: -parsedAmount } };
      } else if (action === 'hold') {
        filter.$expr = { $gte: [
          { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
          parsedAmount,
        ] };
        update = { $inc: { held_balance: parsedAmount } };
      } else {
        filter.held_balance = { $gte: parsedAmount };
        update = { $inc: { held_balance: -parsedAmount } };
      }

      updatedAccount = await Account.findOneAndUpdate(filter, update, { new: true, session }).lean<any>();
      if (!updatedAccount) throw new Error(action === 'release'
        ? 'The requested amount exceeds the account’s current held balance.'
        : 'The requested amount exceeds the account’s available balance.');

      await Transaction.create([{
        id: `tx_adj_${randomUUID()}`,
        user_id: account.user_id,
        account_id: accountId,
        type: action === 'hold' ? 'admin_hold' : action === 'release' ? 'admin_release' : 'admin_adjustment',
        amount: adjustmentAmount,
        currency: account.currency || 'USD',
        description,
        recipient_name: 'Account Administration',
        recipient_account: `...${String(account.account_number).slice(-4)}`,
        status: action === 'hold' ? 'Held' : 'Completed',
        category: action === 'hold' || action === 'release' ? 'Payment hold' : 'Adjustment',
        date: today,
        created_at: Date.now(),
      }], { session });
      if (action === 'credit') {
        await createNotification({
          userId: account.user_id,
          title: 'Account Credit Posted',
          message: `$${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD was credited to your account.`,
          type: 'deposit',
          category: 'deposit',
          link: 'history',
        }, session);
      }

      await AuditLog.create([{
        id: `log_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: `ADMIN_${action.toUpperCase()}`,
        target_user_id: account.user_id,
        target_account_id: accountId,
        amount: parsedAmount,
        details: `${description} for ${targetUser?.email || 'unknown customer'} on account ending ${String(account.account_number).slice(-4)}.`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
    });

    const availableBalance = Math.max(0, updatedAccount.balance - (updatedAccount.held_balance || 0));
    res.json({
      success: true,
      newBalance: updatedAccount.balance,
      availableBalance,
      heldBalance: updatedAccount.held_balance || 0,
      adjustedAmount: parsedAmount,
      action,
      accountNumber: account.account_number,
      message: `${description} — available balance is $${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
    });
  } catch (err: any) {
    const message = errorMessage(err, 'Failed to process the account action.');
    if (message.includes('exceeds the account’s current held balance') || message.includes('exceeds the account’s available balance')) {
      res.status(409).json({ error: message });
      return;
    }
    console.error('Error in balance adjustment:', message);
    res.status(500).json({ error: 'Failed to process the account action.' });
  } finally {
    await session.endSession();
  }
});

// GET /api/admin/cards — active issued cards with linked ledger details.
router.get('/cards', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cards = await BankCard.find({ status: 'Active' }).sort({ created_at: -1 }).lean<any[]>();
    const [owners, accounts] = await Promise.all([
      User.find({ id: { $in: cards.map((card) => card.user_id) } }).select('id full_name email').lean<any[]>(),
      Account.find({ id: { $in: cards.map((card) => card.account_id) } }).select('id nickname account_number balance held_balance currency status').lean<any[]>(),
    ]);
    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    res.json({ cards: cards.map((card) => {
      const owner = ownerById.get(card.user_id);
      const account = accountById.get(card.account_id);
      return {
        ...card,
        last4: numericCardLastFour(card.last4),
        network: card.network || 'Visa',
        cardColor: card.cardColor || 'emerald',
        masked_number: maskedCardNumber(card.network || 'Visa', card.last4),
        customer_name: owner?.full_name || 'Unknown customer',
        customer_email: owner?.email || '',
        account_nickname: account?.nickname || '',
        account_number: account?.account_number || '',
        account_balance: account?.balance ?? 0,
        held_balance: account?.held_balance ?? 0,
        account_currency: account?.currency || 'USD',
        account_status: account?.status || 'Unknown',
      };
    }) });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Failed to load issued cards.') });
  }
});

// PATCH /api/admin/cards/:cardId/color — updates the displayed color theme for an issued card.
router.patch('/cards/:cardId/color', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const cardId = String(req.params.cardId || '').trim();
  const cardColor = String(req.body?.cardColor || '');
  const allowedColors = ['emerald', 'navy', 'crimson', 'gold'];
  if (!cardId || !allowedColors.includes(cardColor)) {
    res.status(400).json({ error: 'Choose a valid card color theme.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let updatedCard: any;
    await session.withTransaction(async () => {
      updatedCard = await BankCard.findOneAndUpdate(
        { id: cardId, status: 'Active' },
        { $set: { cardColor } },
        { new: true, runValidators: true, session },
      ).lean<any>();
      if (!updatedCard) throw new Error('An active card could not be found.');

      await AuditLog.create([{
        id: `log_card_color_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: 'CARD_COLOR_UPDATED',
        target_user_id: updatedCard.user_id,
        target_account_id: updatedCard.account_id,
        details: `Updated ${updatedCard.product_name} card ${updatedCard.id} color theme to ${cardColor}.`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
    });
    res.json({ success: true, card: updatedCard });
  } catch (err) {
    const message = errorMessage(err, 'Unable to update card color.');
    res.status(message.includes('active card could not be found') ? 404 : 500).json({ error: message });
  } finally {
    await session.endSession();
  }
});

// POST /api/admin/cards/:cardId/debit — debits the linked in-app checking ledger.
router.post('/cards/:cardId/debit', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const cardId = String(req.params.cardId || '').trim();
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  const reason = String(req.body?.reason || '').trim();
  if (!cardId || !Number.isFinite(amount) || amount <= 0 || amount > 10000000 || !reason || reason.length > 500) {
    res.status(400).json({ error: 'Enter a positive amount up to $10,000,000 and a reason of 500 characters or fewer.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      const card = await BankCard.findOne({ id: cardId, status: 'Active', card_type: 'Debit' }).session(session).lean<any>();
      if (!card) throw new Error('An active debit card could not be found.');
      const account = await Account.findOne({
        id: card.account_id, user_id: card.user_id, account_type: 'Checking', status: 'Active',
      }).session(session).lean<any>();
      if (!account) throw new Error('The card’s linked checking account is not active.');

      const updated = await Account.findOneAndUpdate({
        id: account.id,
        user_id: card.user_id,
        status: 'Active',
        $expr: { $gte: [
          { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
          amount,
        ] },
      }, { $inc: { balance: -amount } }, { new: true, session }).lean<any>();
      if (!updated) throw new Error('The requested amount exceeds the linked account’s available balance.');

      const description = `Card Debit: ${reason}`;
      const owner = await User.findOne({ id: card.user_id }).select('email').session(session).lean<any>();
      await Transaction.create([{
        id: `tx_card_debit_${randomUUID()}`,
        user_id: card.user_id,
        account_id: account.id,
        type: 'card_debit',
        amount: -amount,
        currency: account.currency || 'USD',
        description,
        recipient_name: 'Card transaction',
        recipient_account: `•••• ${numericCardLastFour(card.last4)}`,
        status: 'Completed',
        category: 'Card debit',
        date: new Date().toISOString().slice(0, 10),
        created_at: Date.now(),
      }], { session });
      await AuditLog.create([{
        id: `log_card_debit_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: 'CARD_DEBIT',
        target_user_id: card.user_id,
        target_account_id: account.id,
        amount,
        details: `${description} for ${owner?.email || 'customer'} using ${card.product_name} ending ${numericCardLastFour(card.last4)}.`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      }], { session });
      result = { cardId: card.id, accountId: account.id, newBalance: updated.balance,
        availableBalance: Math.max(0, updated.balance - (updated.held_balance || 0)), amount };
    });
    res.json({ success: true, ...result, message: 'Card debit recorded against the linked checking ledger.' });
  } catch (err) {
    const message = errorMessage(err, 'Unable to process card debit.');
    const conflict = message.includes('available balance') || message.includes('not active') || message.includes('active debit card');
    res.status(conflict ? 409 : 500).json({ error: message });
  } finally {
    await session.endSession();
  }
});

// POST /api/admin/credit-user
// Admin endpoint to instantly credit customer accounts
router.post('/credit-user', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId, accountId, accountNumber, amount, memo, description, reason } = req.body || {};
    const memoText = String(memo || description || reason || 'Administrative Credit / Fund Injection').trim();

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Credit amount must be a positive number greater than $0.00.' });
      return;
    }

    let account: any = null;
    if (accountId) {
      account = await Account.findOne({ id: accountId }).lean<any>();
    } else if (accountNumber) {
      account = await Account.findOne({ account_number: String(accountNumber).trim() }).lean<any>();
    } else if (userId) {
      const accounts = await Account.find({ user_id: userId }).sort({ created_at: 1 }).lean<any[]>();
      accounts.sort((a, b) => ({ Checking: 1, Savings: 2 }[a.account_type as 'Checking' | 'Savings'] || 3) - ({ Checking: 1, Savings: 2 }[b.account_type as 'Checking' | 'Savings'] || 3));
      account = accounts[0] || null;
    }

    if (!account) {
      res.status(404).json({ error: 'Target customer account could not be found. Please verify the customer or account selection.' });
      return;
    }

    const targetUser = await User.findOne({ id: account.user_id }).select('id email full_name').lean<any>();

    // Increment balance directly
    const updatedAccount = await Account.findOneAndUpdate(
      { id: account.id }, { $inc: { balance: parsedAmount } }, { new: true }
    ).lean<any>();
    if (!updatedAccount) {
      res.status(404).json({ error: 'Target customer account could not be found.' });
      return;
    }
    const newBalance = updatedAccount.balance;

    // Record as APPROVED transaction
    const txId = 'tx_cred_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const fullDesc = 'ACH Deposit Confirmed';

    await Transaction.create({
      id: txId, user_id: account.user_id, account_id: account.id, type: 'admin_credit',
      amount: parsedAmount, currency: 'USD', description: fullDesc,
      recipient_name: 'Bank Administrator', recipient_account: account.account_number,
      status: 'APPROVED', category: 'Deposit', date: today, created_at: Date.now(),
    });

    // Record audit log
    const logId = 'aud_cred_' + Date.now();
    await AuditLog.create({
      id: logId, admin_id: req.user!.id, admin_email: req.user!.email,
      action: 'ADMIN_CREDIT', target_user_id: account.user_id, target_account_id: account.id,
      amount: parsedAmount,
      details: `Admin fund injection of $${parsedAmount.toFixed(2)} to ${targetUser?.full_name || 'customer'} (Acct: ${account.account_number}). Memo: ${memoText}`,
      ip_address: req.ip || '127.0.0.1', created_at: new Date().toISOString(),
    });
    try {
      await createNotification({
        userId: account.user_id,
        title: 'Account Credit Posted',
        message: `$${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD was credited to your account.`,
        type: 'deposit',
        category: 'deposit',
        link: 'history',
      });
    } catch (notificationError) {
      console.error('Unable to record account credit notification:', notificationError);
    }

    res.json({
      success: true,
      message: `Successfully credited $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} to ${targetUser?.full_name || 'Customer'}'s account (${account.account_number}).`,
      newBalance,
      creditedAmount: parsedAmount,
      account: updatedAccount,
      user: targetUser,
      transactionId: txId,
    });
  } catch (err: any) {
    console.error('Error in credit-user:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to process admin credit to customer account.') });
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const rows = await AuditLog.find().sort({ created_at: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.target_user_id).filter(Boolean) } }).select('id full_name').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.target_account_id).filter(Boolean) } }).select('id account_number').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const logs = rows.map((row) => ({
      ...row,
      target_user_name: usersById.get(row.target_user_id)?.full_name,
      target_account_number: accountsById.get(row.target_account_id)?.account_number,
    }));
    res.json({ logs });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve audit logs.') });
  }
});

// GET /api/admin/transactions
router.get('/transactions', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { limit = 100 } = req.query;
    const rows = await Transaction.find().sort({ date: -1, created_at: -1 }).limit(Math.min(Number(limit) || 100, 500)).lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.user_id) } }).select('id email full_name').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.account_id) } }).select('id account_number nickname').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const transactions = rows.map((row) => ({
      ...row,
      user_email: usersById.get(row.user_id)?.email,
      user_name: usersById.get(row.user_id)?.full_name,
      account_number: accountsById.get(row.account_id)?.account_number,
      account_name: accountsById.get(row.account_id)?.nickname,
    }));
    res.json({ transactions });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve system transactions.') });
  }
});

// GET /api/admin/pending-deposits — compatibility path for the pending transaction review queue.
router.get('/pending-deposits', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const rows = await Transaction.find({
      status: /^pending$/i,
      category: { $not: /zelle/i },
    }).sort({ date: -1 }).lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: rows.map((row) => row.user_id) } }).select('id email full_name').lean<any[]>(),
      Account.find({ id: { $in: rows.map((row) => row.account_id) } }).select('id account_number nickname').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const pending = rows.map((row) => ({
      ...row,
      user_email: usersById.get(row.user_id)?.email,
      user_name: usersById.get(row.user_id)?.full_name,
      account_number: accountsById.get(row.account_id)?.account_number,
      account_name: accountsById.get(row.account_id)?.nickname,
    }));
    res.status(200).json({ success: true, pendingDeposits: pending });
  } catch (err: any) {
    console.error('Error fetching pending deposits:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve pending deposits.') });
  }
});

// POST /api/admin/transactions/review
router.post('/transactions/review', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const transactionId = String(req.body?.transactionId || '').trim();
  const decision = String(req.body?.decision || '').trim().toLowerCase();
  const reason = String(req.body?.reason || '').trim();
  if (!transactionId || !['approve', 'reject'].includes(decision) || !reason || reason.length > 500) {
    res.status(400).json({ error: 'Transaction, approve/reject decision, and a reason of 500 characters or fewer are required.' });
    return;
  }
  try {
    const result = await reviewPendingTransaction(transactionId, decision as 'approve' | 'reject', reason, req);
    res.json({ success: true, ...result, message: `Transaction ${decision === 'approve' ? 'approved' : 'rejected'} and recorded.` });
  } catch (err: any) {
    const message = errorMessage(err, 'Failed to review transaction.');
    const conflict = /pending|insufficient|active|paired|already|configured/i.test(message);
    res.status(conflict ? 409 : 500).json({ error: message });
  }
});

// Legacy endpoint retained for compatibility, but it now uses the same audited review flow.
router.post('/approve-deposit', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const transactionId = String(req.body?.transactionId || '').trim();
  try {
    const transaction = await Transaction.findOne({ id: transactionId, status: /^pending$/i }).select('type').lean<any>();
    if (!transaction || !['deposit'].includes(String(transaction.type).toLowerCase())) {
      res.status(409).json({ error: 'Only pending deposit records can use this legacy endpoint. Use the transaction review queue.' });
      return;
    }
    const result = await reviewPendingTransaction(transactionId, 'approve', 'Approved from the legacy deposit review control.', req);
    res.json({ success: true, ...result, message: 'Deposit approved and credited.' });
  } catch (err: any) {
    const message = errorMessage(err, 'Failed to approve deposit.');
    res.status(/pending|insufficient|active|paired/i.test(message) ? 409 : 500).json({ error: message });
  }
});

export default router;
