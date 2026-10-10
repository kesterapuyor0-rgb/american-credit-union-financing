import React from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

interface LandingViewProps {
  onSignIn: () => void;
  onEnroll: () => void;
  onApplyGrant: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onSignIn, onEnroll, onApplyGrant }) => (
  <div className="min-h-[100dvh] overflow-x-hidden bg-white font-sans text-slate-800">
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs leading-5 text-amber-950 sm:text-sm">
      Protect your account: never share your password or one-time verification codes.
    </div>

    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
        <BrandLogo className="min-w-0" />
        <nav aria-label="Main navigation" className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a href="#member-services" className="hidden text-sm font-semibold text-blue-900 hover:text-blue-700 sm:inline">
            Member services
          </a>
          <button
            type="button"
            onClick={onSignIn}
            className="min-h-10 rounded-lg border border-blue-900 px-3 py-2 text-xs font-bold text-blue-950 transition-colors hover:bg-blue-50 sm:px-4 sm:text-sm"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onEnroll}
            className="min-h-10 rounded-lg bg-blue-900 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-800 sm:px-4 sm:text-sm"
          >
            Enroll
          </button>
        </nav>
      </div>
    </header>

    <main>
      <section className="bg-[#102a50] text-white">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-8 sm:px-6 sm:py-12 md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-8 lg:grid-cols-[1fr_420px] lg:gap-12 lg:px-8 lg:py-14">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              Your financial life, made simpler
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Banking that puts members first.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-blue-100 sm:mt-5 sm:text-base sm:leading-7">
              Access your account, keep track of activity, and get help with everyday banking in one convenient place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-blue-950 shadow-sm transition-colors hover:bg-blue-50 sm:px-5"
              >
                Go to online banking <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onEnroll}
                className="min-h-11 rounded-lg border border-white/50 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10 sm:px-5"
              >
                New member? Enroll
              </button>
            </div>
            <div className="mt-6 flex items-center gap-2 text-xs text-blue-100">
              <ShieldCheck size={16} className="shrink-0 text-amber-300" aria-hidden="true" />
              Secure access to your account, wherever you are.
            </div>
          </div>

          <figure className="relative isolate aspect-[3/4] min-h-0 overflow-hidden rounded-2xl border border-white/20 bg-blue-950 shadow-2xl">
            <img
              src="/img/acu2.jpeg"
              alt="Members enjoying time together, with a message about taking savings to the next level"
              className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-950/15 via-transparent to-[#071a34]/70" />
            <figcaption className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-[#102a50]/80 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm sm:text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-300" aria-hidden="true" />
                Flexible savings for what matters to you
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="member-services" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-6 max-w-2xl sm:mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-800">Member services</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Everyday banking, all in one place.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in to view your account dashboard and manage the services available to you.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {[
            ['Account overview', 'Review your account details and available balance.'],
            ['Activity and transfers', 'Keep up with recent transactions and transfer requests.'],
            ['Member support', 'Get help with account access and online services.'],
            ['Business & Micro-Grants', 'Explore community investment, small business growth funding, and personal project support through the Business & Community Grant Program.'],
          ].map(([title, description]) => (
            <article key={title} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 h-1 w-10 rounded-full bg-amber-400" aria-hidden="true" />
              <h3 className="font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              {title === 'Business & Micro-Grants' && (
                <button type="button" onClick={onApplyGrant} className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-900">
                  Apply for Grant
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="trust-heading" className="relative isolate overflow-hidden bg-[#102a50] text-white">
        <img
          src="/img/acu1.jpeg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#071a34]/80" />
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-10 sm:px-6 sm:py-14 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Our commitment</p>
            <h2 id="trust-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Here for your financial journey.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-100 sm:text-base">
              A secure digital banking experience, backed by support when you need it.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <LockKeyhole className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
            <span className="text-sm font-semibold">Member security comes first</span>
          </div>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <span>American Credit Union Financing</span>
        <a href="tel:2762497279" className="font-semibold text-blue-900 hover:underline">
          Member Support: (276) 249-7279
        </a>
      </div>
    </footer>
  </div>
);
