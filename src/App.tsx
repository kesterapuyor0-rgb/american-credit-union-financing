import React, { useState, useEffect } from 'react';
import { User, BankAccount, Transaction, UserSummary } from './types';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { TransferView } from './views/TransferView';
import { AdminView } from './views/AdminView';
import { SecurityView } from './views/SecurityView';
import { Forbidden403View } from './views/Forbidden403View';
import { RegisterView } from './views/RegisterView';
import { ProfileView } from './views/ProfileView';
import { ProfileModal } from './components/ProfileModal';
import { RefreshCw, Home, Clock3, ArrowLeftRight, UserRound, CreditCard } from 'lucide-react';
import { DashboardHomeView } from './views/DashboardHomeView';
import { getStoredAuthToken, setStoredAuthToken, clearStoredAuthToken } from './utils/api';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>(() => getStoredAuthToken());
  const [activeTab, setActiveTab] = useState<string>('accounts');
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialTransferSourceId, setInitialTransferSourceId] = useState<string | undefined>();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
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
      setActiveTab('accounts');
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
    setActiveTab('transfers');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#0F766E] animate-spin" />
          <div className="text-sm font-bold text-[#0F766E] font-serif tracking-wide">
            American Credit Union Financing
          </div>
          <div className="text-xs text-gray-500">Loading your demo account...</div>
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

    if (currentPath === '/register') {
      return (
        <RegisterView
          onRegisterSuccess={(newUser, authToken) => {
            handleLoginSuccess(newUser, authToken);
          }}
          onNavigateToLogin={(notice) => {
            setRegisterNotice(notice || null);
            navigateTo('/');
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
          onSignOut={handleSignOut}
        />
        <Forbidden403View
          onRedirectToDashboard={() => {
            setForbiddenAccess(false);
            navigateTo('/dashboard');
            setActiveTab('accounts');
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
          onSignOut={handleSignOut}
          isAdminView={true}
        />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 flex-1">
          <AdminView user={user} token={token} onSignOut={handleSignOut} />
        </main>
        <Footer />
      </div>
    );
  }

  // Customer View:
  // Note: Hidden Admin Interfaces constraint:
  // "Ensure zero links, buttons, or visual references to the admin portal exist on the standard user interface."
  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col justify-between font-sans">
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSignOut={handleSignOut}
        isAdminView={false}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 pt-6 pb-24 sm:py-6 flex-1">
        {(activeTab === 'accounts' || activeTab === 'cards') && (
          <DashboardHomeView
            user={user}
            token={token}
            accounts={accounts}
            transactions={transactions}
            onRefresh={fetchUserData}
            onNavigateToTransfer={handleNavigateToTransfer}
            onNavigateToTab={setActiveTab}
            onProfilePictureChange={(profilePicture) => setUser((current) => current ? { ...current, profilePicture } : current)}
          />
        )}

        {activeTab === 'transfers' && (
          <TransferView
            user={user}
            token={token}
            accounts={accounts}
            initialFromAccountId={initialTransferSourceId}
            onTransferComplete={() => {
              fetchUserData();
            }}
            onCancel={() => setActiveTab('accounts')}
          />
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <DashboardView
              user={user}
              token={token}
              accounts={accounts}
              transactions={transactions}
              summary={summary}
              loading={loading}
              onRefresh={fetchUserData}
              onNavigateToTransfer={handleNavigateToTransfer}
            />
          </div>
        )}

        {activeTab === 'security' && <SecurityView user={user} />}

        {activeTab === 'profile' && (
          <ProfileView
            user={user}
            accounts={accounts}
            onProfilePictureChange={(profilePicture) => setUser((current) => current ? { ...current, profilePicture } : current)}
            onReturnToAccounts={() => setActiveTab('accounts')}
            onNavigateToTransfer={() => setActiveTab('transfers')}
          />
        )}
      </main>

      <nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          <button type="button" onClick={() => setActiveTab('accounts')} className={`flex flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${activeTab === 'accounts' ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>
            <Home className="h-5 w-5" />Home
          </button>
          <button type="button" onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${activeTab === 'history' ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>
            <Clock3 className="h-5 w-5" />History
          </button>
          <button type="button" onClick={() => setActiveTab('transfers')} className={`flex flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${activeTab === 'transfers' ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>
            <ArrowLeftRight className="h-5 w-5" />Transfer
          </button>
          <button type="button" onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${activeTab === 'profile' ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>
            <UserRound className="h-5 w-5" />Profile
          </button>
          <button type="button" onClick={() => { setActiveTab('cards'); window.setTimeout(() => document.getElementById('active-cards')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} className={`flex flex-col items-center gap-1 px-1 py-1.5 text-[10px] ${activeTab === 'cards' ? 'font-semibold text-slate-950' : 'text-slate-500'}`}>
            <CreditCard className="h-5 w-5" />Cards
          </button>
        </div>
      </nav>

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
