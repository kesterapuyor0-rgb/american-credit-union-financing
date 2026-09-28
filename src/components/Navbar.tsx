import React from 'react';
import { BrandLogo } from './BrandLogo';
import { User } from '../types';
import { Lock, ChevronDown } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdminView?: boolean;
  onOpenProfileModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  isAdminView = false,
  onOpenProfileModal,
}) => {
  return (
    <div className="sticky top-0 z-50 w-full shrink-0 bg-white">
      {/* Top Header - Professional Polish: Navy Blue + Red Accent Border */}
      <header className="flex min-h-20 shrink-0 items-center justify-between gap-2 border-b-4 border-[#C9932E] bg-[#0F766E] px-3 py-3 text-white shadow-lg sm:gap-4 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center space-x-2 sm:flex-none sm:space-x-4">
          <div
            className="min-w-0 cursor-pointer"
            onClick={() => {
              if (isAdminView) {
                setActiveTab('overview');
              } else {
                setActiveTab('home');
              }
            }}
          >
            <BrandLogo className="h-10 min-w-0" variant="white" showSubtitle={true} />
          </div>

          {isAdminView && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-400/40 rounded-sm text-amber-200 text-xs font-bold tracking-wide uppercase">
              <Lock className="w-3.5 h-3.5 text-amber-300" />
              <span>Core Ledger Admin</span>
            </div>
          )}
        </div>

        {/* Full user name opens account profile details. */}
        {user ? (
          <div className="flex min-w-0 shrink items-center">
            <button
              id="btn-user-profile-trigger"
              type="button"
              onClick={onOpenProfileModal}
              className="flex max-w-[48vw] items-center gap-1.5 rounded-sm px-1.5 py-2 text-right transition-colors hover:bg-white/10 cursor-pointer group sm:max-w-none sm:gap-2.5 sm:px-2.5 sm:text-left"
              title="Click to view Account Profile & Identification"
            >
              <div className="flex min-w-0 flex-col items-end sm:items-start">
                <span className="hidden text-[9px] opacity-80 uppercase tracking-widest text-slate-200 sm:block">
                  {isAdminView ? 'SYSTEM OPERATOR' : 'SECURE ACCOUNT'}
                </span>
                <span className="break-words text-sm font-bold leading-tight text-white group-hover:text-blue-100 sm:text-base">
                  {user.full_name}
                </span>
              </div>
              <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0 text-white/70 group-hover:text-white" />
            </button>
          </div>
        ) : null}
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
