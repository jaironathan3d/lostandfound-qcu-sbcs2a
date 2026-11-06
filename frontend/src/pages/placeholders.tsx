export const LoginPage = () => <h1>Login (Placeholder)</h1>;

export const RegisterPage = () => <h1>Register (Placeholder)</h1>;

export const BrowseItemsPage = () => <h1>Browse Items (Placeholder)</h1>;

export const ReportItemPage = () => <h1>Report Item (Placeholder)</h1>;

export const ItemDetailPage = () => <h1>Item Detail + Thread (Placeholder)</h1>;

export const MyClaimsPage = () => <h1>My Claims (Placeholder)</h1>;

export const GuardDashboardPage = () => <h1>Guard Dashboard (Placeholder)</h1>;

export const AdminDashboardPage = () => <h1>Admin Dashboard (Placeholder)</h1>;

import './HomePage.css';

export const HomePage = () => (
  <div className="home-page">
    <section className="home-page__story" aria-label="About campus lost and found">
      <a className="home-page__brand" href="/" aria-label="QCU Lost and Found home">
        <img src="/qcu_logo.png" alt="" />
        <span>QUEZON CITY<br />UNIVERSITY</span>
      </a>

      <div className="home-page__story-content">
        <p className="home-page__eyebrow">CAMPUS LOST &amp; FOUND</p>
        <h1>Good things find<br />their way back.</h1>
        <p className="home-page__story-copy">
          A little help can mean a lot.<br />Let’s bring lost belongings back home.
        </p>
        <div className="home-page__photo" role="img" aria-label="Personal belongings left on a campus table" />
        <p className="home-page__eyebrow home-page__eyebrow--photo">SMALL ACTIONS. HAPPY REUNIONS.</p>
        <p className="home-page__report">Report it. Find it. Reunite.</p>
        <p className="home-page__community">For the Quezon City University community</p>
      </div>
    </section>

    <section className="home-page__welcome" aria-label="Welcome">
      <div className="home-page__welcome-content">
        <p className="home-page__eyebrow">WELCOME TO QCU LOST &amp; FOUND</p>
        <h2>Lost something?<br />Found something?</h2>
        <p className="home-page__description">
          Help reunite lost items with their owners on campus. Report an item or browse what has been found.
        </p>

        <div className="home-page__actions">
          <a className="home-page__button" href="/login">Log in</a>
          <a className="home-page__button home-page__button--secondary" href="/register">Sign up</a>
        </div>

        <div className="home-page__browse-block">
          <p>Just looking for an item?</p>
          <a href="/items">Browse items <span aria-hidden="true">→</span></a>
        </div>

        <footer className="home-page__footer">
          <p>A campus community that looks out for each other.</p>
          <span>Quezon City University</span>
        </footer>
      </div>
    </section>
  </div>
);
