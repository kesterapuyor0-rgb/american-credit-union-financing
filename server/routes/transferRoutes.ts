import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Account, AuditLog, Transaction, Transfer, User, VerificationCode } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireAdmin, requireApprovedUser, AuthenticatedRequest, generateOTP } from '../auth.js';
import { createNotification } from '../notifications.js';

const router = Router();
router.use(requireDatabase);
const WIRE_TRANSFER_FEE = 2.01;
const WIRE_TRANSFER_TAX = 1.03;

router.post('/zelle', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const sourceAccountId = typeof req.body?.sourceAccountId === 'string' ? req.body.sourceAccountId.trim() : '';
  const recipientName = typeof req.body?.recipientName === 'string' ? req.body.recipientName.trim() : '';
  const recipientIdentifier = typeof req.body?.recipientIdentifier === 'string'
    ? req.body.recipientIdentifier.trim()
    : '';
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientIdentifier);
  const phoneDigits = recipientIdentifier.replace(/\D/g, '');
  const isPhone = phoneDigits.length >= 10 && phoneDigits.length <= 15
    && /^[+()\-\s.\d]+$/.test(recipientIdentifier);
  const isTag = /^@[A-Za-z0-9._-]{2,30}$/.test(recipientIdentifier);
  if (!sourceAccountId || !recipientName || recipientName.length > 120
    || (!isEmail && !isPhone && !isTag)
    || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    res.status(400).json({ error: 'Enter a recipient name, valid email, phone number, or Zelle tag, and an amount up to $1,000,000.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let result: { transferId: string; transactionId: string; amount: number; createdAt: Date } | null = null;
    await session.withTransaction(async () => {
      const account = await Account.findOne({
        id: sourceAccountId,
        user_id: req.user!.id,
        account_type: 'Checking',
        status: 'Active',
      }).session(session).lean<any>();
      if (!account) throw new Error('Choose an active checking account for this transfer.');
      const availableBalance = Math.max(0, account.balance - (account.held_balance || 0));
      if (availableBalance < amount) throw new Error('The transfer amount exceeds your available checking balance.');

      const now = new Date();
      const transferId = `tr_zelle_${randomUUID()}`;
      const transactionId = `tx_zelle_${randomUUID()}`;
      const today = now.toISOString().slice(0, 10);
      const reservedAccount = await Account.findOneAndUpdate({
        id: account.id,
        user_id: req.user!.id,
        account_type: 'Checking',
        status: 'Active',
        $expr: { $gte: [
          { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
          amount,
        ] },
      }, { $inc: { held_balance: amount } }, { new: true, session }).lean<any>();
      if (!reservedAccount) throw new Error('The available checking balance changed. Review your balance and try again.');

      await Transfer.create([{
        id: transferId,
        userId: req.user!.id,
        sourceAccountId: account.id,
        transferType: 'ZELLE',
        recipientIdentifier,
        recipientName,
        amount,
        status: 'PENDING',
        transactionId,
        createdAt: now,
      }], { session });
      await Transaction.create([{
        id: transactionId,
        user_id: req.user!.id,
        account_id: account.id,
        type: 'transfer_out',
        amount,
        transfer_fee: 0,
        transfer_tax: 0,
        currency: 'USD',
        description: `Zelle Transfer to ${recipientName}`,
        recipient_name: recipientName,
        recipient_account: recipientIdentifier,
        status: 'PENDING',
        category: 'Zelle Transfer',
        date: today,
        created_at: now.getTime(),
      }], { session });
      await createNotification({
        userId: req.user!.id,
        title: 'Zelle Transfer Pending Review',
        message: `Your $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD transfer to ${recipientName} is pending security verification.`,
        type: 'transfer',
        category: 'transfer',
        link: 'history',
      }, session);
      result = { transferId, transactionId, amount, createdAt: now };
    });
    res.status(201).json({ success: true, transfer: result });
  } catch (err) {
    const message = errorMessage(err, 'Unable to submit the Zelle transfer.');
    const conflict = message.includes('available checking balance changed');
    res.status(conflict ? 409 : 400).json({ error: message });
  } finally {
    await session.endSession();
  }
});

router.get('/pending', requireAdmin, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const transfers = await Transfer.find({ transferType: 'ZELLE', status: 'PENDING' })
      .sort({ createdAt: -1 })
      .lean<any[]>();
    const [users, accounts] = await Promise.all([
      User.find({ id: { $in: [...new Set(transfers.map((transfer) => transfer.userId))] } })
        .select('id full_name email').lean<any[]>(),
      Account.find({ id: { $in: [...new Set(transfers.map((transfer) => transfer.sourceAccountId))] } })
        .select('id nickname account_number').lean<any[]>(),
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    res.json({
      transfers: transfers.map((transfer) => ({
        ...transfer,
        userName: usersById.get(transfer.userId)?.full_name || 'Member',
        userEmail: usersById.get(transfer.userId)?.email || '',
        accountName: accountsById.get(transfer.sourceAccountId)?.nickname || 'Checking',
        accountNumber: accountsById.get(transfer.sourceAccountId)?.account_number || '',
      })),
    });
  } catch (err) {
    console.error('Pending Zelle transfer lookup failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to load pending Zelle transfers.') });
  }
});

router.put('/admin/:id/approve', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    let approvedTransfer: any = null;
    await session.withTransaction(async () => {
      const transfer = await Transfer.findOne({ id: req.params.id, transferType: 'ZELLE', status: 'PENDING' })
        .session(session).lean<any>();
      if (!transfer) throw new Error('Pending Zelle transfer not found or already processed.');
      const processedAt = new Date();
      const account = await Account.findOneAndUpdate({
        id: transfer.sourceAccountId,
        user_id: transfer.userId,
        status: 'Active',
        balance: { $gte: transfer.amount },
        held_balance: { $gte: transfer.amount },
      }, { $inc: { balance: -transfer.amount, held_balance: -transfer.amount } }, { new: true, session }).lean<any>();
      if (!account) throw new Error('The reserved transfer funds are no longer available.');

      const updatedTransfer = await Transfer.findOneAndUpdate(
        { id: transfer.id, status: 'PENDING' },
        { $set: { status: 'APPROVED', processedAt } },
        { new: true, session },
      ).lean<any>();
      if (!updatedTransfer) throw new Error('Transfer status changed before approval could complete.');
      const transactionResult = await Transaction.updateOne(
        { id: transfer.transactionId, status: 'PENDING' },
        { $set: { status: 'COMPLETED', reviewed_at: processedAt, reviewed_by: req.user!.id } },
        { session },
      );
      if (transactionResult.matchedCount !== 1) throw new Error('The pending ledger transaction could not be updated.');

      await AuditLog.create([{
        id: `log_zelle_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: 'ZELLE_TRANSFER_APPROVED',
        target_user_id: transfer.userId,
        target_account_id: transfer.sourceAccountId,
        amount: transfer.amount,
        details: `Approved Zelle transfer ${transfer.id} to ${transfer.recipientName} (${transfer.recipientIdentifier}).`,
        ip_address: req.ip || '127.0.0.1',
        created_at: processedAt.toISOString(),
      }], { session });
      await createNotification({
        userId: transfer.userId,
        title: 'Zelle Transfer Approved',
        message: `Your $${transfer.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD transfer to ${transfer.recipientName} was approved.`,
        type: 'transfer',
        category: 'transfer',
        link: 'history',
      }, session);
      approvedTransfer = updatedTransfer;
    });
    res.json({ success: true, transfer: approvedTransfer });
  } catch (err) {
    console.error('Zelle transfer approval failed:', err);
    res.status(409).json({ error: errorMessage(err, 'Unable to approve Zelle transfer.') });
  } finally {
    await session.endSession();
  }
});

router.put('/admin/:id/reject', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const reason = typeof req.body?.rejectionReason === 'string' ? req.body.rejectionReason.trim() : '';
  if (!reason || reason.length > 500) {
    res.status(400).json({ error: 'Enter a rejection reason of 500 characters or fewer.' });
    return;
  }

  const session = await mongoose.startSession();
  try {
    let rejectedTransfer: any = null;
    await session.withTransaction(async () => {
      const transfer = await Transfer.findOne({ id: req.params.id, transferType: 'ZELLE', status: 'PENDING' })
        .session(session).lean<any>();
      if (!transfer) throw new Error('Pending Zelle transfer not found or already processed.');
      const processedAt = new Date();
      const releasedAccount = await Account.findOneAndUpdate({
        id: transfer.sourceAccountId,
        user_id: transfer.userId,
        held_balance: { $gte: transfer.amount },
      }, { $inc: { held_balance: -transfer.amount } }, { new: true, session }).lean<any>();
      if (!releasedAccount) throw new Error('The reserved transfer funds could not be released.');

      const updatedTransfer = await Transfer.findOneAndUpdate(
        { id: transfer.id, status: 'PENDING' },
        { $set: { status: 'REJECTED', rejectionReason: reason, processedAt } },
        { new: true, session },
      ).lean<any>();
      if (!updatedTransfer) throw new Error('Transfer status changed before rejection could complete.');
      const transactionResult = await Transaction.updateOne(
        { id: transfer.transactionId, status: 'PENDING' },
        { $set: { status: 'REJECTED', review_reason: reason, reviewed_at: processedAt, reviewed_by: req.user!.id } },
        { session },
      );
      if (transactionResult.matchedCount !== 1) throw new Error('The pending ledger transaction could not be updated.');

      await AuditLog.create([{
        id: `log_zelle_${randomUUID()}`,
        admin_id: req.user!.id,
        admin_email: req.user!.email,
        action: 'ZELLE_TRANSFER_REJECTED',
        target_user_id: transfer.userId,
        target_account_id: transfer.sourceAccountId,
        amount: transfer.amount,
        details: `Rejected Zelle transfer ${transfer.id} to ${transfer.recipientName}. Reason: ${reason}`,
        ip_address: req.ip || '127.0.0.1',
        created_at: processedAt.toISOString(),
      }], { session });
      await createNotification({
        userId: transfer.userId,
        title: 'Zelle Transfer Not Approved',
        message: `Your $${transfer.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD transfer to ${transfer.recipientName} was not approved: ${reason}`,
        type: 'transfer',
        category: 'transfer',
        link: 'history',
      }, session);
      rejectedTransfer = updatedTransfer;
    });
    res.json({ success: true, transfer: rejectedTransfer });
  } catch (err) {
    console.error('Zelle transfer rejection failed:', err);
    res.status(409).json({ error: errorMessage(err, 'Unable to reject Zelle transfer.') });
  } finally {
    await session.endSession();
  }
});

// POST /api/transfers/initiate
router.post('/initiate', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      sourceAccountId,
      transferType = 'internal',
      destinationAccountId,
      recipientName,
      recipientAccount,
      recipientRouting,
      amount,
      memo = '',
      channel = 'email',
    } = req.body;

    if (!['internal', 'external', 'wire'].includes(transferType)) {
      res.status(400).json({ error: 'Please select a valid transfer method.' });
      return;
    }

    const parsedAmount = parseFloat(amount);
    const transferFee = transferType === 'wire' ? WIRE_TRANSFER_FEE : 0;
    const transferTax = transferType === 'wire' ? WIRE_TRANSFER_TAX : 0;
    const totalCharges = transferFee + transferTax;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Please enter a valid transfer amount greater than $0.00 USD.' });
      return;
    }

    // Verify source account
    const sourceAccount = await Account.findOne({ id: sourceAccountId, user_id: userId, status: 'Active' }).lean<any>();

    if (!sourceAccount) {
      res.status(404).json({ error: 'Source account not found.' });
      return;
    }

    const sourceAvailable = Math.max(0, sourceAccount.balance - (sourceAccount.held_balance || 0));
    if (sourceAvailable < parsedAmount + totalCharges) {
      res.status(400).json({
        error: `Insufficient funds. This transfer requires $${(parsedAmount + totalCharges).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD including the $${transferFee.toFixed(2)} fee and $${transferTax.toFixed(2)} tax. Available balance is $${sourceAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD.`,
      });
      return;
    }

    // Determine destination details
    const submittedRecipientName = typeof recipientName === 'string' ? recipientName.trim() : '';
    let destDisplayName = submittedRecipientName || (transferType === 'wire' ? 'James Smith' : 'External Recipient');
    let destDisplayAccount = recipientAccount || '';

    if (transferType === 'internal') {
      const destAccount = await Account.findOne({ id: destinationAccountId, user_id: userId, status: 'Active' }).lean<any>();
      if (!destAccount) {
        res.status(400).json({ error: 'Destination account not found.' });
        return;
      }
      if (destAccount.id === sourceAccount.id) {
        res.status(400).json({ error: 'Source and destination accounts must be different.' });
        return;
      }
      destDisplayName = destAccount.nickname;
      destDisplayAccount = `...${destAccount.account_number.slice(-4)}`;
    }

    // Generate 2FA security code for transaction approval
    const otpCode = generateOTP();
    const verificationId = 'vtx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    const transferPayload = {
      userId,
      sourceAccountId: sourceAccount.id,
      sourceAccountNumber: sourceAccount.account_number,
      sourceAccountNickname: sourceAccount.nickname,
      destinationAccountId: destinationAccountId || null,
      recipientName: destDisplayName,
      recipientAccount: destDisplayAccount,
      recipientRouting: recipientRouting || '',
      amount: parsedAmount,
      transferFee,
      transferTax,
      currency: 'USD',
      transferType,
      memo: memo || 'Online Banking Transfer',
    };

    await VerificationCode.create({
      id: verificationId, user_id: userId, email: req.user!.email, phone: req.user!.phone,
      code: otpCode, purpose: 'transfer', metadata: transferPayload,
      expires_at: expiresAt, verified: false, created_at: Date.now(),
    });

    const maskedContact = channel === 'sms'
      ? (req.user!.phone.length >= 4 ? `(***) ***-${req.user!.phone.slice(-4)}` : req.user!.phone)
      : (req.user!.email.replace(/^(.)(.*)(@.*)$/, '$1***$3'));

    res.json({
      require2FA: true,
      verificationId,
      amount: parsedAmount,
      transferFee,
      transferTax,
      totalDebit: parsedAmount + totalCharges,
      sourceAccountNickname: sourceAccount.nickname,
      sourceAccountLast4: sourceAccount.account_number.slice(-4),
      recipientName: destDisplayName,
      recipientAccount: destDisplayAccount,
      channel,
      maskedContact,
      // For immediate verification in testing sandbox:
      simulatedOtp: otpCode,
      message: `Security verification required. A 6-digit authorization code has been dispatched via ${channel === 'sms' ? 'SMS' : 'Email'}.`,
    });
  } catch (err: any) {
    console.error('Error initiating transfer:', err);
    res.status(500).json({ error: errorMessage(err, 'Transfer initiation failed.') });
  }
});

// POST /api/transfers/confirm
router.post('/confirm', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { verificationId, code } = req.body;

    if (!verificationId || !code) {
      res.status(400).json({ error: 'Verification ID and 6-digit code are required.' });
      return;
    }

    const verificationRecord = await VerificationCode.findOne({
      id: verificationId, user_id: userId, purpose: 'transfer',
      verified: false, expires_at: { $gt: Date.now() },
    }).lean<any>();

    if (!verificationRecord || verificationRecord.code !== code.trim()) {
      res.status(400).json({ error: 'Invalid or expired authorization code. Please verify the 6-digit code and try again.' });
      return;
    }

    const payload = verificationRecord.metadata || {};
    const {
      sourceAccountId,
      destinationAccountId,
      recipientName,
      recipientAccount,
      amount,
      memo,
      transferType,
    } = payload;

    // Check source account balance again
    const sourceAccount = await Account.findOne({ id: sourceAccountId, user_id: userId, status: 'Active' }).lean<any>();

    if (!sourceAccount) {
      res.status(404).json({ error: 'Source account not found.' });
      return;
    }

    const sourceAvailable = Math.max(0, sourceAccount.balance - (sourceAccount.held_balance || 0));
    const transferFee = Number(payload.transferFee) || 0;
    const transferTax = Number(payload.transferTax) || 0;
    const totalCharges = transferFee + transferTax;
    if (sourceAvailable < amount + totalCharges) {
      res.status(400).json({ error: 'Transfer failed: Insufficient funds in source account.' });
      return;
    }

    const txIdOut = `tx_${randomUUID()}_out`;
    const txIdIn = transferType === 'internal' && destinationAccountId ? `tx_${randomUUID()}_in` : null;
    const today = new Date().toISOString().split('T')[0];
    const outgoingDesc = `${transferType === 'wire' ? 'Domestic Wire Transfer' : 'Online Banking Transfer'} Out to ${recipientName}`;
    const destAccount = txIdIn && destinationAccountId
      ? await Account.findOne({ id: destinationAccountId, user_id: userId, status: 'Active' }).lean<any>()
      : null;
    if (txIdIn && !destAccount) {
      res.status(409).json({ error: 'The destination account is no longer active.' });
      return;
    }
    const pendingRows: any[] = [{
      id: txIdOut, user_id: userId, account_id: sourceAccountId,
      type: 'transfer_out', amount, transfer_fee: transferFee, transfer_tax: transferTax, currency: 'USD', description: outgoingDesc,
      recipient_name: recipientName, recipient_account: recipientAccount,
      status: 'PENDING', category: 'Transfer', related_transaction_id: txIdIn,
      date: today, created_at: Date.now(),
    }];
    if (txIdIn && destAccount) {
      pendingRows.push({
        id: txIdIn, user_id: destAccount.user_id, account_id: destinationAccountId,
        type: 'transfer_in', amount, currency: 'USD', description: `Transfer Received from ${sourceAccount.nickname}`,
        recipient_name: sourceAccount.nickname,
        recipient_account: `...${sourceAccount.account_number.slice(-4)}`,
        status: 'PENDING', category: 'Transfer', related_transaction_id: txIdOut,
        date: today, created_at: Date.now() + 1,
      });
    }

    // Claim the OTP and queue every side of an internal transfer atomically.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const claimedVerification = await VerificationCode.findOneAndUpdate(
          { id: verificationId, user_id: userId, purpose: 'transfer', code: code.trim(), verified: false, expires_at: { $gt: Date.now() } },
          { $set: { verified: true } },
          { new: true, session },
        ).lean<any>();
        if (!claimedVerification) throw new Error('This transfer authorization has already been used or expired. Please start again.');
        const reservedSource = await Account.findOneAndUpdate({
          id: sourceAccountId,
          user_id: userId,
          status: 'Active',
          $expr: { $gte: [
            { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
            amount + totalCharges,
          ] },
        }, { $inc: { held_balance: amount + totalCharges } }, { new: true, session }).lean<any>();
        if (!reservedSource) throw new Error('Insufficient available balance to reserve this transfer.');
        await Transaction.create(pendingRows, { session });
        await createNotification({
          userId,
          title: 'Transfer Pending Review',
          message: `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD to ${recipientName} is pending review.`,
          type: 'transfer',
          category: 'transfer',
          link: 'history',
        }, session);
      });
    } finally {
      await session.endSession();
    }

    res.json({
      success: true,
      transactionId: txIdOut,
      amount,
      transferFee,
      transferTax,
      totalDebit: amount + totalCharges,
      recipientName,
      status: 'PENDING',
      message: `Your transfer request of $${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD to ${recipientName} is pending review. The amount is reserved and will post only after approval.`,
    });
  } catch (err: any) {
    console.error('Error confirming transfer:', err);
    const message = errorMessage(err, 'Transfer submission failed.');
    res.status(message.includes('authorization') || message.includes('Insufficient available balance') ? 409 : 500).json({ error: message });
  }
});

// GET /api/transfers/recent-recipients
router.get('/recent-recipients', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const recipients = await Transaction.aggregate([
      { $match: { user_id: userId, recipient_name: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: { recipient_name: '$recipient_name', recipient_account: '$recipient_account' } } },
      { $limit: 6 },
      { $project: { _id: 0, recipient_name: '$_id.recipient_name', recipient_account: '$_id.recipient_account' } },
    ]);
    res.json({ recipients });
  } catch (err: any) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve recipients.') });
  }
});

export default router;
