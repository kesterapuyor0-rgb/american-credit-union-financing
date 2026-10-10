import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, LogOut, Mail, MapPin, Phone, Save, UserRound } from 'lucide-react';
import { User } from '../types';
import { getAuthHeaders } from '../utils/api';

interface ProfileViewProps {
  user: User;
  onProfilePictureChange: (profilePicture: string) => void;
  onUserUpdated: (updates: Partial<User>) => void;
  onSignOut: () => void;
}

interface ProfileForm {
  phone: string;
  address: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onProfilePictureChange, onUserUpdated, onSignOut }) => {
  const [form, setForm] = useState<ProfileForm>({ phone: user.phone || '', address: user.address || '' });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await fetch('/api/user/profile', { headers: getAuthHeaders(), credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your profile.');
        if (!cancelled && data.profile) {
          setForm({ phone: data.profile.phone || '', address: data.profile.address || '' });
          onUserUpdated({
            email: data.profile.email || user.email,
            full_name: data.profile.full_name || user.full_name,
            phone: data.profile.phone || '',
            address: data.profile.address || '',
            profilePicture: data.profile.profilePicture || user.profilePicture || '',
          });
        }
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load your profile.' });
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };
    void loadProfile();
    return () => { cancelled = true; };
  }, [user.id]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ phone: form.phone, address: form.address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your profile.');
      const updatedUser = data.user as Partial<User>;
      setForm({ phone: updatedUser.phone || '', address: updatedUser.address || '' });
      onUserUpdated(updatedUser);
      setMessage({ type: 'success', text: 'Profile details saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save your profile.' });
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePicture = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Choose an image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Choose an image smaller than 5 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setUploadingPicture(true);
      setMessage(null);
      try {
        const response = await fetch('/api/user/profile-picture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify({ profilePicture: reader.result }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to update your profile picture.');
        const profilePicture = data.user?.profilePicture || '';
        onProfilePictureChange(profilePicture);
        onUserUpdated({ profilePicture });
        setMessage({ type: 'success', text: 'Profile picture updated.' });
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to update your profile picture.' });
      } finally {
        setUploadingPicture(false);
      }
    };
    reader.onerror = () => setMessage({ type: 'error', text: 'Unable to read this image file.' });
    reader.readAsDataURL(file);
  };

  return (
    <section aria-labelledby="profile-heading" className="mx-auto w-full min-w-0 max-w-full space-y-6 sm:max-w-3xl">
      <header className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
        <div className="relative h-24 w-24 shrink-0">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-emerald-50 text-3xl font-semibold text-teal-800 ring-2 ring-[#E5B841]">
            {user.profilePicture ? <img src={user.profilePicture} alt={`${user.full_name} profile`} className="h-full w-full object-cover" /> : user.full_name.charAt(0).toUpperCase() || 'U'}
          </div>
          <label title="Change profile picture" className="absolute bottom-0 right-0 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-white bg-teal-800 text-white shadow">
            {uploadingPicture ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            <input type="file" accept="image/*" onChange={handleProfilePicture} disabled={uploadingPicture} className="sr-only" />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Personal details</p>
          <h1 id="profile-heading" className="mt-1 break-words text-2xl font-bold text-teal-900">{user.full_name}</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your contact information and profile photo.</p>
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-200 bg-white px-3.5 py-4 shadow-sm sm:p-7">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Profile information</h2>
          <p className="mt-1 text-sm text-slate-500">Your full name is read-only. Update your phone number or address below.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><UserRound aria-hidden="true" className="h-4 w-4 text-slate-400" />Full name</span>
            <input value={user.full_name} readOnly disabled className="min-h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600" />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><Mail aria-hidden="true" className="h-4 w-4 text-slate-400" />Email address</span>
            <input type="email" value={user.email} readOnly disabled className="min-h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600" />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><Phone aria-hidden="true" className="h-4 w-4 text-slate-400" />Phone number</span>
            <input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required maxLength={32} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15" />
          </label>

          <label className="block space-y-1.5 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><MapPin aria-hidden="true" className="h-4 w-4 text-slate-400" />Address</span>
            <textarea autoComplete="street-address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={3} maxLength={200} placeholder="Enter your mailing address" className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15" />
          </label>
        </div>

        {message && <p role="status" aria-live="polite" className={`rounded-lg px-3 py-2.5 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{message.text}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{loadingProfile ? 'Loading profile details…' : 'Changes apply to your contact details.'}</p>
          <button type="submit" disabled={saving || loadingProfile} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sign out</h2>
          <p className="mt-1 text-xs text-slate-500">End your current session on this device.</p>
        </div>
        <button type="button" onClick={onSignOut} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
          <LogOut aria-hidden="true" className="h-4 w-4" /> Sign Out
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-emerald-800"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />Your full name cannot be changed from this form.</div>
    </section>
  );
};
