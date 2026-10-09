import { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';

interface LandingViewProps {
  onSignIn: () => void;
  onEnroll: () => void;
}

const services = [
  {
    title: 'Everyday banking',
    description: 'Manage your money with convenient checking and savings options.',
    icon: 'account_balance',
  },
  {
    title: 'Borrow with confidence',
    description: 'Explore auto, personal, and home financing with support at every step.',
    icon: 'directions_car',
  },
  {
    title: 'Plan for what is next',
    description: 'Build healthy financial habits with tools and guidance for your goals.',
    icon: 'savings',
  },
];

const rateDetails = [
  {
    name: 'Savings',
    detail: 'Choose an account that fits the way you save. Contact our team for current rates and account details.',
    icon: 'savings',
  },
  {
    name: 'Certificates',
    detail: 'Explore fixed-term savings options and ask us about current terms, minimums, and rates.',
    icon: 'workspace_premium',
  },
  {
    name: 'Auto loans',
    detail: 'Talk with a lending specialist about financing options for your next vehicle.',
    icon: 'directions_car',
  },
  {
    name: 'Home loans',
    detail: 'Get guidance on home financing options and the application process.',
    icon: 'home',
  },
];

export function LandingView({ onSignIn, onEnroll }: LandingViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedRate, setExpandedRate] = useState<string | null>(null);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="bg-emerald-950 px-4 py-2 text-center text-xs font-medium text-emerald-50 sm:text-sm">
        Your financial well-being matters. Our team is here to help you make confident decisions.
      </div>

      <header className="relative z-20 border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <a href="#home" aria-label="American Credit Union Financing home" onClick={closeMenu}>
            <BrandLogo />
          </a>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-700 md:flex" aria-label="Main navigation">
            <a className="transition hover:text-emerald-700" href="#services">Products &amp; services</a>
            <a className="transition hover:text-emerald-700" href="#rates">Rates</a>
            <a className="transition hover:text-emerald-700" href="#about">Why choose us</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              type="button"
              onClick={onSignIn}
              className="rounded-full px-5 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={onEnroll}
              className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
            >
              Become a member
            </button>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-emerald-900 hover:bg-emerald-50 md:hidden"
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {menuOpen && (
          <nav className="absolute inset-x-0 top-full border-t border-slate-100 bg-white px-5 py-5 shadow-lg md:hidden" aria-label="Mobile navigation">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm font-semibold text-slate-700">
              <a href="#services" onClick={closeMenu}>Products &amp; services</a>
              <a href="#rates" onClick={closeMenu}>Rates</a>
              <a href="#about" onClick={closeMenu}>Why choose us</a>
              <div className="mt-2 flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => { closeMenu(); onSignIn(); }} className="flex-1 rounded-full border border-emerald-700 px-4 py-2.5 font-bold text-emerald-800">
                  Log in
                </button>
                <button type="button" onClick={() => { closeMenu(); onEnroll(); }} className="flex-1 rounded-full bg-emerald-700 px-4 py-2.5 font-bold text-white">
                  Become a member
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section id="home" className="relative isolate overflow-hidden bg-emerald-950">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-700 via-emerald-950 to-slate-950" />
          <div className="absolute -right-32 top-12 -z-10 h-96 w-96 rounded-full border border-emerald-300/10 lg:right-16" />
          <div className="absolute -right-16 top-28 -z-10 h-64 w-64 rounded-full border border-emerald-300/10 lg:right-32" />

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
            <div className="max-w-2xl">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">
                <span className="material-symbols-outlined text-base">volunteer_activism</span>
                Banking built around you
              </p>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Your goals deserve a <span className="text-emerald-300">strong partner.</span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-emerald-50/80">
                Find thoughtful banking, helpful guidance, and financial services designed to support the plans that matter to you.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onEnroll}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400 px-7 py-3.5 font-bold text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
                >
                  Explore membership
                  <span className="material-symbols-outlined text-xl">arrow_forward</span>
                </button>
                <a
                  href="#services"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 font-bold text-white transition hover:bg-white/10"
                >
                  Explore our services
                </a>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              <div className="rounded-3xl border border-white/15 bg-white p-7 shadow-2xl shadow-black/20 sm:p-9">
                <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
                  <span className="material-symbols-outlined text-2xl">lock</span>
                </div>
                <p className="text-sm font-bold uppercase tracking-wider text-emerald-700">Member access</p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Welcome back</h2>
                <p className="mt-3 leading-6 text-slate-600">
                  Sign in to access your account through our existing secure login.
                </p>
                <button
                  type="button"
                  onClick={onSignIn}
                  className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 font-bold text-white transition hover:bg-emerald-800"
                >
                  Log in to online banking
                  <span className="material-symbols-outlined text-xl">login</span>
                </button>
                <p className="mt-5 text-center text-sm text-slate-500">
                  New here?{' '}
                  <button type="button" onClick={onEnroll} className="font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-900">
                    Start membership
                  </button>
                </p>
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-5 text-emerald-50/80">
                <span className="material-symbols-outlined text-emerald-300">verified_user</span>
                <p>For your security, sign-in and enrollment take place on their dedicated pages.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="px-5 py-20 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">What we offer</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Support for every step</h2>
              <p className="mt-4 leading-7 text-slate-600">From day-to-day money management to bigger milestones, explore services to help you move forward.</p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {services.map((service) => (
                <article key={service.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
                    <span className="material-symbols-outlined text-2xl">{service.icon}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-slate-900">{service.title}</h3>
                  <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
                  <a href="#rates" className="mt-6 inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950">
                    Learn more <span className="material-symbols-outlined text-lg">arrow_forward</span>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="rates" className="bg-emerald-50 px-5 py-20 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">Explore your options</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">The right fit starts with a conversation.</h2>
              <p className="mt-5 leading-7 text-slate-600">
                Rates and terms may change. Connect with our team for current details and help finding an option that fits your needs.
              </p>
              <button type="button" onClick={onEnroll} className="mt-7 inline-flex items-center gap-2 rounded-full bg-emerald-800 px-6 py-3 font-bold text-white transition hover:bg-emerald-900">
                Talk with our team <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </div>
            <div className="space-y-3">
              {rateDetails.map((item) => {
                const isExpanded = expandedRate === item.name;
                return (
                  <div key={item.name} className="overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedRate(isExpanded ? null : item.name)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-6"
                    >
                      <span className="flex items-center gap-4">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </span>
                        <span className="font-bold text-slate-900">{item.name}</span>
                      </span>
                      <span className="material-symbols-outlined text-emerald-800">{isExpanded ? 'remove' : 'add'}</span>
                    </button>
                    {isExpanded && <p className="px-6 pb-5 pl-[4.75rem] leading-6 text-slate-600">{item.detail}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="about" className="bg-white px-5 py-20 sm:py-24 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-[2rem] bg-emerald-900 p-8 text-white sm:p-12">
              <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full border border-white/10" />
              <div className="absolute -right-2 top-0 h-36 w-36 rounded-full border border-white/10" />
              <span className="material-symbols-outlined text-5xl text-emerald-300">groups</span>
              <h2 className="relative mt-8 max-w-md text-3xl font-extrabold leading-tight sm:text-4xl">A more personal way to bank.</h2>
              <p className="relative mt-5 max-w-lg leading-7 text-emerald-50/80">
                Get straightforward support, convenient access, and solutions shaped around your priorities.
              </p>
              <button type="button" onClick={onEnroll} className="relative mt-8 inline-flex items-center gap-2 font-bold text-emerald-200 hover:text-white">
                Discover membership <span className="material-symbols-outlined text-xl">arrow_forward</span>
              </button>
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Here for you</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Your money, your plans, your pace.</h2>
              <div className="mt-8 space-y-6">
                <div className="flex gap-4">
                  <span className="material-symbols-outlined mt-1 text-2xl text-emerald-700">support_agent</span>
                  <div><h3 className="font-bold text-slate-900">People ready to help</h3><p className="mt-1 leading-6 text-slate-600">Get answers and guidance from a team that takes time to understand your needs.</p></div>
                </div>
                <div className="flex gap-4">
                  <span className="material-symbols-outlined mt-1 text-2xl text-emerald-700">account_balance_wallet</span>
                  <div><h3 className="font-bold text-slate-900">Options for real life</h3><p className="mt-1 leading-6 text-slate-600">Explore everyday accounts and financing solutions for the moments that matter.</p></div>
                </div>
                <div className="flex gap-4">
                  <span className="material-symbols-outlined mt-1 text-2xl text-emerald-700">security</span>
                  <div><h3 className="font-bold text-slate-900">Security in mind</h3><p className="mt-1 leading-6 text-slate-600">Access your account using the existing secure login and authentication process.</p></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 px-5 py-12 text-slate-300 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="inline-block rounded-lg bg-white px-3 py-2"><BrandLogo /></div>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-400">
              Helpful financial services and personal support for your next step.
            </p>
          </div>
          <div>
            <h2 className="font-bold text-white">Explore</h2>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <a className="hover:text-emerald-300" href="#services">Products &amp; services</a>
              <a className="hover:text-emerald-300" href="#rates">Rates and options</a>
              <a className="hover:text-emerald-300" href="#about">Why choose us</a>
            </div>
          </div>
          <div>
            <h2 className="font-bold text-white">Your account</h2>
            <div className="mt-4 flex flex-col items-start gap-3 text-sm">
              <button type="button" onClick={onSignIn} className="hover:text-emerald-300">Log in</button>
              <button type="button" onClick={onEnroll} className="hover:text-emerald-300">Become a member</button>
              <a className="hover:text-emerald-300" href="https://www.cisa.gov/secure-our-world" target="_blank" rel="noreferrer">Online safety resources</a>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-xs text-slate-500">
          <p>For current product information, rates, and terms, please contact our team.</p>
        </div>
      </footer>
    </div>
  );
}
