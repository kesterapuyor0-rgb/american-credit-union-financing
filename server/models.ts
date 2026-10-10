import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password_hash: { type: String, required: true, select: false },
  full_name: { type: String, required: true, trim: true },
  role: { type: String, required: true, default: 'user', index: true },
  isAdmin: { type: Boolean, default: false, index: true },
  isRestricted: { type: Boolean, default: false, index: true },
  restrictionReason: { type: String, default: '', trim: true, maxlength: 500 },
  phone: { type: String, required: true, trim: true },
  address: { type: String, default: '', trim: true, maxlength: 200 },
  profilePicture: { type: String, default: '' },
  security_pin: { type: String, select: false },
  account_number: { type: String, trim: true },
  documentUrl: { type: String, default: '' },
  verification_status: { type: String, enum: ['under_review', 'approved', 'rejected'], default: 'under_review', index: true },
  verification_rejection_reason: { type: String, default: '', trim: true, maxlength: 500 },
  verificationDocument: {
    data: { type: String },
    contentType: { type: String },
  },
  verification_submission: {
    verificationNumber: { type: String, default: '', trim: true, maxlength: 20 },
    sampleFileName: { type: String, default: '', maxlength: 120 },
    sampleFileType: { type: String, default: '', maxlength: 50 },
    sampleFileSize: { type: Number, default: 0, max: 5242880 },
    submittedAt: { type: Date },
  },
  verification_reviewed_at: { type: Date },
  created_at: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });

const accountSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  account_number: { type: String, required: true, unique: true, index: true },
  account_type: { type: String, required: true },
  nickname: { type: String, required: true },
  balance: { type: Number, required: true, default: 0 },
  held_balance: { type: Number, required: true, default: 0 },
  currency: { type: String, required: true, default: 'USD' },
  routing_number: { type: String, required: true },
  credit_limit: { type: Number, default: 0 },
  status: { type: String, required: true, default: 'Active' },
  created_at: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });

const cardApplicationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  account_id: { type: String, required: true, index: true },
  card_type: { type: String, required: true, enum: ['Debit', 'Credit'] },
  network: { type: String, enum: ['Visa', 'Mastercard'], default: 'Visa' },
  cardColor: { type: String, enum: ['emerald', 'navy', 'crimson', 'gold'], default: 'emerald' },
  product_name: { type: String, required: true },
  requested_limit: { type: Number, default: 0 },
  status: { type: String, required: true, default: 'Pending', index: true },
  created_at: { type: Date, required: true, default: Date.now },
  reviewed_at: { type: Date },
  reviewed_by: { type: String },
  review_reason: { type: String, default: '' },
  card_id: { type: String },
}, { versionKey: false, bufferCommands: false });

const cardSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  application_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  account_id: { type: String, required: true },
  card_type: { type: String, required: true, enum: ['Debit', 'Credit'] },
  network: { type: String, enum: ['Visa', 'Mastercard'], default: 'Visa' },
  product_name: { type: String, required: true },
  last4: { type: String, required: true },
  masked_number: { type: String, default: '' },
  status: { type: String, required: true, default: 'Active' },
  credit_limit: { type: Number, default: 0 },
  created_at: { type: Date, required: true, default: Date.now },
}, { versionKey: false, bufferCommands: false });

const grantSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  businessName: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true },
  requestedAmount: { type: Number, required: true, min: 0.01 },
  approvedAmount: { type: Number, default: null, min: 0 },
  purpose: { type: String, required: true, maxlength: 3000 },
  implementationPlan: { type: String, required: true, maxlength: 3000 },
  projectedTimeline: { type: String, required: true, maxlength: 200 },
  documentBase64: { type: String, required: true, select: false },
  documentName: { type: String, required: true, maxlength: 120 },
  documentContentType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
  status: { type: String, required: true, enum: ['PENDING REVIEW', 'UNDER COMMITTEE EVALUATION', 'APPROVED', 'DISBURSED', 'REJECTED'], default: 'PENDING REVIEW', index: true },
  adminNotes: { type: String, default: '', maxlength: 1000 },
  submittedAt: { type: Date, required: true, default: Date.now, index: true },
  reviewedAt: { type: Date },
  disbursedAt: { type: Date },
  transactionId: { type: String },
}, { versionKey: false, bufferCommands: false });

const transactionSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  account_id: { type: String, required: true, index: true },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  transfer_fee: { type: Number, default: 0 },
  transfer_tax: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  description: { type: String, required: true },
  recipient_name: { type: String, default: '' },
  recipient_account: { type: String, default: '' },
  status: { type: String, required: true, default: 'Completed', index: true },
  category: { type: String, default: 'General' },
  related_transaction_id: { type: String, default: null, index: true },
  reviewed_at: { type: Date },
  reviewed_by: { type: String },
  review_reason: { type: String, default: '' },
  date: { type: String, required: true, index: true },
  created_at: { type: Number, required: true },
}, { versionKey: false, bufferCommands: false });

const verificationCodeSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  code: { type: String, required: true },
  purpose: { type: String, required: true, index: true },
  metadata: { type: Schema.Types.Mixed },
  expires_at: { type: Number, required: true, index: true },
  verified: { type: Boolean, default: false, index: true },
  created_at: { type: Number, required: true },
}, { versionKey: false, bufferCommands: false });

const auditLogSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  admin_id: { type: String, required: true },
  admin_email: { type: String, required: true },
  action: { type: String, required: true },
  target_user_id: { type: String, default: null, index: true },
  target_account_id: { type: String, default: null },
  amount: { type: Number },
  details: { type: String, required: true },
  ip_address: { type: String },
  created_at: { type: Schema.Types.Mixed, required: true },
}, { versionKey: false, bufferCommands: false });

export const User = (mongoose.models.User || mongoose.model('User', userSchema)) as mongoose.Model<any>;
export const Account = (mongoose.models.Account || mongoose.model('Account', accountSchema)) as mongoose.Model<any>;
export const Transaction = (mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema)) as mongoose.Model<any>;
export const VerificationCode = (mongoose.models.VerificationCode || mongoose.model('VerificationCode', verificationCodeSchema)) as mongoose.Model<any>;
export const AuditLog = (mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)) as mongoose.Model<any>;
export const CardApplication = (mongoose.models.CardApplication || mongoose.model('CardApplication', cardApplicationSchema)) as mongoose.Model<any>;
export const BankCard = (mongoose.models.BankCard || mongoose.model('BankCard', cardSchema)) as mongoose.Model<any>;
export const Grant = (mongoose.models.Grant || mongoose.model('Grant', grantSchema)) as mongoose.Model<any>;
