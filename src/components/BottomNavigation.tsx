import React from 'react';
import { ArrowLeftRight, CreditCard, Home, Clock3, UserRound } from 'lucide-react';

export type CustomerTab = 'home' | 'history' | 'transfer' | 'profile' | 'cards';

interface BottomNavigationProps {
  activeTab: string;
  onNavigate: (tab: CustomerTab) => void;
}

const itemClass = (selected: boolean) =>
  `flex min-h-12 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 ${
    selected ? 'font-semibold text-teal-800' : 'text-slate-500 hover:bg-emerald-50 hover:text-teal-800'
  }`;

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onNavigate }) => (
  <nav
    aria-label="Bottom navigation"
    className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] backdrop-blur sm:hidden"
    style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
  >
    <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
      <button type="button" onClick={() => onNavigate('home')} className={itemClass(activeTab === 'home')} aria-current={activeTab === 'home' ? 'page' : undefined}>
        <Home aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="whitespace-nowrap">Home</span>
      </button>
      <button type="button" onClick={() => onNavigate('history')} className={itemClass(activeTab === 'history')} aria-current={activeTab === 'history' ? 'page' : undefined}>
        <Clock3 aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="whitespace-nowrap">History</span>
      </button>
      <button type="button" onClick={() => onNavigate('transfer')} className={itemClass(activeTab === 'transfer')} aria-current={activeTab === 'transfer' ? 'page' : undefined}>
        <ArrowLeftRight aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="whitespace-nowrap">Transfer</span>
      </button>
      <button type="button" onClick={() => onNavigate('profile')} className={itemClass(activeTab === 'profile')} aria-current={activeTab === 'profile' ? 'page' : undefined}>
        <UserRound aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="whitespace-nowrap">Profile</span>
      </button>
      <button type="button" onClick={() => onNavigate('cards')} className={itemClass(activeTab === 'cards')} aria-current={activeTab === 'cards' ? 'page' : undefined}>
        <CreditCard aria-hidden="true" className="h-5 w-5 shrink-0" /><span className="whitespace-nowrap">Cards</span>
      </button>
    </div>
  </nav>
);
