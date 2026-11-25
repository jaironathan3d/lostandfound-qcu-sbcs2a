import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import './InformationPages.css';

export const HowItWorksPage = () => (
  <div className="info-page">
    <PublicHeader />
    <main className="info-content">
      <header className="info-intro">
        <p className="info-eyebrow">A FEW SIMPLE STEPS</p>
        <h1>How it works</h1>
        <p>Lost something or found an item on campus? Here’s how to help it find its way home.</p>
      </header>

      <section className="info-steps" aria-label="Lost and found steps">
        <article className="info-step">
          <span className="info-step__number">01</span>
          <span className="info-step__icon" aria-hidden="true">⌕</span>
          <h2>Search the listings</h2>
          <p>Browse recent lost and found reports. Search by an item name, category, or campus location.</p>
          <Link to="/">Browse items <span aria-hidden="true">→</span></Link>
        </article>
        <article className="info-step">
          <span className="info-step__number">02</span>
          <span className="info-step__icon" aria-hidden="true">✎</span>
          <h2>Make a report</h2>
          <p>If you lost something, share a description. If you found an item, report where and when you found it.</p>
          <Link to="/report-item">Report an item <span aria-hidden="true">→</span></Link>
        </article>
        <article className="info-step">
          <span className="info-step__number">03</span>
          <span className="info-step__icon" aria-hidden="true">✓</span>
          <h2>Verify and reunite</h2>
          <p>Confirm ownership using details that are not public, then arrange a safe handover on campus.</p>
          <Link to="/safety-help">Read safety tips <span aria-hidden="true">→</span></Link>
        </article>
      </section>

      <aside className="info-note">
        <strong>Keep private details private.</strong>
        <p>When posting a found item, leave one or two identifying details out of the public description. The owner can use them to verify a claim.</p>
      </aside>
    </main>
    <PublicFooter />
  </div>
);

export const SafetyHelpPage = () => (
  <div className="info-page">
    <PublicHeader />
    <main className="info-content">
      <header className="info-intro">
        <p className="info-eyebrow">LOOK OUT FOR ONE ANOTHER</p>
        <h1>Safety &amp; help</h1>
        <p>Simple steps for reporting, verifying ownership, and bringing belongings back safely.</p>
      </header>

      <section className="info-steps" aria-label="How to use lost and found">
        <article className="info-step">
          <span className="info-step__number">01</span>
          <span className="info-step__icon" aria-hidden="true">⌕</span>
          <h2>Search the listings</h2>
          <p>Browse recent campus reports by item, category, or location.</p>
          <Link to="/">Browse items <span aria-hidden="true">→</span></Link>
        </article>
        <article className="info-step">
          <span className="info-step__number">02</span>
          <span className="info-step__icon" aria-hidden="true">✎</span>
          <h2>Make a report</h2>
          <p>Describe what you lost or found. Keep at least one identifying detail private.</p>
          <Link to="/report-item">Report an item <span aria-hidden="true">→</span></Link>
        </article>
        <article className="info-step">
          <span className="info-step__number">03</span>
          <span className="info-step__icon" aria-hidden="true">✓</span>
          <h2>Verify and reunite</h2>
          <p>Confirm ownership with more than one detail, then arrange a safe handover.</p>
          <Link to="/threads">Join a thread <span aria-hidden="true">→</span></Link>
        </article>
      </section>

      <section className="safety-panel" aria-label="Safety guidelines">
        <article className="safety-tip">
          <span className="safety-tip__icon" aria-hidden="true">01</span>
          <div>
            <h2>Don’t share sensitive details publicly</h2>
            <p>For found items, keep a unique feature, contents, serial number, or identifying mark private so the rightful owner can verify it.</p>
          </div>
        </article>
        <article className="safety-tip">
          <span className="safety-tip__icon" aria-hidden="true">02</span>
          <div>
            <h2>Verify before handing an item over</h2>
            <p>Ask the person claiming an item to describe a detail that was not included in the public report. Never post passwords, student numbers, or personal documents.</p>
          </div>
        </article>
        <article className="safety-tip">
          <span className="safety-tip__icon" aria-hidden="true">03</span>
          <div>
            <h2>Choose a public campus handover</h2>
            <p>Meet in a well-lit, staffed public area during campus hours. For valuables, consider arranging the handover through campus security.</p>
          </div>
        </article>
        <article className="safety-tip">
          <span className="safety-tip__icon" aria-hidden="true">04</span>
          <div>
            <h2>Keep communication respectful</h2>
            <p>Share only the information needed to reunite an item. If a conversation makes you uncomfortable, stop replying and seek help from campus staff.</p>
          </div>
        </article>
      </section>

      <aside className="info-note info-note--help">
        <strong>Need help with an item?</strong>
        <p>Start by checking the listings. If you have found something, use the report flow to share its general description and location.</p>
        <div className="info-actions">
          <Link className="info-button" to="/">Browse items</Link>
          <Link className="info-button info-button--secondary" to="/report-item">Report an item</Link>
        </div>
      </aside>
    </main>
    <PublicFooter />
  </div>
);

const LegalPage = ({ title, eyebrow, paragraphs }: { title: string; eyebrow: string; paragraphs: string[] }) => (
  <div className="info-page">
    <PublicHeader />
    <main className="info-content">
      <header className="info-intro">
        <p className="info-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </header>
      <section className="info-steps" aria-label={title}>
        {paragraphs.map((paragraph) => (
          <article className="info-step" key={paragraph}>
            <p>{paragraph}</p>
          </article>
        ))}
      </section>
    </main>
    <PublicFooter />
  </div>
);

export const TermsPage = () => (
  <LegalPage
    title="Terms of Service"
    eyebrow="PILOT PROGRAM TERMS"
    paragraphs={[
      'This Lost and Found website is an academic pilot system for reporting, finding, claiming, and returning belongings within an approved campus setting.',
      'Users must submit accurate information, avoid fraudulent claims or false reports, respect other users, and use private chat only for appropriate lost-and-found communication.',
      'The system does not guarantee the return or custody of an item. Users remain responsible for safe, respectful, and appropriately supervised item returns.',
      'Abuse, impersonation, harassment, misuse of records, or unauthorized access may result in account suspension or administrator review.',
    ]}
  />
);

export const PrivacyPage = () => (
  <LegalPage
    title="Privacy Notice"
    eyebrow="HOW THIS PILOT HANDLES DATA"
    paragraphs={[
      'The system collects account, student-record, report, claim, conversation, and relevant activity information needed to operate the Lost and Found pilot.',
      'Student IDs and private contact details are restricted to authorized system functions and are not intended for public listing pages.',
      'Passwords are stored as secure hashes. Claim answers, supporting documents, and private messages are restricted to authorized users.',
      'Project owners must review applicable retention, correction, deletion, consent, and participant-handling requirements before real pilot deployment.',
    ]}
  />
);
