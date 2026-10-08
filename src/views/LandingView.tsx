import React from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

interface LandingViewProps {
  onSignIn: () => void;
  onEnroll: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSignIn, onEnroll }) => (
  <div className="min-h-screen bg-white font-sans text-slate-800">
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-950 sm:text-sm">
      Protect your account: never share your password or one-time verification codes.
    </div>

    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <BrandLogo showSubtitle />
        <nav aria-label="Main navigation" className="flex items-center gap-3">
          <a href="#member-services" className="hidden text-sm font-semibold text-teal-900 hover:text-teal-700 sm:inline">
            Member services
          </a>
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-lg border border-teal-800 px-4 py-2 text-sm font-bold text-teal-900 transition-colors hover:bg-teal-50"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onEnroll}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-900"
          >
            Enroll
          </button>
        </nav>
      </div>
    </header>

    <main>
      <section className="relative isolate overflow-hidden bg-[#073f36] text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_10%,rgba(16,185,129,0.32),transparent_42%),linear-gradient(125deg,#073f36_0%,#0f766e_58%,#115e59_100%)]" />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8 lg:py-28">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">
              Your financial life, made simpler
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Banking that puts members first.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-emerald-50 sm:text-lg">
              Access your account, keep track of activity, and get help with everyday banking in one convenient place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-teal-950 shadow-sm transition-colors hover:bg-emerald-50"
              >
                Go to online banking <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onEnroll}
                className="min-h-12 rounded-lg border border-white/50 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                New member? Enroll
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-xl backdrop-blur-sm sm:p-8">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-emerald-200/15 text-emerald-100">
              <LockKeyhole size={23} aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold sm:text-2xl">Secure account access</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50">
              Sign in through our existing protected account portal. New members can start enrollment using the same secure process.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-300 px-4 py-3 text-sm font-bold text-teal-950 transition-colors hover:bg-emerald-200"
            >
              Continue to sign in
            </button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-100">
              <ShieldCheck size={15} aria-hidden="true" />
              Verification is handled by the account portal.
            </p>
          </aside>
        </div>
      </section>

      <section id="member-services" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-800">Member services</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Everyday banking, all in one place.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in to view your account dashboard and manage the services available to you.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Account overview', 'Review your account details and available balance.'],
            ['Activity and transfers', 'Keep up with recent transactions and transfer requests.'],
            ['Member support', 'Get help with account access and online services.'],
          ].map(([title, description]) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 h-1 w-10 rounded-full bg-emerald-600" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <span>American Credit Union Financing</span>
        <a href="tel:2762497279" className="font-semibold text-teal-900 hover:underline">
          Member Support: (276) 249-7279
        </a>
      </div>
    </footer>
  </div>
);
