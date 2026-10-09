import React, { useState, useEffect } from 'react';
import { User, BankAccount, Transaction, UserSummary } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LoginView } from './views/LoginView';
import { TransactionHistoryView } from './views/TransactionHistoryView';
import { TransferView } from './views/TransferView';
import { AdminView } from './views/AdminView';
import { SecurityView } from './views/SecurityView';
import { Forbidden403View } from './views/Forbidden403View';
import { RegisterView } from './views/RegisterView';
import { LandingView } from './views/LandingView';
import { ProfileView } from './views/ProfileView';
import { ProfileModal } from './components/ProfileModal';
import { RefreshCw } from 'lucide-react';
import { CardsManagementView, DashboardHomeView } from './views/DashboardHomeView';
import { BottomNavigation } from './components/BottomNavigation';
import { getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken } from './utils/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>(() => getStoredAuthToken());
  const [activeTab, setActiveTab] = useState<string>('home');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialTransferSourceId, setInitialTransferSourceId] = useState<string | undefined>();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [restrictionSupportOpen, setRestrictionSupportOpen] = useState(false);
  const [registerNotice, setRegisterNotice] = useState<string | null>(null);

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
    if (!user || user.role === 'admin') return;

    try {
      const storedToken = getStoredAuthToken();
      const authHeader = storedToken ? { Authorization: `Bearer ${storedToken}` } : {};

      const [accountsRes, txRes, summaryRes] = await Promise.all([
        fetch('/api/user/accounts', { headers: authHeader, credentials: 'include' }),
        fetch('/api/user/transactions', { headers: authHeader, credentials: 'include' }),
        fetch('/api/user/summary', { headers: authHeader, credentials: 'include' }),
      ]);

      if (accountsRes.ok) {
        const accData = await accountsRes.json();
        setAccounts(accData.accounts || []);
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData.transactions || []);
      }

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }
    } catch (err) {
      console.error('Error loading banking data:', err);
    }
  };

  useEffect(() => {
    if (user && user.role === 'user') {
      fetchUserData();
    }
  }, [user]);

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
    setUser(loggedInUser);
    setToken(authToken);
    setStoredAuthToken(authToken);

    if (loggedInUser.role === 'admin') {
      navigateTo('/admin');
    } else {
      navigateTo('/dashboard');
      setActiveTab('home');
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
    setTransactions([]);
    setSummary(null);
    setForbiddenAccess(false);
    navigateTo('/');
  };

  const handleNavigateToTransfer = (fromAccountId?: string) => {
    setInitialTransferSourceId(fromAccountId);
    setActiveTab('transfer');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#173B70] animate-spin" />
          <div className="text-sm font-bold text-[#173B70] font-serif tracking-wide">
            American Credit Union Financing
          </div>
          <div className="text-xs text-gray-500">Loading your account...</div>
        </div>
      </div>
    );
  }

  // If not logged in, render the isolated admin login for admin paths.
  if (!user) {
    if (currentPath === '/admin' || currentPath === '/admin/login') {
      return (
        <LoginView adminOnly onLoginSuccess={handleLoginSuccess} />
      );
    }

    if (currentPath === '/') {
      return (
        <LandingView
          onSignIn={() => navigateTo('/login')}
          onEnroll={() => navigateTo('/register')}
        />
      );
    }

    if (currentPath === '/register') {
      return (
        <RegisterView
          onRegisterSuccess={(newUser, authToken) => {
            handleLoginSuccess(newUser, authToken);
          }}
          onNavigateToLogin={(notice) => {
            setRegisterNotice(notice || null);
            navigateTo('/login');
          }}
        />
      );
    }

    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => {
          setRegisterNotice(null);
          navigateTo('/register');
        }}
        noticeMessage={registerNotice}
      />
    );
  }

  // If unauthorized user attempted to access /admin:
  if (forbiddenAccess && user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-between font-sans">
        <Navbar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
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
      <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-between font-sans">
        <Navbar
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdminView={true}
        />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 flex-1">
          <AdminView user={user} token={token} onSignOut={handleSignOut} />
        </main>
        <Footer />
      </div>
    );
  }

  const renderCustomerView = () => {
    const dashboardProps = {
      user,
      token,
      accounts,
      transactions,
      onRefresh: fetchUserData,
      onNavigateToTransfer: handleNavigateToTransfer,
      onNavigateToTab: setActiveTab,
      onProfilePictureChange: (profilePicture: string) => setUser((current) => current ? { ...current, profilePicture } : current),
    };

    switch (activeTab) {
      case 'home':
        return <DashboardHomeView key="home" {...dashboardProps} />;
      case 'history':
        return <TransactionHistoryView
          key="history"
          user={user}
          transactions={transactions}
          loading={loading}
          onRefresh={fetchUserData}
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
          onProfilePictureChange={(profilePicture) => setUser((current) => current ? { ...current, profilePicture } : current)}
          onUserUpdated={(updates) => setUser((current) => current ? { ...current, ...updates } : current)}
        />;
      case 'cards':
        return <CardsManagementView key="cards" {...dashboardProps} />;
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
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-between font-sans pb-[calc(5.5rem_+_env(safe-area-inset-bottom))] sm:pb-0">
      <Navbar
        key={user.id}
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminView={false}
        transactions={transactions}
      />

      <main id="customer-view" role="tabpanel" tabIndex={-1} aria-label={`${activeTab} view`} className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-6 pb-6 sm:py-6 flex-1">
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
