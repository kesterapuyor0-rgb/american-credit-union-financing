import { Router, Response } from 'express';
import { randomInt, randomUUID } from 'crypto';
import { User, Account, Transaction, BankCard, CardApplication, AuditLog } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { requireApprovedUser, requireAuth, AuthenticatedRequest } from '../auth.js';
import { generateCardNumber, maskedCardNumber, numericCardLastFour } from '../cardNumber.js';
import { formatCryptoAmount } from '../cryptoRates.js';

const router = Router();
router.use(requireDatabase);

const getImageData = (value: unknown): { dataUrl: string; data: string; contentType: string } | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/i);
  if (!match || !match[2] || Buffer.from(match[2], 'base64').length > 5 * 1024 * 1024) return null;
  return { dataUrl: value, contentType: match[1].toLowerCase(), data: match[2] };
};

router.post('/kyc-resubmission', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const governmentId = getImageData(req.body?.governmentIdUrl);
  const addressProof = getImageData(req.body?.addressProofUrl);
  const selfie = getImageData(req.body?.selfieUrl);
  const verificationNumber = typeof req.body?.verificationNumber === 'string'
    ? req.body.verificationNumber.trim()
    : '';
  if (!governmentId || !addressProof || !selfie) {
    res.status(400).json({ error: 'Upload a valid government ID, proof of address, and verification selfie (each up to 5 MB).' });
    return;
  }
  if (verificationNumber && !/^\d{9}$/.test(verificationNumber)) {
    res.status(400).json({ error: 'Enter all 9 digits of your Social Security or Tax ID number, or leave it blank.' });
    return;
  }
  const fileMetadata = (value: unknown, fallback: string, contentType: string, size: number) => {
    const metadata = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const name = typeof metadata.name === 'string' ? metadata.name.trim().slice(0, 120) : '';
    return {
      name: name || fallback,
      type: contentType,
      size,
    };
  };
  const idMetadata = fileMetadata(req.body?.governmentIdMetadata, 'government-id-resubmission', governmentId.contentType, Buffer.from(governmentId.data, 'base64').length);
  const addressMetadata = fileMetadata(req.body?.addressProofMetadata, 'address-proof-resubmission', addressProof.contentType, Buffer.from(addressProof.data, 'base64').length);

  try {
    const rejectedUser = await User.findOne({
      id: req.user!.id,
      role: { $ne: 'admin' },
      isAdmin: { $ne: true },
      $or: [{ verification_status: 'rejected' }, { kycStatus: 'Rejected' }],
    }).select('verification_rejection_reason verification_rejection_details').lean<any>();
    if (!rejectedUser) {
      res.status(409).json({ error: 'This account is not currently awaiting KYC re-submission. Refresh the page and try again.' });
      return;
    }
    const rejectionDetails = Array.isArray(rejectedUser.verification_rejection_details) && rejectedUser.verification_rejection_details.length
      ? rejectedUser.verification_rejection_details
      : String(rejectedUser.verification_rejection_reason || '').split(/\r?\n/);
    const ssnCorrectionRequired = rejectionDetails.some((detail: string) => /SSN|Social Security|Tax ID/i.test(detail));
    if (ssnCorrectionRequired && !verificationNumber) {
      res.status(400).json({ error: 'Member Services requested a corrected 9-digit Social Security or Tax ID number.' });
      return;
    }
    const user = await User.findOneAndUpdate(
      {
        id: req.user!.id,
        role: { $ne: 'admin' },
        isAdmin: { $ne: true },
        $or: [{ verification_status: 'rejected' }, { kycStatus: 'Rejected' }],
      },
      {
        $set: {
          verification_status: 'under_review',
          verification_rejection_reason: '',
          verification_rejection_details: [],
          kycStatus: 'Pending',
          userSelfieStatus: 'pending',
          profilePicture: '',
          governmentIdUrl: governmentId.dataUrl,
          addressProofUrl: addressProof.dataUrl,
          selfieUrl: selfie.dataUrl,
          verificationDocument: { data: governmentId.data, contentType: governmentId.contentType },
          'verification_submission.sampleFileName': idMetadata.name,
          'verification_submission.sampleFileType': idMetadata.type,
          'verification_submission.sampleFileSize': idMetadata.size,
          'verification_submission.addressProofFileName': addressMetadata.name,
          'verification_submission.addressProofFileType': addressMetadata.type,
          'verification_submission.addressProofFileSize': addressMetadata.size,
          'verification_submission.submittedAt': new Date(),
          ...(verificationNumber ? { 'verification_submission.verificationNumber': verificationNumber } : {}),
        },
        $unset: { verification_reviewed_at: 1 },
      },
      { new: true, runValidators: true },
    ).select('id email full_name verification_status kycStatus verification_rejection_reason verification_rejection_details').lean<any>();
    if (!user) {
      res.status(409).json({ error: 'This account is not currently awaiting KYC re-submission. Refresh the page and try again.' });
      return;
    }
    try {
      await AuditLog.create({
        id: `log_kyc_resubmission_${randomUUID()}`,
        admin_id: 'system',
        admin_email: 'system@americancreditunion.financing',
        action: 'KYC_RESUBMITTED',
        target_user_id: user.id,
        details: `Updated KYC documents submitted for review by ${user.email}.`,
        ip_address: req.ip || '127.0.0.1',
        created_at: new Date().toISOString(),
      });
    } catch (auditError) {
      console.error('KYC resubmission was saved, but the audit log could not be written:', auditError);
    }
    res.json({ success: true, status: 'pending_review', user: { ...user, status: 'pending_review' } });
  } catch (err) {
    console.error('Failed to submit KYC resubmission:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to submit replacement KYC documents.') });
  }
});

// GET /api/user/wallets — expose only the authenticated member's assigned deposit addresses.
router.get('/wallets', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userWallets = await User.findOne({ id: req.user!.id })
      .select('assigned_btc_address assigned_usdt_address usdt_network assigned_usdt_trc20_address assigned_usdt_erc20_address')
      .lean<any>();
    if (!userWallets) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const btcAddress = userWallets.assigned_btc_address || '';
    const usdtTrc20Address = userWallets.assigned_usdt_trc20_address
      || (userWallets.usdt_network === 'TRC-20' ? userWallets.assigned_usdt_address : '')
      || '';
    const usdtErc20Address = userWallets.assigned_usdt_erc20_address
      || (userWallets.usdt_network === 'ERC-20' ? userWallets.assigned_usdt_address : '')
      || '';
    res.json({
      user: {
        btcAddress,
        usdtTrc20Address,
        usdtErc20Address,
      },
      wallets: {
        bitcoin: btcAddress,
        usdt: userWallets.assigned_usdt_address || '',
        usdtNetwork: userWallets.usdt_network || '',
        usdtTrc20: usdtTrc20Address,
        usdtErc20: usdtErc20Address,
      },
    });
  } catch (err) {
    console.error('Failed to retrieve member crypto deposit addresses:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve crypto deposit addresses.') });
  }
});

// GET /api/user/accounts
router.get('/accounts', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const accounts = await Account.find({ user_id: userId }).sort({ created_at: 1 }).lean<any[]>();
    const rank: Record<string, number> = { Checking: 1, Savings: 2, 'Credit Card': 3 };
    accounts.sort((a, b) => (rank[a.account_type] || 4) - (rank[b.account_type] || 4));

    // Format account numbers (e.g. "...4821") and balances
    const formattedAccounts = accounts.map((acc) => {
      const last4 = acc.account_number.slice(-4);
      return {
        ...acc,
        display_number: `...${last4}`,
        masked_number: `Account ending in ${last4}`,
        available_balance: Math.max(0, acc.balance - (acc.held_balance || 0)),
      };
    });

    res.json({ accounts: formattedAccounts });
  } catch (err: any) {
    console.error('Error fetching accounts:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve accounts.') });
  }
});

// GET /api/user/transactions
router.get('/transactions', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { accountId, search, status, limit = 50 } = req.query;

    const filter: Record<string, any> = { user_id: userId };
    if (accountId && accountId !== 'all') {
      filter.account_id = accountId;
    }

    if (status && status !== 'all') {
      filter.status = new RegExp(`^${String(status).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ description: new RegExp(term, 'i') }, { recipient_name: new RegExp(term, 'i') }];
    }

    const rows = await Transaction.find(filter).sort({ date: -1, created_at: -1 }).limit(Math.min(Number(limit) || 50, 500)).lean<any[]>();
    const accountIds = [...new Set(rows.map((row) => row.account_id))];
    const accounts = await Account.find({ id: { $in: accountIds } }).select('id nickname account_number').lean<any[]>();
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const transactions = rows.map((row) => ({
      ...row,
      formatted_amount: row.amount_usd !== undefined && row.currency !== 'USD'
        ? formatCryptoAmount(Number(row.amount) || 0, row.currency)
        : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.currency || 'USD',
        }).format(Math.abs(Number(row.amount) || 0)),
      account_name: accountsById.get(row.account_id)?.nickname,
      account_number: accountsById.get(row.account_id)?.account_number,
    }));
    res.json({ transactions });
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve transactions.') });
  }
});

// GET /api/user/summary
router.get('/summary', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const accounts = await Account.find({ user_id: userId }).lean<any[]>();

    let totalCheckingSavings = 0;
    let totalCreditUsed = 0;
    let totalCreditLimit = 0;

    accounts.forEach((acc) => {
      if (acc.account_type === 'Credit Card') {
        totalCreditUsed += acc.balance;
        totalCreditLimit += (acc.credit_limit || 0);
      } else {
        totalCheckingSavings += Math.max(0, acc.balance - (acc.held_balance || 0));
      }
    });

    const pendingTransactionsCount = await Transaction.countDocuments({ user_id: userId, status: /^pending$/i });

    res.json({
      totalDepositBalanceUSD: totalCheckingSavings,
      totalCreditBalanceUSD: totalCreditUsed,
      totalCreditLimitUSD: totalCreditLimit,
      pendingTransactionsCount,
      accountsCount: accounts.length,
    });
  } catch (err: any) {
    console.error('Error fetching user summary:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve summary.') });
  }
});

// GET /api/user/cards
router.get('/cards', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const issuedCards = await BankCard.find({ user_id: req.user!.id, status: { $in: ['Active', 'Locked'] } }).sort({ created_at: -1 })
      .select('id user_id account_id card_type network cardColor product_name last4 masked_number cardDetailsUnlocked status credit_limit created_at').lean<any[]>();
    const accounts = await Account.find({ id: { $in: issuedCards.map((card) => card.account_id) }, user_id: req.user!.id })
      .select('id nickname account_number balance held_balance currency').lean<any[]>();
    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const cards = issuedCards.map((card) => {
      const account = accountById.get(card.account_id);
      return {
        ...card,
        last4: numericCardLastFour(card.last4),
        network: card.network || 'Visa',
        cardColor: card.cardColor || 'emerald',
        masked_number: maskedCardNumber(card.network || 'Visa', card.last4),
        linked_account_name: account?.nickname || '',
        linked_account_number: account?.account_number || '',
        linked_account_available: account ? Math.max(0, account.balance - (account.held_balance || 0)) : 0,
        currency: account?.currency || 'USD',
      };
    });
    res.json({ cards });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve your cards.') });
  }
});

// GET /api/user/cards/:cardId/details — returns sensitive card details only after admin authorization.
router.get('/cards/:cardId/details', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cardFilter = {
      id: String(req.params.cardId || ''),
      user_id: req.user!.id,
      status: { $in: ['Active', 'Locked'] },
    };
    let card = await BankCard.findOne(cardFilter).select('+card_number +expiry_date +cvv cardDetailsUnlocked last4').lean<any>();
    if (!card) {
      res.status(404).json({ error: 'Card not found or unavailable.' });
      return;
    }
    if (card.cardDetailsUnlocked !== true) {
      res.status(403).json({ error: 'For your security, full card numbers, expiration dates, and CVVs are hidden. Please contact customer support to request authorization to unlock these details.' });
      return;
    }

    const network = String(card.network || 'Visa');
    const expectedPrefix = network === 'Mastercard' ? '5' : '4';
    const normalizedLastFour = numericCardLastFour(card.last4);
    const validCardNumber = typeof card.card_number === 'string'
      && /^\d{16}$/.test(card.card_number)
      && card.card_number.startsWith(expectedPrefix)
      && card.card_number.endsWith(normalizedLastFour);
    if (!validCardNumber || !card.expiry_date || !card.cvv) {
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 4);
      const generatedDetails = {
        card_number: generateCardNumber(network, normalizedLastFour),
        expiry_date: `${String(expiry.getMonth() + 1).padStart(2, '0')}/${String(expiry.getFullYear()).slice(-2)}`,
        cvv: String(randomInt(100, 1000)),
      };
      await BankCard.updateOne(cardFilter, { $set: generatedDetails });
      card = await BankCard.findOne(cardFilter).select('+card_number +expiry_date +cvv cardDetailsUnlocked').lean<any>();
    }
    if (!card?.card_number || !card.expiry_date || !card.cvv) {
      throw new Error('Card details are unavailable.');
    }
    res.json({
      cardNumber: card.card_number,
      expiryDate: card.expiry_date,
      cvv: card.cvv,
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Unable to retrieve card details.') });
  }
});

// PATCH /api/user/cards/:cardId/status
router.patch('/cards/:cardId/status', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const status = req.body?.status;
  if (status !== 'Active' && status !== 'Locked') {
    res.status(400).json({ error: 'Choose Active or Locked as the card status.' });
    return;
  }

  try {
    const card = await BankCard.findOneAndUpdate(
      { id: String(req.params.cardId || ''), user_id: req.user!.id, status: { $in: ['Active', 'Locked'] } },
      { $set: { status } },
      { new: true, runValidators: true },
    ).select('id status').lean<any>();
    if (!card) {
      res.status(404).json({ error: 'Card not found or unavailable.' });
      return;
    }
    res.json({ success: true, card });
  } catch (err) {
    console.error('Unable to update member card status:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to update this card.') });
  }
});

// GET /api/user/card-applications
router.get('/card-applications', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const applications = await CardApplication.find({ user_id: req.user!.id }).sort({ created_at: -1 }).lean<any[]>();
    res.json({ applications });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve your card applications.') });
  }
});

// POST /api/user/card-applications
router.post('/card-applications', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cardType = String(req.body?.cardType || '');
    const network = String(req.body?.network || '');
    const accountId = String(req.body?.accountId || '').trim();
    const requestedLimit = Number(req.body?.requestedLimit || 0);
    if (!['Debit', 'Credit'].includes(cardType) || !['Visa', 'Mastercard'].includes(network) || !accountId) {
      res.status(400).json({ error: 'Choose a card type, Visa or Mastercard network, and an eligible checking account.' });
      return;
    }
    if (!Number.isFinite(requestedLimit) || requestedLimit < 0 || requestedLimit > 50000) {
      res.status(400).json({ error: 'Requested limit must be between $0 and $50,000.' });
      return;
    }
    const account = await Account.findOne({ id: accountId, user_id: req.user!.id, account_type: 'Checking', status: 'Active' })
      .select('id').lean<any>();
    if (!account) {
      res.status(404).json({ error: 'Select an active checking account to link to the card.' });
      return;
    }
    const pendingApplication = await CardApplication.findOne({ user_id: req.user!.id, card_type: cardType, status: 'Pending' }).select('id').lean<any>();
    if (pendingApplication) {
      res.status(409).json({ error: `You already have a pending ${cardType.toLowerCase()} card application.` });
      return;
    }
    const application = await CardApplication.create({
      id: `card_app_${randomUUID()}`,
      user_id: req.user!.id,
      account_id: account.id,
      card_type: cardType,
      network,
      product_name: cardType === 'Debit' ? `Everyday ${network} Debit Card` : `Rewards ${network} Credit Card`,
      requested_limit: cardType === 'Credit' ? requestedLimit : 0,
      status: 'Pending',
      created_at: new Date(),
    });
    res.status(201).json({ success: true, application });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Unable to submit your card application.') });
  }
});

// GET /api/user/profile
router.get('/profile', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ id: req.user!.id }).select('id email full_name role phone address profilePicture kycStatus created_at').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        address: user.address || '',
        profilePicture: user.kycStatus === 'Approved' ? user.profilePicture || '' : '',
        kycStatus: user.kycStatus || 'Pending',
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    console.error('Failed to fetch profile:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to fetch user profile.') });
  }
});

// PUT /api/user/profile — users may update contact details, but not their name, email, or role.
router.put('/profile', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
  if (!phone || phone.length > 32) {
    res.status(400).json({ error: 'Enter a phone number up to 32 characters long.' });
    return;
  }
  if (address.length > 200) {
    res.status(400).json({ error: 'Address must be 200 characters or fewer.' });
    return;
  }

  try {
    const user = await User.findOneAndUpdate(
      { id: req.user!.id },
      { $set: { phone, address } },
      { new: true, runValidators: true }
    ).select('id email full_name role phone address profilePicture kycStatus created_at').lean<any>();
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({
      success: true,
      user: {
        ...user,
        address: user.address || '',
        profilePicture: user.kycStatus === 'Approved' ? user.profilePicture || '' : '',
        kycStatus: user.kycStatus || 'Pending',
      },
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err, 'Unable to save profile details.') });
  }
});

// Profile photos are assigned only by an administrator's KYC approval.
router.post('/profile-picture', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(403).json({ error: 'Profile photos can only be assigned through KYC approval.' });
});

// POST /api/user/deposit or /api/user/accounts/deposit
router.post(['/deposit', '/accounts/deposit'], requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { institutionName, accountNumber, routingNumber, amount, targetAccountId } = req.body || {};

    const cleanInstitution = String(institutionName || '').trim();
    const cleanAccountNum = String(accountNumber || '').trim();
    const cleanRoutingNum = String(routingNumber || '').trim();
    const parsedAmount = parseFloat(amount);

    if (!cleanInstitution) {
      res.status(400).json({ error: 'External financial institution name is required.' });
      return;
    }

    if (!cleanAccountNum) {
      res.status(400).json({ error: 'External Account Number is required.' });
      return;
    }

    if (!cleanRoutingNum) {
      res.status(400).json({ error: 'External 9-digit Routing Number is required.' });
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Deposit amount must be a positive number greater than $0.00.' });
      return;
    }

    let targetAccount: any = null;
    if (targetAccountId) {
      targetAccount = await Account.findOne({ id: targetAccountId, user_id: userId, status: 'Active' }).lean<any>();
    }

    if (!targetAccount) {
      const accounts = await Account.find({ user_id: userId, status: 'Active' }).sort({ created_at: 1 }).lean<any[]>();
      accounts.sort((a, b) => ({ Checking: 1, Savings: 2 }[a.account_type as 'Checking' | 'Savings'] || 3) - ({ Checking: 1, Savings: 2 }[b.account_type as 'Checking' | 'Savings'] || 3));
      targetAccount = accounts[0] || null;
    }

    if (!targetAccount) {
      res.status(404).json({ error: 'No active recipient account found for this customer profile.' });
      return;
    }

    const txId = 'tx_dep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const today = new Date().toISOString().split('T')[0];
    const extLast4 = cleanAccountNum.slice(-4) || 'XXXX';
    const txDescription = `External ACH Deposit: ${cleanInstitution} (Acct ...${extLast4})`;

    await Transaction.create({
      id: txId, user_id: userId, account_id: targetAccount.id,
      type: 'deposit', amount: parsedAmount, currency: 'USD', description: txDescription,
      recipient_name: cleanInstitution, recipient_account: `External ...${extLast4}`,
      status: 'PENDING', category: 'Deposit', date: today, created_at: Date.now(),
    });

    res.status(200).json({
      success: true,
      message: `Deposit request of $${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} from ${cleanInstitution} is pending bank review. Funds will be added only after approval.`,
      depositedAmount: parsedAmount,
      account: { id: targetAccount.id, nickname: targetAccount.nickname, account_number: targetAccount.account_number },
      transaction: {
        id: txId,
        account_id: targetAccount.id,
        account_name: targetAccount.nickname,
        account_number: targetAccount.account_number,
        amount: parsedAmount,
        type: 'deposit',
        description: txDescription,
        recipient_name: cleanInstitution,
        recipient_account: `External ...${extLast4}`,
        status: 'PENDING',
        category: 'Deposit',
        date: today,
        created_at: Date.now(),
      },
    });
  } catch (err: any) {
    console.error('Error processing external deposit:', err);
    res.status(500).json({ error: errorMessage(err, 'An error occurred while processing the external deposit.') });
  }
});

export default router;
