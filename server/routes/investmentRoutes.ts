import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import { Account, InvestmentHolding, InvestmentProfitOverride, Transaction } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { AuthenticatedRequest, requireApprovedUser } from '../auth.js';
import { createNotification } from '../notifications.js';
import { getInvestmentAsset, getLegacyInvestmentSymbols, INVESTMENT_CATALOG } from '../../shared/investmentCatalog.js';

const router = Router();
router.use(requireDatabase, requireApprovedUser);

function getPrimaryCheckingAccount(accounts: any[]): any | undefined {
  return accounts.sort((left, right) => {
    const rank = (account: any) => account.nickname === 'Advantage Plus Checking' ? 0 : 1;
    const createdAt = (account: any) => {
      const numeric = Number(account.created_at);
      if (Number.isFinite(numeric)) return numeric;
      const parsed = Date.parse(String(account.created_at || ''));
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return rank(left) - rank(right) || createdAt(left) - createdAt(right);
  })[0];
}

function summarizePortfolio(holdings: any[]) {
  const positions = holdings.map((holding) => {
    const asset = getInvestmentAsset(holding.symbol);
    if (!asset) return null;
    const quantity = Number(holding.quantity) || 0;
    const marketValue = quantity * asset.marketPrice;
    return {
      id: holding.id,
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.assetType,
      quantity,
      averageCost: Number(holding.averageCost) || 0,
      marketPrice: asset.marketPrice,
      marketValue,
      dailyChangePercent: asset.dailyChangePercent,
      detail: asset.detail,
    };
  }).filter((position): position is NonNullable<typeof position> => Boolean(position));
  const totalValue = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const dailyChangeValue = positions.reduce(
    (sum, position) => sum + position.marketValue * position.dailyChangePercent / 100,
    0,
  );
  return {
    positions,
    totalValue,
    dailyChangeValue,
    dailyChangePercent: totalValue > 0 ? dailyChangeValue / totalValue * 100 : 0,
  };
}

router.get('/catalog', (_req: AuthenticatedRequest, res: Response): void => {
  res.set('Cache-Control', 'private, no-store');
  res.json({
    marketDataStatus: 'indicative',
    assets: INVESTMENT_CATALOG,
  });
});

router.get('/portfolio', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [holdings, accounts, profitOverrides] = await Promise.all([
      InvestmentHolding.find({ user_id: req.user!.id }).sort({ symbol: 1 }).lean<any[]>(),
      Account.find({
        user_id: req.user!.id,
        account_type: 'Checking',
        status: 'Active',
        currency: 'USD',
      }).select('id nickname account_number balance held_balance created_at').lean<any[]>(),
      InvestmentProfitOverride.find({ user_id: req.user!.id }).select('symbol mode value reason').lean<any[]>(),
    ]);
    const checkingAccount = getPrimaryCheckingAccount(accounts);
    const overridesBySymbol = new Map(profitOverrides.map((override) => [override.symbol, {
      mode: override.mode as 'offset' | 'multiplier',
      value: Number(override.value),
      reason: override.reason,
    }]));
    const portfolio = summarizePortfolio(holdings);
    const positions = portfolio.positions.map((position) => ({
      ...position,
      profitOverride: overridesBySymbol.get(position.symbol) || null,
    }));
    const baseHoldingsProfitLoss = positions.reduce((sum, position) =>
      sum + position.marketValue - position.quantity * position.averageCost, 0);
    const holdingsProfitLoss = positions.reduce((sum, position) => {
      const costBasis = position.quantity * position.averageCost;
      const baseProfitLoss = position.marketValue - costBasis;
      const override = position.profitOverride;
      return sum + (override
        ? override.mode === 'offset' ? baseProfitLoss + override.value : baseProfitLoss * override.value
        : baseProfitLoss);
    }, 0);
    const profitOverride = overridesBySymbol.get('PORTFOLIO') || null;
    const unrealizedProfitLoss = profitOverride
      ? profitOverride.mode === 'offset'
        ? holdingsProfitLoss + profitOverride.value
        : holdingsProfitLoss * profitOverride.value
      : holdingsProfitLoss;
    const adminProfitOffset = unrealizedProfitLoss - baseHoldingsProfitLoss;
    const totalCostBasis = positions.reduce((sum, position) => sum + position.quantity * position.averageCost, 0);
    res.set('Cache-Control', 'private, no-store');
    res.json({
      ...portfolio,
      positions,
      profitOverride,
      unrealizedProfitLoss,
      unrealizedProfitLossPercent: totalCostBasis > 0 ? unrealizedProfitLoss / totalCostBasis * 100 : 0,
      adminProfitOffset,
      checkingAccount: checkingAccount ? {
        id: checkingAccount.id,
        nickname: checkingAccount.nickname,
        accountLast4: String(checkingAccount.account_number || '').slice(-4),
        availableBalance: Math.max(0, checkingAccount.balance - (checkingAccount.held_balance || 0)),
      } : null,
    });
  } catch (error) {
    console.error('Investment portfolio lookup failed:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to load the investment portfolio.') });
  }
});

router.post('/buy', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const symbol = typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
  const rawQuantity = Number(req.body?.quantity);
  const quantity = Math.round(rawQuantity * 1_000_000) / 1_000_000;
  const asset = getInvestmentAsset(symbol);
  if (!asset || !Number.isFinite(rawQuantity) || rawQuantity <= 0 || rawQuantity > 1_000_000
    || Math.abs(quantity - rawQuantity) > 1e-9) {
    res.status(400).json({ error: 'Choose a catalog asset and enter a quantity with at most 6 decimal places.' });
    return;
  }

  const totalCost = Math.round(quantity * asset.marketPrice * 100) / 100;
  if (totalCost < 1 || !Number.isFinite(totalCost)) {
    res.status(400).json({ error: 'The minimum order value is $1.00.' });
    return;
  }

  const userId = req.user!.id;
  const session = await mongoose.startSession();
  try {
    let result: {
      transactionId: string;
      confirmationNumber: string;
      symbol: string;
      quantity: number;
      totalCost: number;
      checkingAccountNickname: string;
      orderStatus: 'recorded';
      averageCost: number;
      portfolioValue: number;
      dailyChangePercent: number;
      availableBalance: number;
    } | null = null;

    await session.withTransaction(async () => {
      const accounts = await Account.find({
        user_id: userId,
        account_type: 'Checking',
        status: 'Active',
        currency: 'USD',
      }).session(session).lean<any[]>();
      const checking = getPrimaryCheckingAccount(accounts);
      if (!checking) throw new Error('An active USD checking account is required for this order.');

      const debited = await Account.findOneAndUpdate({
        id: checking.id,
        user_id: userId,
        account_type: 'Checking',
        currency: 'USD',
        status: 'Active',
        $expr: {
          $gte: [
            { $subtract: [{ $ifNull: ['$balance', 0] }, { $ifNull: ['$held_balance', 0] }] },
            totalCost,
          ],
        },
      }, { $inc: { balance: -totalCost } }, { new: true, session }).lean<any>();
      if (!debited) throw new Error('Insufficient available checking balance for this order.');

      const holdingId = `holding_${userId}_${asset.symbol}`;
      const holding = await InvestmentHolding.findOne({
        user_id: userId,
        symbol: { $in: [asset.symbol, ...getLegacyInvestmentSymbols(asset.symbol)] },
        assetType: asset.assetType,
      }).session(session).lean<any>();
      const now = new Date();
      const nextQuantity = (Number(holding?.quantity) || 0) + quantity;
      const nextAverageCost = Math.round((
        ((Number(holding?.quantity) || 0) * (Number(holding?.averageCost) || 0) + totalCost)
        / nextQuantity
      ) * 1_000_000) / 1_000_000;

      if (holding) {
        const updated = await InvestmentHolding.updateOne({
          id: holding.id,
          user_id: userId,
          quantity: holding.quantity,
        }, {
          $set: {
            symbol: asset.symbol,
            quantity: nextQuantity,
            averageCost: nextAverageCost,
            updatedAt: now,
          },
        }, { session });
        if (updated.matchedCount !== 1) throw new Error('The portfolio changed during this order. Please try again.');
      } else {
        await InvestmentHolding.create([{
          id: holdingId,
          user_id: userId,
          symbol: asset.symbol,
          assetType: asset.assetType,
          quantity,
          averageCost: Math.round((totalCost / quantity) * 1_000_000) / 1_000_000,
          createdAt: now,
          updatedAt: now,
        }], { session });
      }

      const transactionId = `tx_investment_${randomUUID()}`;
      const date = now.toISOString().slice(0, 10);
      await Transaction.create([{
        id: transactionId,
        user_id: userId,
        account_id: checking.id,
        type: 'withdrawal',
        amount: totalCost,
        currency: 'USD',
        description: `Investment purchase ${quantity} ${asset.symbol} at $${asset.marketPrice.toFixed(2)} per unit`,
        sender_name: asset.name,
        reference_id: transactionId,
        transaction_type: 'Investment Purchase',
        recipient_name: 'Investment Portfolio',
        status: 'Completed',
        category: 'Investments',
        date,
        created_at: now.getTime(),
      }], { session });
      await createNotification({
        userId,
        title: 'Investment Order Recorded',
        message: `${quantity} ${asset.symbol} was added to your portfolio. This order was not sent to a brokerage.`,
        type: 'investment',
        category: 'investments',
        link: 'home',
      }, session);

      const updatedHoldings = await InvestmentHolding.find({ user_id: userId }).session(session).lean<any[]>();
      const portfolio = summarizePortfolio(updatedHoldings);
      result = {
        transactionId,
        confirmationNumber: transactionId,
        symbol: asset.symbol,
        quantity,
        totalCost,
        checkingAccountNickname: checking.nickname || 'Checking',
        orderStatus: 'recorded',
        averageCost: nextAverageCost,
        portfolioValue: portfolio.totalValue,
        dailyChangePercent: portfolio.dailyChangePercent,
        availableBalance: Math.max(0, debited.balance - (debited.held_balance || 0)),
      };
    });

    if (!result) throw new Error('The investment order could not be recorded.');
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    const message = errorMessage(error, 'Unable to submit this order.');
    const status = message.includes('Insufficient') ? 409 : message.includes('portfolio changed') ? 409 : 400;
    console.error('Investment order failed:', error);
    res.status(status).json({ error: message });
  } finally {
    await session.endSession();
  }
});

export default router;
