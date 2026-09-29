import React from 'react';
import { BrandLogo } from './BrandLogo';
import { User } from '../types';

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
  return (
    <div className="sticky top-0 z-50 w-full shrink-0 bg-white">
      <header className="flex min-h-[72px] shrink-0 items-center border-b border-amber-500/50 bg-slate-900 px-4 py-3 text-white shadow-md sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center">
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
                  ? 'border-b-4 border-[#0F766E] text-[#0F766E] font-bold'
                  : 'text-gray-600 hover:text-[#0F766E] font-medium'
              }`}
            >
              Accounts
            </button>

            <button
              id="tab-transfers"
              onClick={() => setActiveTab('transfer')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'transfer'
                  ? 'border-b-4 border-[#0F766E] text-[#0F766E] font-bold'
                  : 'text-gray-600 hover:text-[#0F766E] font-medium'
              }`}
            >
              Transfers
            </button>

            <button
              id="tab-history"
              onClick={() => setActiveTab('history')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'history'
                  ? 'border-b-4 border-[#0F766E] text-[#0F766E] font-bold'
                  : 'text-gray-600 hover:text-[#0F766E] font-medium'
              }`}
            >
              Bill Pay & Activity
            </button>

            <button
              id="tab-security"
              onClick={() => setActiveTab('security')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'security'
                  ? 'border-b-4 border-[#0F766E] text-[#0F766E] font-bold'
                  : 'text-gray-600 hover:text-[#0F766E] font-medium'
              }`}
            >
              Security Center
            </button>

            <button
              id="tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center px-1 text-sm transition-colors cursor-pointer whitespace-nowrap h-full ${
                activeTab === 'profile'
                  ? 'border-b-4 border-[#0F766E] text-[#0F766E] font-bold'
                  : 'text-gray-600 hover:text-[#0F766E] font-medium'
              }`}
            >
              Profile & Details
            </button>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            <span className="text-xs text-gray-500 italic hidden lg:inline">
              Last login: Today at 09:42 AM EST
            </span>
            <div className="hidden sm:flex items-center space-x-1.5 bg-emerald-50 px-2 py-1 rounded-sm border border-emerald-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                Encrypted
              </span>
            </div>
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
                  ? 'bg-[#C9932E] text-white shadow-xs'
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
                  ? 'bg-[#C9932E] text-white shadow-xs'
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
                  ? 'bg-[#C9932E] text-white shadow-xs'
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
