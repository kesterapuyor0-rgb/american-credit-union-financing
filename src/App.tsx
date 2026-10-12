import React, { useState, useEffect } from 'react';
import { User, BankAccount, BankCard, Transaction, UserSummary } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LoginView } from './views/LoginView';
import { TransactionHistoryView } from './views/TransactionHistoryView';
import { TransferView } from './views/TransferView';
import { AdminView } from './views/AdminView';
import { SecurityView } from './views/SecurityView';
import { Forbidden403View } from './views/Forbidden403View';
import { RegisterView } from './views/RegisterView';
import { EnrollmentStatusView } from './views/EnrollmentStatusView';
import { LandingView } from './views/LandingView';
import { ProfileView } from './views/ProfileView';
import { GrantApplicationView } from './views/GrantApplicationView';
import { InvestmentView } from './views/InvestmentView';
import { KycResubmissionView } from './views/KycResubmissionView';
import { ProfileModal } from './components/ProfileModal';
import { RefreshCw } from 'lucide-react';
import { CardsManagementView, DashboardHomeView } from './views/DashboardHomeView';
import { BottomNavigation } from './components/BottomNavigation';
import { getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken } from './utils/api';

interface DashboardPayload {
  accounts: BankAccount[];
  cardsSummary: { activeCount: number; cards: BankCard[] };
  recentTransactions: Transaction[];
  summary: UserSummary;
}

interface CachedDashboard extends DashboardPayload {
  cachedAt: number;
}

const dashboardCacheKey = (userId: string) => `dashboard-summary:v1:${userId}`;

function readDashboardCache(userId: string): DashboardPayload | null {
  try {
    const cached = localStorage.getItem(dashboardCacheKey(userId));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as CachedDashboard;
    if (
      !Number.isFinite(parsed.cachedAt)
      || Date.now() - parsed.cachedAt > 7 * 24 * 60 * 60 * 1000
      || !Array.isArray(parsed.accounts)
      || !Array.isArray(parsed.cardsSummary?.cards)
      || !Array.isArray(parsed.recentTransactions)
    ) return null;
    return parsed;
  } catch (error) {
    console.warn('Unable to read cached dashboard summary:', error);
    return null;
  }
}

function writeDashboardCache(userId: string, payload: DashboardPayload): void {
  try {
    const safeAccounts = payload.accounts.map((account) => {
      const { routing_number: _routingNumber, ...safeAccount } = account;
      return {
        ...safeAccount,
        account_number: account.account_number ? `•••• ${account.account_number.slice(-4)}` : '',
        routing_number: '',
      };
    });
    const safeCards = payload.cardsSummary.cards.map((card) => ({
      id: card.id,
      user_id: card.user_id,
      account_id: card.account_id,
      card_type: card.card_type,
      network: card.network,
      cardColor: card.cardColor,
      product_name: card.product_name,
      last4: card.last4,
      masked_number: card.masked_number,
      cardDetailsUnlocked: card.cardDetailsUnlocked ?? false,
      linked_account_name: card.linked_account_name,
      linked_account_available: card.linked_account_available,
      currency: card.currency,
      status: card.status,
      credit_limit: card.credit_limit,
      created_at: card.created_at,
    }));
    const safeTransactions = payload.recentTransactions.map((transaction) => ({
      id: transaction.id,
      user_id: transaction.user_id,
      account_id: transaction.account_id,
      type: transaction.type,
      amount: transaction.amount,
      amount_usd: transaction.amount_usd,
      transfer_fee: transaction.transfer_fee,
      transfer_tax: transaction.transfer_tax,
      currency: transaction.currency,
      description: transaction.description,
      formatted_amount: transaction.formatted_amount,
      status: transaction.status,
      category: transaction.category,
      date: transaction.date,
      created_at: transaction.created_at,
    }));
    localStorage.setItem(dashboardCacheKey(userId), JSON.stringify({
      accounts: safeAccounts,
      cardsSummary: { activeCount: safeCards.filter((card) => card.status === 'Active').length, cards: safeCards },
      recentTransactions: safeTransactions,
      summary: payload.summary,
      cachedAt: Date.now(),
    } satisfies CachedDashboard));
  } catch (error) {
    console.warn('Unable to cache dashboard summary:', error);
  }
}

const OfflineStatusBanner: React.FC<{ isOnline: boolean }> = ({ isOnline }) => (
  isOnline ? null : (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
      Network connection lost. Cached data may be displayed.
    </div>
  )
);

export default function App() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>(() => getStoredAuthToken());
  const [activeTab, setActiveTab] = useState<string>(() =>
    window.location.pathname === '/history' ? 'history' : 'home'
  );
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialTransferSourceId, setInitialTransferSourceId] = useState<string | undefined>();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [restrictionSupportOpen, setRestrictionSupportOpen] = useState(false);
  const [registerNotice, setRegisterNotice] = useState<string | null>(null);
  const [grantApplicationRequested, setGrantApplicationRequested] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const hydrateDashboardCache = (userId: string) => {
    const cached = readDashboardCache(userId);
    if (!cached) {
      setDashboardLoading(true);
      return;
    }
    setAccounts(cached.accounts);
    setCards(cached.cardsSummary.cards);
    setTransactions(cached.recentTransactions);
    setSummary(cached.summary);
    setDashboardLoading(false);
  };

  // Role guarding & current route tracking
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname);
  const [forbiddenAccess, setForbiddenAccess] = useState<boolean>(false);

  // Synchronize browser history / URL path
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'user') return;
    const updateKycState = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const state = value as Partial<User> & { userId?: string };
      if (state.userId !== user.id && state.id !== user.id) return;
      setUser((current) => current?.id === user.id ? {
        ...current,
        status: state.status,
        verification_status: state.verification_status,
        verification_rejection_reason: state.verification_rejection_reason,
        verification_rejection_details: state.verification_rejection_details,
      } : current);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== `kyc-status-updated:${user.id}` || !event.newValue) return;
      try {
        updateKycState(JSON.parse(event.newValue));
      } catch (error) {
        console.error('Unable to read cross-tab KYC status update:', error);
      }
    };
    const handleKycEvent = (event: Event) => updateKycState((event as CustomEvent).detail);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('kyc:status-updated', handleKycEvent);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kyc:status-updated', handleKycEvent);
    };
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user?.role === 'user' && user.verification_status === 'rejected' && currentPath !== '/enroll/resubmit') {
      navigateTo('/enroll/resubmit');
    }
  }, [user?.id, user?.role, user?.verification_status, currentPath]);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab, user?.id, user?.role]);

  // Check auth session on boot
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        const storedToken = getStoredAuthToken();
        const res = await fetch('/api/auth/me', {
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === 'user') hydrateDashboardCache(data.user.id);
          setUser(data.user);
          if (storedToken) setToken(storedToken);
        } else {
          setUser(null);
          clearStoredAuthToken();
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Fetch accounts and transactions for standard user
  const fetchUserData = async () => {
    if (!user || user.role === 'admin' || user.verification_status === 'under_review' || user.verification_status === 'rejected') return;

    setDashboardError('');
    try {
      const storedToken = getStoredAuthToken();
      const authHeader = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      const response = await fetch('/api/dashboard/summary', { headers: authHeader, credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load your dashboard.');
      if (!Array.isArray(data.accounts) || !Array.isArray(data.cardsSummary?.cards)) {
        throw new Error('The dashboard response was incomplete.');
      }
      const profileResponse = await fetch('/api/auth/me', { headers: authHeader, credentials: 'include' });
      const profileData = await profileResponse.json();
      if (!profileResponse.ok) throw new Error(profileData.error || 'Unable to refresh your profile.');
      if (profileData.user) {
        setUser((current) => {
          if (!current) return current;
          const profilePicture = profileData.user.profilePicture || '';
          const kycStatus = profileData.user.kycStatus || 'Pending';
          if (current.profilePicture === profilePicture && current.kycStatus === kycStatus) return current;
          return { ...current, profilePicture, kycStatus };
        });
      }
      const payload: DashboardPayload = {
        accounts: data.accounts,
        cardsSummary: data.cardsSummary,
        recentTransactions: Array.isArray(data.recentTransactions) ? data.recentTransactions : [],
        summary: data.summary,
      };
      setAccounts(payload.accounts);
      setCards(payload.cardsSummary.cards);
      setTransactions(payload.recentTransactions);
      setSummary(payload.summary);
      setDashboardError('');
      writeDashboardCache(user.id, payload);
    } catch (err) {
      console.error('Error loading banking data:', err);
      setDashboardError(err instanceof Error ? err.message : 'Unable to load your dashboard.');
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchTransactionHistory = async () => {
    if (!user || user.role !== 'user') return;
    setHistoryLoading(true);
    try {
      const storedToken = getStoredAuthToken();
      const authHeader = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};
      const response = await fetch('/api/user/transactions?limit=100', {
        headers: authHeader,
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load transaction history.');
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (err) {
      console.error('Error loading transaction history:', err);
      setDashboardError(err instanceof Error ? err.message : 'Unable to load transaction history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'user') {
      fetchUserData();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'user' && activeTab === 'history') void fetchTransactionHistory();
  }, [user?.id, activeTab]);

  useEffect(() => {
    if (!user || user.role !== 'user' || user.verification_status !== 'under_review') return;

    let stopped = false;
    const refreshEnrollmentStatus = async () => {
      try {
        const storedToken = getStoredAuthToken();
        const res = await fetch('/api/auth/me', {
          headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Unable to refresh enrollment status.');
        const data = await res.json();
        if (stopped || !data.user) return;
        setUser(data.user);
        if (data.user.verification_status === 'approved') {
          setActiveTab('home');
          if (window.location.pathname !== '/dashboard') navigateTo('/dashboard');
        }
      } catch (err) {
        console.error('Enrollment status refresh failed:', err);
      }
    };

    const intervalId = window.setInterval(() => { void refreshEnrollmentStatus(); }, 30000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [user?.id, user?.role, user?.verification_status]);

  // Handle route guarding for the isolated admin portal.
  useEffect(() => {
    const checkRouteGuarding = () => {
      const isAdminPortal = currentPath === '/admin' || currentPath === '/admin/login';
      const isPathAdmin = isAdminPortal || window.location.search.includes('error=admin_forbidden');
      if (isPathAdmin) {
        if (!user) {
          setForbiddenAccess(false);
          if (currentPath === '/admin') {
            navigateTo('/admin/login');
          }
        } else if (user.role !== 'admin') {
          // Customer attempting to access /admin -> 403 Forbidden!
          setForbiddenAccess(true);
        } else {
          // Authorized Admin
          setForbiddenAccess(false);
        }
      } else {
        setForbiddenAccess(false);
      }
    };

    checkRouteGuarding();
  }, [currentPath, user]);

  const handleLoginSuccess = (loggedInUser: User, authToken: string) => {
    if (loggedInUser.role === 'user') hydrateDashboardCache(loggedInUser.id);
    setUser(loggedInUser);
    setToken(authToken);
    setStoredAuthToken(authToken);

    if (loggedInUser.role === 'admin') {
      navigateTo('/admin');
    } else if (loggedInUser.verification_status === 'rejected' || loggedInUser.status === 'action_required') {
      navigateTo('/enroll/resubmit');
    } else if (loggedInUser.verification_status === 'under_review' || loggedInUser.status === 'pending_review') {
      navigateTo('/enrollment/status');
    } else {
      navigateTo('/dashboard');
      setActiveTab(grantApplicationRequested ? 'grants' : 'home');
      setGrantApplicationRequested(false);
      setRegisterNotice(null);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      // ignore
    }
    clearStoredAuthToken();
    setUser(null);
    setToken('');
    setAccounts([]);
    setCards([]);
    setTransactions([]);
    setSummary(null);
    setDashboardLoading(true);
    setDashboardError('');
    setForbiddenAccess(false);
    navigateTo('/');
  };

  const handleNavigateToTransfer = (fromAccountId?: string) => {
    setInitialTransferSourceId(fromAccountId);
    setActiveTab('transfer');
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#F4F6F8] flex flex-col">
        <OfflineStatusBanner isOnline={isOnline} />
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#173B70] animate-spin" />
            <div className="text-sm font-bold text-[#173B70] font-serif tracking-wide">
              American Credit Union Financing
            </div>
            <div className="text-xs text-gray-500">Loading your account...</div>
          </div>
        </div>
      </div>
    );
  }

  // If not logged in, render the isolated admin login for admin paths.
  if (!user) {
    if (currentPath === '/admin' || currentPath === '/admin/login') {
      return (
        <>
          <OfflineStatusBanner isOnline={isOnline} />
          <LoginView adminOnly onLoginSuccess={handleLoginSuccess} />
        </>
      );
    }

    if (currentPath === '/') {
      return (
        <>
          <OfflineStatusBanner isOnline={isOnline} />
          <LandingView
            onSignIn={() => navigateTo('/login')}
            onEnroll={() => navigateTo('/register')}
            onApplyGrant={() => {
              setGrantApplicationRequested(true);
              setRegisterNotice('Sign in to access the Business & Community Grant Program application.');
              navigateTo('/login');
            }}
          />
        </>
      );
    }

    if (currentPath === '/register') {
      return (
        <>
          <OfflineStatusBanner isOnline={isOnline} />
          <RegisterView
            onNavigateToLogin={(notice) => {
              setRegisterNotice(notice || null);
              navigateTo('/login');
            }}
          />
        </>
      );
    }

    return (
      <>
        <OfflineStatusBanner isOnline={isOnline} />
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => {
            setRegisterNotice(null);
            navigateTo('/register');
          }}
          noticeMessage={registerNotice}
        />
      </>
    );
  }

  // If unauthorized user attempted to access /admin:
  if (forbiddenAccess && user.role !== 'admin') {
    return (
      <div className="min-h-[100dvh] bg-[#F3F4F6] flex flex-col justify-between font-sans">
        <Navbar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
        <OfflineStatusBanner isOnline={isOnline} />
        <Forbidden403View
          onRedirectToDashboard={() => {
            setForbiddenAccess(false);
            navigateTo('/dashboard');
            setActiveTab('home');
          }}
        />
        <Footer />
      </div>
    );
  }

  // Admin view (strictly isolated for admin role)
  if (user.role === 'admin') {
    return (
      <div className="min-h-[100dvh] bg-[#F3F4F6] flex flex-col justify-between font-sans">
        <Navbar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdminView={true}
        />
        <OfflineStatusBanner isOnline={isOnline} />
        <main className="mx-auto w-full max-w-full min-w-0 px-3.5 py-6 pb-24 sm:max-w-7xl sm:px-8 sm:pb-6">
          <AdminView user={user} token={token} onSignOut={handleSignOut} />
        </main>
        <Footer />
      </div>
    );
  }

  if (user.verification_status === 'rejected') {
    return (
      <>
        <OfflineStatusBanner isOnline={isOnline} />
        <KycResubmissionView
          user={user}
          onSignOut={handleSignOut}
          onSubmitted={(updates) => {
            setUser((current) => current ? { ...current, ...updates } : current);
            navigateTo('/dashboard');
          }}
        />
      </>
    );
  }

  if (user.verification_status === 'under_review') {
    return (
      <>
        <OfflineStatusBanner isOnline={isOnline} />
        <EnrollmentStatusView
          user={user}
          onSignOut={handleSignOut}
          onGoToDashboard={() => {
            setActiveTab('home');
            navigateTo('/dashboard');
          }}
        />
      </>
    );
  }

  const renderCustomerView = () => {
    const dashboardProps = {
      user,
      token,
      accounts,
      cards,
      transactions,
      dashboardLoading,
      dashboardError,
      onRefresh: fetchUserData,
      onNavigateToTransfer: handleNavigateToTransfer,
      onNavigateToTab: setActiveTab,
      onNavigateToAccountTransactions: (accountId: string) => {
        setHistoryAccountId(accountId);
        setActiveTab('history');
      },
      isOnline,
    };

    switch (activeTab) {
      case 'home':
        return <DashboardHomeView key="home" {...dashboardProps} />;
      case 'history':
        return <TransactionHistoryView
          key="history"
          user={user}
          transactions={transactions}
          loading={historyLoading}
          accountId={historyAccountId}
          accountName={accounts.find((account) => account.id === historyAccountId)?.nickname}
          onClearAccountFilter={() => setHistoryAccountId(null)}
          onRefresh={() => { void fetchTransactionHistory(); }}
          onNavigateToTransfer={handleNavigateToTransfer}
        />;
      case 'transfer':
        return <TransferView
          key="transfer"
          user={user}
          token={token}
          accounts={accounts}
          initialFromAccountId={initialTransferSourceId}
          onTransferComplete={fetchUserData}
          onCancel={() => setActiveTab('home')}
        />;
      case 'profile':
        return <ProfileView
          key="profile"
          user={user}
          onSignOut={handleSignOut}
          onUserUpdated={(updates) => setUser((current) => current ? { ...current, ...updates } : current)}
        />;
      case 'cards':
        return <CardsManagementView key="cards" {...dashboardProps} />;
      case 'grants':
        return <GrantApplicationView key="grants" user={user} onRefresh={fetchUserData} />;
      case 'investments':
        return <InvestmentView
          key="investments"
          inline
          onClose={() => setActiveTab('home')}
          onPurchaseComplete={() => { void fetchUserData(); }}
        />;
      case 'security':
        return <SecurityView key="security" user={user} />;
      default:
        return <DashboardHomeView key="home-fallback" {...dashboardProps} />;
    }
  };

  // Customer View:
  // Note: Hidden Admin Interfaces constraint:
  // "Ensure zero links, buttons, or visual references to the admin portal exist on the standard user interface."
  return (
    <div className="min-h-[100dvh] bg-[#F3F4F6] flex flex-col justify-between font-sans pb-[calc(5.5rem_+_env(safe-area-inset-bottom))] sm:pb-0">
      <Navbar
        key={user.id}
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminView={false}
      />
      <OfflineStatusBanner isOnline={isOnline} />

      <main id="customer-view" role="tabpanel" tabIndex={-1} aria-label={`${activeTab} view`} className="mx-auto w-full max-w-full min-w-0 px-3.5 pt-5 pb-32 sm:max-w-7xl sm:px-8 sm:py-6">
        {user.isRestricted && (
          <section role="alert" className="mb-3 flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-red-950 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-2.5">
            <div className="min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-wide text-red-800">Account restricted</h2>
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-4">{user.restrictionReason || 'Your account is currently restricted.'}</p>
            </div>
            <button
              type="button"
              onClick={() => setRestrictionSupportOpen(true)}
              className="min-h-8 shrink-0 rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
            >
              Support
            </button>
          </section>
        )}
        {renderCustomerView()}
      </main>

      <BottomNavigation activeTab={activeTab} onNavigate={setActiveTab} />

      {restrictionSupportOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" onClick={() => setRestrictionSupportOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="restriction-support-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="restriction-support-title" className="text-lg font-semibold text-slate-900">Contact support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">For help with this account restriction, email our support team.</p>
            <a
              href="mailto:americancreditunion.financing@gmail.com?subject=Account%20restriction%20support"
              className="mt-4 inline-block break-all font-semibold text-teal-800 underline underline-offset-2"
            >
              americancreditunion.financing@gmail.com
            </a>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setRestrictionSupportOpen(false)}
                className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Profile Modal / Slide-out */}
      {isProfileModalOpen && user && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          accounts={accounts}
          onViewFullProfile={() => {
            setIsProfileModalOpen(false);
            setActiveTab('profile');
          }}
        />
      )}

      <Footer />
    </div>
  );
}
