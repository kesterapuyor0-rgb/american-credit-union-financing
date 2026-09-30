import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { jwtSecret } from '../middleware/auth.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[A-Za-z0-9_]{3,32}$/;
const publicUser = (user: { _id: unknown; username: string; email: string; role: string; isApproved: boolean; approvalStatus: string }) => ({
  id: String(user._id), username: user.username, email: user.email, role: user.role,
  isApproved: user.isApproved, approvalStatus: user.approvalStatus,
});

router.post('/register', async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!usernamePattern.test(username) || !emailPattern.test(email) || email.length > 254 || password.length < 12 || password.length > 128) {
    res.status(400).json({ error: 'Provide a valid username and email, and a password between 12 and 128 characters.' });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash, role: 'user', isApproved: false, approvalStatus: 'pending' });
    res.status(201).json({ message: 'Registration received. Your account is awaiting admin approval.', user: publicUser(user) });
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({ error: 'A user with that username or email already exists.' });
      return;
    }
    res.status(500).json({ error: 'Unable to register account.' });
  }
});

router.post('/login', async (req, res) => {
  const login = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!login || !password) {
    res.status(400).json({ error: 'Login and password are required.' });
    return;
  }
  try {
    const user = await User.findOne({ $or: [{ email: login.toLowerCase() }, { username: login }] }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid login or password.' });
      return;
    }
    if (user.isBlocked) {
      res.status(403).json({ error: 'This account is blocked.' });
      return;
    }
    if (!user.isApproved || user.approvalStatus !== 'approved') {
      res.status(403).json({ error: user.approvalStatus === 'rejected' ? 'This account was not approved.' : 'Your account is awaiting admin approval.' });
      return;
    }
    const token = jwt.sign({}, jwtSecret(), {
      subject: user.id,
      issuer: 'apuyor-engine',
      audience: 'apuyor-engine-api',
      expiresIn: '1h',
    });
    res.json({ token, tokenType: 'Bearer', expiresIn: 3600, user: publicUser(user) });
  } catch {
    res.status(500).json({ error: 'Unable to log in.' });
  }
});

export default router;
