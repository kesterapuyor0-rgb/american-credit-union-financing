import React from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';

export const MemberServicesView: React.FC = () => (
  <div className="min-h-screen bg-[#f3f7f6] text-slate-800">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <BrandLogo />
        <a
          href="tel:2762497279"
          className="text-sm font-semibold text-teal-800 hover:text-teal-950"
        >
          Member Support: (276) 249-7279
        </a>
      </div>
    </header>

    <main className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16 lg:px-8 lg:py-20">
      <section className="max-w-xl">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-teal-800">
          Member services
        </p>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          Banking designed around you.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
          Manage your everyday banking with convenient account access, helpful
          member services, and support when you need it.
        </p>

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-800">
            <ShieldCheck size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Your security matters</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Protect your sign-in credentials and never share verification
              codes with anyone.
            </p>
          </div>
        </div>
      </section>

      <section
        className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-35px_rgba(15,118,110,0.4)]"
        aria-labelledby="member-support-heading"
      >
        <div className="h-1.5 bg-teal-700" aria-hidden="true" />
        <div className="p-6 sm:p-8">
          <div className="mb-6 grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800">
            <LockKeyhole size={21} aria-hidden="true" />
          </div>

          <h2 id="member-support-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            How can we help?
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Our Member Support team can help with account access, enrollment,
            and questions about your services.
          </p>

          <a
            href="tel:2762497279"
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-900"
          >
            Call Member Support
          </a>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Monday–Saturday, 8 a.m.–5 p.m. Central Time
          </p>
        </div>
      </section>
    </main>

    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p>American Credit Union Financing</p>
        <p className="inline-flex items-center gap-2">
          <LockKeyhole size={14} aria-hidden="true" />
          Protect your account by keeping your credentials confidential.
        </p>
      </div>
    </footer>
  </div>
);
