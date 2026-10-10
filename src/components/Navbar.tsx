import React, { useCallback, useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { BankingNotification, User } from '../types';
import { ArrowUpRight, Bell, CheckCheck, Gift, Info, Settings, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { getAuthHeaders } from '../utils/api';

interface NavbarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdminView?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  isAdminView = false,
}) => {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<BankingNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(false);
  const memberId = user?.role === 'user' ? user.id : '';
  const unreadCount = notifications.reduce((count, notification) => count + Number(!notification.isRead), 0);

  const fetchNotifications = useCallback(async () => {
    if (!memberId) return;
    setNotificationsLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Notification request failed (${response.status}).`);
      const data = await response.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setNotificationsError(false);
    } catch (error) {
      console.error('Failed to fetch banking notifications:', error);
      setNotificationsError(true);
    } finally {
      setNotificationsLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (!memberId) return;
    void fetchNotifications();
    const intervalId = window.setInterval(() => { void fetchNotifications(); }, 30_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [memberId, activeTab, fetchNotifications]);

  const markNotificationRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Notification update failed (${response.status}).`);
      setNotifications((current) => current.map((notification) =>
        notification.id === notificationId ? { ...notification, isRead: true } : notification));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      setNotificationsError(true);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Notification update failed (${response.status}).`);
      setNotifications((current) => current.map((notification) => ({ ...notification, isRead: true })));
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
      setNotificationsError(true);
    }
  };

  const openNotification = async (notification: BankingNotification) => {
    if (!notification.isRead) await markNotificationRead(notification.id);
    setNotificationsOpen(false);
    setActiveTab(notification.link || 'history');
  };

  const formatNotificationTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo < 60) return `${minutesAgo} min${minutesAgo === 1 ? '' : 's'} ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo} hour${hoursAgo === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const notificationIcon = (category: string) => {
    const normalizedCategory = category.toLowerCase();
    if (normalizedCategory.includes('grant')) return <Gift aria-hidden="true" className="h-4 w-4" />;
    if (normalizedCategory.includes('deposit') || normalizedCategory.includes('balance')) return <Wallet aria-hidden="true" className="h-4 w-4" />;
    if (normalizedCategory.includes('transfer')) return <ArrowUpRight aria-hidden="true" className="h-4 w-4" />;
    if (normalizedCategory.includes('security')) return <ShieldCheck aria-hidden="true" className="h-4 w-4" />;
    return <Info aria-hidden="true" className="h-4 w-4" />;
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
            <BrandLogo className="min-h-10 min-w-0" variant="white" />
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
                  {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-slate-900">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                </button>
                {notificationsOpen && (
                  <section id="header-notifications-panel" aria-label="Banking notifications" className="fixed right-2 top-[4.5rem] z-[60] w-[min(96vw,25rem)] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl sm:absolute sm:right-0 sm:top-12 sm:w-[24rem]">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                      <div><h2 className="text-sm font-semibold">Notifications</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div>
                      <button type="button" onClick={() => { void markAllNotificationsRead(); }} disabled={unreadCount === 0} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:cursor-default disabled:text-slate-400"><CheckCheck className="h-3.5 w-3.5" /> Mark all as read</button>
                    </div>
                    {notificationsLoading && notifications.length === 0 ? (
                      <div className="space-y-3 px-4 py-5" aria-label="Loading notifications">
                        {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
                      </div>
                    ) : notifications.length ? (
                      <ul className="max-h-[min(70dvh,30rem)] overflow-y-auto overscroll-contain divide-y divide-slate-100">
                        {notifications.map((notification) => (
                          <li key={notification.id}>
                            <button type="button" onClick={() => { void openNotification(notification); }} className={`flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${notification.isRead ? 'bg-white' : 'bg-sky-50/80'}`}>
                              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${notification.category.toLowerCase().includes('security') ? 'bg-violet-100 text-violet-700' : notification.category.toLowerCase().includes('grant') ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>{notificationIcon(notification.category)}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-start justify-between gap-2">
                                  <span className="block whitespace-normal break-words text-sm font-semibold leading-5 text-slate-900">{notification.title}</span>
                                  {!notification.isRead && <span aria-label="Unread" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                                </span>
                                <span className="mt-1 block whitespace-normal break-words text-xs leading-4 text-slate-600">{notification.message}</span>
                                <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{formatNotificationTime(notification.createdAt)}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-4 py-8 text-center text-sm text-slate-500">{notificationsError ? 'Notifications are temporarily unavailable. Please try again shortly.' : 'You’re all caught up. New account updates will appear here.'}</p>
                    )}
                    <button type="button" onClick={() => { setNotificationsOpen(false); setActiveTab('history'); }} className="w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-teal-800 hover:bg-teal-50">View account activity</button>
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
