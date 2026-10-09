import React, { useMemo, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { Transaction, User } from '../types';
import { Bell, CheckCheck, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { formatTransactionDescription } from '../utils/transactionFormatting';

interface NavbarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdminView?: boolean;
  transactions?: Transaction[];
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  isAdminView = false,
  transactions = [],
}) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const readStorageKey = `read-transaction-notifications:${user?.id || 'guest'}`;
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(readStorageKey) || '[]'));
    } catch {
      return new Set();
    }
  });
  const notifications = useMemo(() => [...transactions]
    .sort((left, right) => right.created_at - left.created_at)
    .slice(0, 5), [transactions]);
  const unreadCount = notifications.filter((transaction) => !readNotificationIds.has(transaction.id)).length;

  const markAllNotificationsRead = () => {
    const updated = new Set(readNotificationIds);
    notifications.forEach((transaction) => updated.add(transaction.id));
    setReadNotificationIds(updated);
    try {
      localStorage.setItem(readStorageKey, JSON.stringify([...updated]));
    } catch {
      // The panel remains usable when browser storage is unavailable.
    }
  };

  const openTransactionHistory = (transactionId: string) => {
    const updated = new Set(readNotificationIds);
    updated.add(transactionId);
    setReadNotificationIds(updated);
    try {
      localStorage.setItem(readStorageKey, JSON.stringify([...updated]));
    } catch {
      // The panel remains usable when browser storage is unavailable.
    }
    setNotificationsOpen(false);
    setActiveTab('history');
  };

  return (
    <div className="sticky top-0 z-50 w-full shrink-0 bg-white">
      <header className="flex min-h-[72px] shrink-0 items-center border-b border-amber-500/50 bg-slate-900 px-4 py-3 text-white shadow-md sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Go to account overview"
            className="min-w-0 text-left"
            onClick={() => {
              if (isAdminView) {
                setActiveTab('overview');
              } else {
                setActiveTab('home');
              }
            }}
          >
            <BrandLogo className="min-h-10 min-w-0" variant="white" showSubtitle={false} />
          </button>
          {user && !isAdminView && (
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative">
                <button
                  type="button"
                  aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                  aria-expanded={notificationsOpen}
                  aria-controls="header-notifications-panel"
                  onClick={() => { setNotificationsOpen((open) => !open); setSettingsOpen(false); }}
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-white/15 text-slate-100 transition hover:border-amber-300/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <Bell aria-hidden="true" className="h-5 w-5" />
                  {unreadCount > 0 && <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-slate-900" />}
                </button>
                {notificationsOpen && (
                  <section id="header-notifications-panel" aria-label="Recent transaction notifications" className="absolute right-0 top-12 z-[60] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div><h2 className="text-sm font-semibold">Recent activity</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div>
                      <button type="button" onClick={markAllNotificationsRead} disabled={unreadCount === 0} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:cursor-default disabled:text-slate-400"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>
                    </div>
                    {notifications.length ? (
                      <ul className="max-h-[min(60vh,24rem)] overflow-y-auto divide-y divide-slate-100">
                        {notifications.map((transaction) => (
                          <li key={transaction.id}>
                            <button type="button" onClick={() => openTransactionHistory(transaction.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50">
                              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${readNotificationIds.has(transaction.id) ? 'bg-slate-200' : 'bg-teal-600'}`} />
                              <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-slate-900">{formatTransactionDescription(transaction.description)}</span><span className="mt-1 block text-xs text-slate-500">{transaction.date} · {new Intl.NumberFormat('en-US', { style: 'currency', currency: transaction.currency || 'USD' }).format(Math.abs(transaction.amount + (transaction.type === 'transfer_out' ? (transaction.transfer_fee || 0) + (transaction.transfer_tax || 0) : 0)))}</span></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-8 text-center text-sm text-slate-500">No recent account activity.</p>
                    )}
                    <button type="button" onClick={() => { setNotificationsOpen(false); setActiveTab('history'); }} className="w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-teal-800 hover:bg-teal-50">View transaction history</button>
                  </section>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Settings"
                  aria-expanded={settingsOpen}
                  aria-controls="header-settings-menu"
                  onClick={() => { setSettingsOpen((open) => !open); setNotificationsOpen(false); }}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-slate-100 transition hover:border-amber-300/60 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-amber-300"
                ><Settings aria-hidden="true" className="h-5 w-5" /></button>
                {settingsOpen && (
                  <div id="header-settings-menu" className="absolute right-0 top-12 z-[60] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-xl">
                    <button type="button" onClick={() => { setSettingsOpen(false); setActiveTab('profile'); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"><UserRound aria-hidden="true" className="h-4 w-4 text-slate-500" /> Profile & details</button>
                    <button type="button" onClick={() => { setSettingsOpen(false); setActiveTab('security'); }} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"><ShieldCheck aria-hidden="true" className="h-4 w-4 text-slate-500" /> Security settings</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Sub Navigation Bar - Professional Polish: White background, 56px height, crisp bottom border */}
      {user && !isAdminView && (
        <nav className="hidden sm:flex bg-white border-b border-gray-300 h-[56px] shrink-0 px-4 sm:px-8 shadow-xs">
          <div className="flex space-x-6 sm:space-x-10 h-full overflow-x-auto no-scrollbar">
            <button
              id="tab-accounts"
              onClick={() => setActiveTab('home')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'home'
                  ? 'border-b-4 border-[#173B70] text-[#173B70] font-bold'
                  : 'text-gray-600 hover:text-[#173B70] font-medium'
              }`}
            >
              Accounts
            </button>

            <button
              id="tab-transfers"
              onClick={() => setActiveTab('transfer')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'transfer'
                  ? 'border-b-4 border-[#173B70] text-[#173B70] font-bold'
                  : 'text-gray-600 hover:text-[#173B70] font-medium'
              }`}
            >
              Transfers
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'history'
                  ? 'border-b-4 border-[#173B70] text-[#173B70] font-bold'
                  : 'text-gray-600 hover:text-[#173B70] font-medium'
              }`}
            >
              Bill Pay & Activity
            </button>

            <button
              id="tab-security"
              onClick={() => setActiveTab('security')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'security'
                  ? 'border-b-4 border-[#173B70] text-[#173B70] font-bold'
                  : 'text-gray-600 hover:text-[#173B70] font-medium'
              }`}
            >
              Security Center
            </button>

            <button
              id="tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'profile'
                  ? 'border-b-4 border-[#173B70] text-[#173B70] font-bold'
                  : 'text-gray-600 hover:text-[#173B70] font-medium'
              }`}
            >
              Profile & Details
            </button>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-xs text-gray-500 italic hidden lg:inline">
              Last login: Today at 09:42 AM EST
            </span>
          </div>
        </nav>
      )}

      {/* Admin specific sub-nav if viewing admin portal */}
      {user && isAdminView && (
        <nav className="bg-slate-900 border-b border-slate-700 h-[52px] shrink-0 flex px-4 sm:px-8 shadow-xs text-white">
          <div className="flex space-x-4 sm:space-x-6 h-full items-center text-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Control Panel:
            </span>
            <button
              id="admin-tab-users"
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#D6A832] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Customer Accounts & Direct Adjustments
            </button>
            <button
              id="admin-tab-audit"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#D6A832] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              Transaction Audit Logs
            </button>
            <button
              id="admin-tab-system"
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-[#D6A832] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              All System Transactions
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};
