export type User = {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isApproved: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
};

export type PendingUser = Pick<User, 'id' | 'username' | 'email' | 'approvalStatus'> & { createdAt: string };
export type LikenessProfile = {
  _id: string;
  userId: string;
  status: 'pending' | 'verified' | 'rejected' | 'revoked';
  expiresAt: string;
  referenceMediaPath?: string;
  referenceMediaType?: 'image' | 'video';
  referenceVideoPath?: string;
  forcedLabelState: boolean;
};

export type VerifiedConsent = { id: string; expiresAt: string };
