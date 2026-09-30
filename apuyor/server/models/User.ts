import { Schema, model, models, type InferSchemaType } from 'mongoose';

const userSchema = new Schema({
  username: { type: String, required: true, trim: true, minlength: 3, maxlength: 32, unique: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', required: true, index: true },
  isApproved: { type: Boolean, default: false, required: true, index: true },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true, index: true },
  isBlocked: { type: Boolean, default: false, required: true, index: true },
}, { timestamps: true, strict: 'throw' });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = (models.User as ReturnType<typeof model<UserDocument>>) || model<UserDocument>('User', userSchema);
