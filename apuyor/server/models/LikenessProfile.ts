import mongoose, { Schema, type InferSchemaType } from 'mongoose';

export const likenessStatuses = ['pending', 'verified', 'rejected', 'revoked'] as const;
const likenessProfileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  confirmationCodeHash: { type: String, required: true, select: false },
  status: { type: String, enum: likenessStatuses, default: 'pending', required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  // referenceVideoPath remains for existing profiles; new uploads use the typed media fields.
  referenceVideoPath: { type: String, trim: true, maxlength: 2048 },
  referenceMediaPath: { type: String, trim: true, maxlength: 2048 },
  referenceMediaType: { type: String, enum: ['image', 'video', 'audio'] },
  embeddingProfileId: { type: String, trim: true, maxlength: 128 },
  embeddingStatus: { type: String, enum: ['pending', 'ready', 'unavailable', 'failed'], default: 'pending', required: true },
  forcedLabelState: { type: Boolean, default: false, required: true },
  verifiedAt: Date,
  revokedAt: Date,
}, { timestamps: true, strict: 'throw' });

export type LikenessProfileDocument = InferSchemaType<typeof likenessProfileSchema>;
export const LikenessProfile = (mongoose.models.LikenessProfile as mongoose.Model<LikenessProfileDocument> | undefined) ?? mongoose.model<LikenessProfileDocument>('LikenessProfile', likenessProfileSchema);
