import { Schema, model, models, type InferSchemaType } from 'mongoose';

export const consentStatuses = ['pending', 'verified', 'rejected', 'revoked'] as const;
const consentRecordSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  confirmationCodeHash: { type: String, required: true, select: false },
  status: { type: String, enum: consentStatuses, default: 'pending', required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  referenceVideoPath: { type: String, required: true, trim: true, maxlength: 2048 },
  forcedLabelState: { type: Boolean, default: false, required: true },
  verifiedAt: Date,
  revokedAt: Date,
}, { timestamps: true, strict: 'throw' });

export type ConsentRecordDocument = InferSchemaType<typeof consentRecordSchema>;
export const ConsentRecord = (models.ConsentRecord as ReturnType<typeof model<ConsentRecordDocument>>) || model<ConsentRecordDocument>('ConsentRecord', consentRecordSchema);
