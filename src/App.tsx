import React, { useState } from 'react';
import { EnrollmentDemo } from './components/EnrollmentDemo';

export default function App() {
  const [showEnrollmentDemo, setShowEnrollmentDemo] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userId, setUserId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [expandedRate, setExpandedRate] = useState<string | null>(null);
  const [loginHelp, setLoginHelp] = useState<'recovery' | 'enrollment' | null>(null);
  const [footerInfo, setFooterInfo] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Authenticating secure portal session for: ${userId}`);
  };

  if (showEnrollmentDemo) {
    return <EnrollmentDemo onBack={() => setShowEnrollmentDemo(false)} />;
  }

  return (
    <div style={styles.pageWrapper}>
      {/* Top Warning Banner */}
      <div style={styles.alertContainer}>
        <div style={styles.warningBox}>
          <span style={styles.alertIcon}>⚠️</span>
          <span><strong>Warning:</strong> Fraudsters are spoofing calls from our 800 or 817 numbers. Don't share personal information, one-time codes, or log-in details over the phone. <a href="#security" style={styles.alertLink}>Learn more about spoofing scams</a>.</span>
        </div>
      </div>

      {/* Main Header with Anniversary Logo Style */}
      <header style={styles.header}>
        <div style={styles.headerContainer}>
          <div style={styles.brandGroup}>
            <div style={styles.logoBlock}>
              <span style={styles.logoTopText}>American CreditUnionFinancing</span>
              <span style={styles.logoMainText}>Credit Union</span>
            </div>
            <div style={styles.anniversaryBadge}>
              <span style={styles.annivNum}>90</span>
              <span style={styles.annivSub}>YEARS</span>
            </div>
          </div>
          <button
            type="button"
            style={styles.headerMenuToggle}
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span style={styles.hamburger}>{isMenuOpen ? '×' : '☰'}</span>
            <span style={styles.menuLabel}>{isMenuOpen ? 'Close' : 'Menu'}</span>
          </button>
        </div>
        {isMenuOpen && (
          <nav id="primary-navigation" aria-label="Main navigation" style={styles.navigationMenu}>
            {[
              ['Online Banking', '#login'],
              ['Our Rates', '#rates'],
              ['Member Benefits', '#benefits'],
              ['Cybersecurity', '#security'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                style={styles.navigationLink}
                onClick={() => setIsMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* Hero Section with Family Graphic Background */}
      <section style={styles.heroSection}>
        <div style={styles.heroContentOverlay}>
          <div style={styles.heroTextContainer}>
            <h1 style={styles.heroHeadline}>
              PROTECTING THEM COULD BE A BIGGER WIN FOR YOU
            </h1>
            <p style={styles.heroSubText}>
              Review your beneficiaries or contact information online and you'll be entered in a drawing for a chance to win $1,000!*
            </p>
            <a href="#benefits" style={styles.heroCtaButton}>LEARN MORE</a>
          </div>
        </div>
      </section>

      {/* Secure Online Banking Access Section */}
      <section id="login" style={styles.loginSection}>
        <div style={styles.loginCard}>
          <div style={styles.loginCardHeader}>
            <h2 style={styles.loginTitle}>Log In to Online Banking</h2>
            <p style={styles.loginSubtitle}>Enter your User ID and Passcode to securely access your accounts.</p>
          </div>

          <form onSubmit={handleLogin} style={styles.formSpace}>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>USER ID</label>
              <input 
                type="text" 
                style={styles.textInput} 
                placeholder="Enter your User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required 
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>PASSCODE</label>
              <div style={styles.passwordWrapper}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  style={styles.textInput} 
                  placeholder="Enter your Passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  required 
                />
                <button 
                  type="button" 
                  style={styles.showHideBtn}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={styles.formLinksRow}>
              <a
                href="#login-help"
                style={styles.linkText}
                aria-expanded={loginHelp === 'recovery'}
                onClick={() => setLoginHelp(loginHelp === 'recovery' ? null : 'recovery')}
              >
                Forgot User ID/Passcode?
              </a>
            </div>

            <button type="submit" style={styles.submitButton}>
              CONTINUE &rarr;
            </button>
          </form>

          {loginHelp && (
            <div id="login-help" style={styles.helpPanel} role="status">
              <strong>{loginHelp === 'recovery' ? 'Need help signing in?' : 'Ready to enroll?'}</strong>
              <p style={styles.helpPanelText}>
                {loginHelp === 'recovery'
                  ? 'For help recovering your User ID or Passcode, contact Member Support.'
                  : 'Contact Member Support for help enrolling in Online Banking.'}
              </p>
              <a href="tel:2762497279" style={styles.linkText}>Call (276) 249-7279</a>
            </div>
          )}

          <div style={styles.enrollBox}>
            <p style={styles.enrollText}>Don't have Online Banking?</p>
            <a
              href="#enroll"
              style={styles.enrollLink}
              onClick={(event) => {
                event.preventDefault();
                setShowEnrollmentDemo(true);
              }}
            >
              Create an Account / Enroll Now &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Cybersecurity Awareness Section */}
      <section id="security" style={styles.cyberSection}>
        <div style={styles.cyberCard}>
          <h3 style={styles.cyberTitle}>Cybersecurity Awareness Month</h3>
          <p style={styles.cyberText}>
            Cyber threats are getting faster and smarter. Check out best practices from CISA.Gov for protecting yourself online.
          </p>
          <a href="https://www.cisa.gov/secure-our-world" target="_blank" rel="noreferrer" style={styles.cyberLink}>Learn more.</a>
        </div>
      </section>

      {/* Rates Section */}
      <section id="rates" style={styles.ratesSection}>
        <div style={styles.ratesHeader}>
          <span style={styles.ratesIcon}>📊</span>
          <h2 style={styles.ratesHeading}>OUR RATES</h2>
        </div>

        <div style={styles.bankingGridTitle}>BANKING</div>

        <div style={styles.ratesGrid}>
          <div style={styles.rateCard}>
            <span style={styles.apyLabel}>APY as high as</span>
            <span style={styles.apyValue}>2.02%</span>
            <span style={styles.apyType}>Savings</span>
            <span style={styles.apyDesc}>Share/IRA Accounts</span>
          </div>
          <div style={styles.rateCard}>
            <span style={styles.apyLabel}>APY as high as</span>
            <span style={styles.apyValue}>4.05%</span>
            <span style={styles.apyType}>Short-Term Share Certificate</span>
            <span style={styles.apyDesc}>Share Certificate</span>
          </div>
          <div style={styles.rateCard}>
            <span style={styles.apyLabel}>APY as high as</span>
            <span style={styles.apyValue}>4.00%</span>
            <span style={styles.apyType}>Share Certificate</span>
            <span style={styles.apyDesc}>Share/IRA Certificates</span>
          </div>
          <div style={styles.rateCard}>
            <span style={styles.apyLabel}>APY as high as</span>
            <span style={styles.apyValue}>4.07%</span>
            <span style={styles.apyType}>Ladder Certificates</span>
            <span style={styles.apyDesc}>Share/IRA Certificates</span>
          </div>
        </div>

        <div style={styles.scheduleLinkWrapper}>
          <a href="#rates" style={styles.scheduleLink}>^Savings Rates and Fee Schedule</a>
        </div>

        <div style={styles.accordionList}>
          {['AUTO & RECREATIONAL LOANS', 'HOME LOANS', 'VISA CREDIT CARDS', 'BUSINESS BANKING'].map((category) => {
            const isExpanded = expandedRate === category;
            const panelId = `rate-info-${category.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
            return (
              <div key={category}>
                <button
                  type="button"
                  style={styles.accordionItem}
                  aria-expanded={isExpanded}
                  aria-controls={panelId}
                  onClick={() => setExpandedRate(isExpanded ? null : category)}
                >
                  <span>{category}</span>
                  <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                  <div id={panelId} style={styles.accordionPanel}>
                    <p>For current {category.toLowerCase()} options, rates, and eligibility, contact Member Support.</p>
                    <a href="tel:2762497279" style={styles.accordionLink}>Call (276) 249-7279</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Member Benefits Section */}
      <section id="benefits" style={styles.benefitsSection}>
        <div style={styles.benefitsInner}>
          <div style={styles.giftIcon}>🎁</div>
          <h2 style={styles.benefitsHeading}>MEMBER BENEFITS</h2>
          
          <div style={styles.benefitBlock}>
            <h4 style={styles.benefitTitle}>Bonus Dividends</h4>
            <p style={styles.benefitDesc}>
              Since we first began offering Bonus Dividends, the Credit Union has returned more than $215 million to our members.
            </p>
            <p style={styles.benefitSubNote}>Bonus Dividends are not guaranteed.</p>
          </div>

          <div style={styles.benefitBlock}>
            <h4 style={styles.benefitTitle}>Loan Discounts</h4>
            <p style={styles.benefitDesc}>
              We know you have options so we want to reward you with a variety of discounts available on vehicle and home equity loans.
            </p>
          </div>

          <a href="#benefits" style={styles.allBenefitsBtn}>SEE ALL MEMBERSHIP BENEFITS</a>
        </div>
      </section>

      {/* Official Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <h3 style={styles.footerBrand}>American Credit Union Financing</h3>
          <div style={styles.footerLinksCol}>
            {['Online Privacy Policy', 'Privacy Notice', 'Website Accessibility'].map((item) => (
              <a
                key={item}
                href="#footer-information"
                style={styles.footerLink}
                aria-expanded={footerInfo === item}
                onClick={() => setFooterInfo(footerInfo === item ? null : item)}
              >
                {item}
              </a>
            ))}
          </div>

          {footerInfo && (
            <div id="footer-information" style={styles.footerInformation} role="status">
              <strong>{footerInfo}</strong>
              <p style={styles.supportText}>
                For details about {footerInfo.toLowerCase()}, contact Member Support at{' '}
                <a href="tel:2762497279" style={styles.footerLink}>(276) 249-7279</a>.
              </p>
            </div>
          )}

          <div id="support" style={styles.footerSupport}>
            <p style={styles.supportHeading}>Questions?</p>
            <p style={styles.supportText}>Chat Hrs: Monday - Saturday, 8 a.m. - 5 p.m., CDT</p>
            <p style={styles.supportPhone}><strong>(276)249-7279</strong> within the U.S.</p>
            <p style={styles.supportPhone}><strong>(276) 249-7279 </strong> Outside USA, Canada, Puerto Rico & U.S. Virgin Islands</p>
            <p style={styles.routingNum}><strong>ABA / Routing # 311992904</strong></p>
          </div>

          <div style={styles.ncuaBox}>
            <p style={styles.ncuaText}>
              Your savings federally insured to at least $250,000 and backed by the full faith and credit of the United States Government.
            </p>
            <div style={styles.ncuaEmblem}>NCUA</div>
            <p style={styles.ncuaSub}>National Credit Union Administration, a U.S. Government Agency</p>
          </div>

          <div style={styles.socialRow}>
            <span>Let's Connect:</span>
            <div style={styles.socialIcons}>📘 📸 ✖️ YouTube</div>
          </div>

          <p style={styles.copyrightText}>
            &copy; American Credit Union Financing 2026. I The Symbol are marks of American Credit Union, Inc. If you are using a screen reader and are having problems using this website, please call (276)-249-7279 for assistance.
          </p>
          <p style={styles.equalHousing}>Equal Housing Lender</p>
        </div>
      </footer>
    </div>
  );
}

// Styling aligned with the official green/teal mobile reference design
const styles: { [key: string]: React.CSSProperties } = {
  pageWrapper: {
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#1e293b',
  },
  alertContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  warningBox: {
    backgroundColor: '#fff7ed',
    color: '#9a3412',
    padding: '12px 16px',
    fontSize: '13px',
    borderBottom: '1px solid #ffedd5',
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
  },
  alertIcon: {
    fontSize: '16px',
  },
  alertLink: {
    color: '#c2410c',
    fontWeight: 600,
  },
  header: {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '12px 16px',
  },
  headerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBlock: {
    display: 'flex',
    flexDirection: 'column',
  },
  logoTopText: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '0.5px',
  },
  logoMainText: {
    fontSize: '18px',
    fontWeight: 900,
    color: '#0c4a43', // Maintaining your custom rich green/teal brand signature
    letterSpacing: '-0.5px',
  },
  anniversaryBadge: {
    border: '2px solid #064e3b',
    borderRadius: '50%',
    width: '38px',
    height: '38px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#064e3b',
  },
  annivNum: {
    fontSize: '13px',
    fontWeight: 900,
    lineHeight: '1',
  },
  annivSub: {
    fontSize: '7px',
    fontWeight: 700,
  },
  headerMenuToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#064e3b',
    backgroundColor: 'transparent',
    border: 'none',
    padding: '4px',
  },
  hamburger: {
    lineHeight: 1,
  },
  menuLabel: {
    fontSize: '13px',
    fontWeight: 700,
  },
  navigationMenu: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: '16px',
    maxWidth: '1200px',
    margin: '12px auto 0',
    padding: '12px 0 4px',
    borderTop: '1px solid #e2e8f0',
  },
  navigationLink: {
    color: '#064e3b',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 700,
  },
  heroSection: {
    position: 'relative',
    backgroundColor: '#064e3b',
    backgroundImage: 'linear-gradient(rgba(6,78,59,0.75), rgba(6,78,59,0.85)), url("https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1000&q=80")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    color: '#ffffff',
    padding: '60px 20px',
    textAlign: 'center',
  },
  heroContentOverlay: {
    maxWidth: '600px',
    margin: '0 auto',
  },
  heroTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    alignItems: 'center',
  },
  heroHeadline: {
    fontSize: '28px',
    fontWeight: 900,
    lineHeight: '1.2',
    margin: 0,
    letterSpacing: '-0.5px',
  },
  heroSubText: {
    fontSize: '15px',
    color: '#e2e8f0',
    lineHeight: '1.5',
    margin: 0,
  },
  heroCtaButton: {
    backgroundColor: '#064e3b',
    color: '#ffffff',
    border: '2px solid #ffffff',
    padding: '12px 28px',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 800,
    textDecoration: 'none',
    marginTop: '10px',
  },
  loginSection: {
    backgroundColor: '#f1f5f9',
    padding: '30px 16px',
    display: 'flex',
    justifyContent: 'center',
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    width: '100%',
    maxWidth: '440px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #cbd5e1',
  },
  loginCardHeader: {
    marginBottom: '20px',
  },
  loginTitle: {
    fontSize: '20px',
    fontWeight: 800,
    color: '#064e3b',
    margin: '0 0 6px 0',
  },
  loginSubtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
  },
  formSpace: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  inputLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#334155',
    letterSpacing: '0.5px',
  },
  textInput: {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    border: '1px solid #94a3b8',
    borderRadius: '4px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc',
  },
  passwordWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  showHideBtn: {
    position: 'absolute',
    right: '12px',
    backgroundColor: 'transparent',
    border: 'none',
    color: '#064e3b',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '13px',
  },
  formLinksRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  linkText: {
    color: '#064e3b',
    fontSize: '13px',
    textDecoration: 'none',
    fontWeight: 600,
  },
  submitButton: {
    backgroundColor: '#064e3b',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 800,
    cursor: 'pointer',
    textAlign: 'center',
  },
  enrollBox: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center',
  },
  helpPanel: {
    marginTop: '16px',
    padding: '14px',
    borderRadius: '4px',
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    fontSize: '13px',
    lineHeight: '1.5',
  },
  helpPanelText: {
    margin: '6px 0',
  },
  enrollText: {
    fontSize: '13px',
    color: '#64748b',
    margin: '0 0 4px 0',
  },
  enrollLink: {
    fontSize: '14px',
    color: '#064e3b',
    fontWeight: 700,
    textDecoration: 'none',
  },
  cyberSection: {
    padding: '20px 16px',
    backgroundColor: '#ffffff',
  },
  cyberCard: {
    border: '1px solid #059669',
    borderRadius: '8px',
    padding: '20px',
    backgroundColor: '#ecfdf5',
    maxWidth: '600px',
    margin: '0 auto',
  },
  cyberTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#047857',
    margin: '0 0 8px 0',
  },
  cyberText: {
    fontSize: '14px',
    color: '#334155',
    lineHeight: '1.5',
    margin: '0 0 10px 0',
  },
  cyberLink: {
    color: '#059669',
    fontWeight: 700,
    textDecoration: 'none',
    fontSize: '14px',
  },
  ratesSection: {
    backgroundColor: '#047857',
    color: '#ffffff',
    padding: '40px 16px',
  },
  ratesHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '20px',
  },
  ratesIcon: {
    fontSize: '24px',
  },
  ratesHeading: {
    fontSize: '22px',
    fontWeight: 900,
    margin: 0,
    letterSpacing: '1px',
  },
  bankingGridTitle: {
    textAlign: 'center',
    fontSize: '16px',
    fontWeight: 800,
    marginBottom: '20px',
    letterSpacing: '1px',
  },
  ratesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '16px',
    maxWidth: '900px',
    margin: '0 auto 20px auto',
  },
  rateCard: {
    backgroundColor: '#ffffff',
    color: '#1e293b',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  apyLabel: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 700,
  },
  apyValue: {
    fontSize: '28px',
    fontWeight: 900,
    color: '#047857',
  },
  apyType: {
    fontSize: '15px',
    fontWeight: 800,
    color: '#1e293b',
  },
  apyDesc: {
    fontSize: '12px',
    color: '#64748b',
  },
  scheduleLinkWrapper: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  scheduleLink: {
    color: '#ffffff',
    fontSize: '13px',
    textDecoration: 'underline',
  },
  accordionList: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  accordionItem: {
    backgroundColor: '#ffffff',
    color: '#047857',
    padding: '16px 20px',
    borderRadius: '6px',
    fontWeight: 800,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '15px',
    textAlign: 'left',
    width: '100%',
    border: 'none',
    cursor: 'pointer',
  },
  accordionPanel: {
    backgroundColor: '#ecfdf5',
    color: '#1e293b',
    padding: '16px 20px',
    borderRadius: '0 0 6px 6px',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  accordionLink: {
    color: '#065f46',
    fontWeight: 700,
  },
  benefitsSection: {
    backgroundColor: '#047857',
    color: '#ffffff',
    padding: '40px 16px 60px 16px',
    borderTop: '2px solid rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
  benefitsInner: {
    maxWidth: '700px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
  },
  giftIcon: {
    fontSize: '36px',
  },
  benefitsHeading: {
    fontSize: '24px',
    fontWeight: 900,
    margin: 0,
    letterSpacing: '1px',
  },
  benefitBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: '24px',
    borderRadius: '8px',
    width: '100%',
    textAlign: 'left',
  },
  benefitTitle: {
    fontSize: '18px',
    fontWeight: 800,
    margin: '0 0 8px 0',
  },
  benefitDesc: {
    fontSize: '14px',
    lineHeight: '1.5',
    margin: '0 0 8px 0',
    color: '#f1f5f9',
  },
  benefitSubNote: {
    fontSize: '12px',
    color: '#cbd5e1',
    margin: 0,
    fontStyle: 'italic',
  },
  allBenefitsBtn: {
    backgroundColor: '#ffffff',
    color: '#047857',
    padding: '14px 28px',
    borderRadius: '4px',
    fontWeight: 800,
    textDecoration: 'none',
    fontSize: '14px',
    marginTop: '10px',
  },
  footer: {
    backgroundColor: '#06251d',
    color: '#94a3b8',
    padding: '40px 20px',
    fontSize: '13px',
  },
  footerContent: {
    maxWidth: '900px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  footerBrand: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 900,
    margin: 0,
  },
  footerLinksCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  footerLink: {
    color: '#6ee7b7',
    textDecoration: 'none',
    fontWeight: 600,
  },
  footerInformation: {
    border: '1px solid #334155',
    borderRadius: '6px',
    padding: '16px',
    lineHeight: '1.5',
  },
  footerSupport: {
    borderTop: '1px solid #1e293b',
    borderBottom: '1px solid #1e293b',
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  supportHeading: {
    color: '#ffffff',
    fontWeight: 800,
    margin: '0 0 4px 0',
  },
  supportText: {
    margin: 0,
  },
  supportPhone: {
    margin: 0,
    color: '#ffffff',
  },
  routingNum: {
    color: '#ffffff',
    marginTop: '6px',
  },
  ncuaBox: {
    backgroundColor: '#0b2a23',
    padding: '16px',
    borderRadius: '6px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  ncuaText: {
    fontSize: '12px',
    margin: 0,
    color: '#cbd5e1',
  },
  ncuaEmblem: {
    backgroundColor: '#ffffff',
    color: '#06251d',
    fontWeight: 900,
    width: '60px',
    margin: '0 auto',
    padding: '4px',
    borderRadius: '4px',
    fontSize: '14px',
  },
  ncuaSub: {
    fontSize: '11px',
    margin: 0,
    color: '#94a3b8',
  },
  socialRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#ffffff',
    fontWeight: 700,
  },
  socialIcons: {
    fontSize: '16px',
  },
  copyrightText: {
    fontSize: '11px',
    lineHeight: '1.5',
    margin: 0,
    color: '#64748b',
  },
  equalHousing: {
    fontSize: '12px',
    color: '#ffffff',
    fontWeight: 700,
    margin: 0,
  },
};
