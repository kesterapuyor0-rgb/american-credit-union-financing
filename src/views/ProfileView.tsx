import React, { useState, useEffect, ChangeEvent } from 'react';
import { User, BankAccount, UserProfile } from '../types';
import { getAuthHeaders, getStoredAuthToken } from '../utils/api';
import {
  User as UserIcon,
  Mail,
  Phone,
  Hash,
  GitFork,
  ShieldCheck,
  Lock,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Building2,
  Calendar,
  Send,
  AlertCircle
} from 'lucide-react';

interface ProfileViewProps {
  user: User;
  accounts: BankAccount[];
  onReturnToAccounts: () => void;
  onNavigateToTransfer: () => void;
  onProfilePictureChange: (profilePicture: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  accounts,
  onReturnToAccounts,
  onNavigateToTransfer,
  onProfilePictureChange,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAccountNum, setShowAccountNum] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureMessage, setPictureMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const storedToken = getStoredAuthToken();
          const res = await fetch('/api/user/profile', {
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user.id]);

  const primaryAccount = accounts.length > 0 ? accounts[0] : null;
  const accountNumber = profile?.account_number || primaryAccount?.account_number || '4800921849';
  const routingNumber = profile?.routing_number || primaryAccount?.routing_number || '026009593';
  const accountStatus = profile?.status || primaryAccount?.status || 'Active';
  const securityPin = profile?.security_pin || '••••';

  const handleProfilePicture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPictureMessage('Choose an image file to use as your profile picture.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPictureMessage('Profile pictures must be 5 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setUploadingPicture(true);
      setPictureMessage(null);
      try {
        const response = await fetch('/api/user/profile-picture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify({ profilePicture: reader.result }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to update profile picture.');
        const updatedPicture = data.user?.profilePicture || '';
        setProfile((current) => current ? { ...current, profilePicture: updatedPicture } : current);
        onProfilePictureChange(updatedPicture);
        setPictureMessage('Profile picture updated.');
      } catch (error) {
        setPictureMessage(error instanceof Error ? error.message : 'Unable to update profile picture.');
      } finally {
        setUploadingPicture(false);
      }
    };
    reader.onerror = () => setPictureMessage('Unable to read this image file.');
    reader.readAsDataURL(file);
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* Top Breadcrumb / Back button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onReturnToAccounts}
          className="flex items-center space-x-1.5 text-xs font-semibold text-[#0F766E] hover:underline cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Accounts Overview</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Encrypted Session Active</span>
        </div>
      </div>

      {/* Profile and avatar settings */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#C9932E]" />
        <div className="bg-[#0F766E] text-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/20 overflow-hidden flex items-center justify-center text-white text-2xl font-bold font-serif shadow-inner">
                {(profile?.profilePicture || user.profilePicture) ? (
                  <img src={profile?.profilePicture || user.profilePicture} alt={`${user.full_name} profile`} className="w-full h-full object-cover" />
                ) : user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <label className="text-[10px] font-semibold text-blue-100 hover:text-white underline cursor-pointer text-center">
                {uploadingPicture ? 'Uploading…' : 'Change photo'}
                <input type="file" accept="image/*" onChange={handleProfilePicture} disabled={uploadingPicture} className="sr-only" />
              </label>
              {pictureMessage && <span role="status" className="text-[10px] text-blue-100 text-center max-w-32">{pictureMessage}</span>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-blue-200">
                Profile & account details
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white mt-0.5">
                {user.full_name}
              </h1>
              <div className="text-xs text-slate-300 flex items-center gap-2 mt-1">
                <span>Online ID: <span className="font-semibold text-white">{user.email}</span></span>
                <span>•</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verified Customer
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onNavigateToTransfer}
            className="px-4 py-2.5 bg-[#C9932E] hover:bg-[#A8761B] text-white text-xs font-bold uppercase tracking-wider rounded-sm shadow-sm transition-colors flex items-center space-x-2 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Make a Transfer</span>
          </button>
        </div>
      </div>

      {/* Grid: Personal Info & Banking Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Personal Profile Details */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserIcon className="w-4 h-4 text-[#0F766E]" />
              <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wide">
                Personal Identification
              </h2>
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase bg-gray-200 px-2 py-0.5 rounded-sm">
              Primary Holder
            </span>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Full Legal Name:</span>
              <span className="font-bold text-gray-900">{user.full_name}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Online ID / Email Address:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold text-gray-900">{user.email}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(user.email, 'email')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Copy email"
                >
                  {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Registered Phone Number:</span>
              <span className="font-semibold text-gray-900">{user.phone || '(555) 019-2834'}</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Initial Security PIN:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-gray-900">
                  {showPin ? securityPin : '••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title={showPin ? 'Hide PIN' : 'Show PIN'}
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Customer Since:</span>
              <span className="font-semibold text-gray-700">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'September 2026'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Bank Routing & Account Details */}
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#0F766E]" />
              <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wide">
                Direct Deposit & Wire Info
              </h2>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          <div className="p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Bank Name:</span>
              <span className="font-bold text-gray-900">American Credit Union Financing</span>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Routing Number (ABA / ACH):</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-[#0F766E] text-sm">{routingNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(routingNumber, 'routing')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Copy routing number"
                >
                  {copiedField === 'routing' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Primary Account Number:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-gray-900 text-sm">
                  {showAccountNum ? accountNumber : '•••• •••• ' + accountNumber.slice(-4)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAccountNum(!showAccountNum)}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title={showAccountNum ? 'Mask account' : 'Reveal full account'}
                >
                  {showAccountNum ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(accountNumber, 'account')}
                  className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  title="Copy account number"
                >
                  {copiedField === 'account' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Account Type:</span>
              <span className="font-semibold text-gray-900">Advantage Plus Checking</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Encryption & Protection:</span>
              <span className="font-bold text-emerald-700">Prototype profile</span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Accounts List Card */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-[#0F766E]" />
            <h2 className="text-sm font-bold text-[#0F766E] uppercase tracking-wide">
              Account information
            </h2>
          </div>
          <span className="text-xs text-gray-500">
            {accounts.length} Total Accounts
          </span>
        </div>

        <div className="divide-y divide-gray-200 text-xs">
          {accounts.map((acc) => (
            <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div>
                <div className="font-bold text-gray-900 text-sm">{acc.nickname}</div>
                <div className="text-gray-500 font-mono mt-0.5">
                  Account: {acc.account_number} • Routing: {acc.routing_number}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-base text-gray-900">
                  ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {acc.currency}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{acc.status}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
