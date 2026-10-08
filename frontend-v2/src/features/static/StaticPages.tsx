import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { ENV } from '@/config/env';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle, setCanonical } from '@/hooks/useSeo';

const Page: React.FC<{ children: React.ReactNode; intro?: string }> = ({ children, intro }) => (
  <div className="mx-auto max-w-narrow px-4 py-10 sm:px-6">
    <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink [&_h2]:pt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
      {intro && <p className="text-base text-muted">{intro}</p>}
      {children}
    </div>
  </div>
);

const UPDATED = 'Last updated when this build was released.';

export const HowItWorksPage: React.FC = () => {
  useDocumentTitle('How it works', 'Search a whole home, compare the full price and book it in three steps.');
  setCanonical(ROUTES.HOW_IT_WORKS);

  return (
    <Page intro="Three steps from search to check-in, with the same rules at every step.">
      <h1 className="font-heading text-3xl font-semibold text-ink">How {BRAND.name} works</h1>

      <h2>1. Search</h2>
      <p>
        Enter a city, your dates and how many guests are travelling. Dates are optional: searching without dates
        shows every home that matches, with the nightly rate as the starting price.
      </p>

      <h2>2. Compare</h2>
      <p>
        Each card shows the base nightly rate. Once you add dates, the card shows the whole stay price, and the
        listing page lists the nightly rate, cleaning fee, service fee, taxes, length-of-stay discounts and the
        total, all calculated on our servers. Nothing is recalculated in your browser.
      </p>

      <h2>3. Book</h2>
      <p>
        Some homes can be booked instantly: the stay is confirmed as soon as you pay. Others are a request: you are
        charged straight away and the host has {BRAND.hostResponseHours} hours to accept. If the host declines, or
        does not answer in time, you are refunded in full.
      </p>

      <h2>Payment</h2>
      <p>
        Payment uses a tokenised payment method. We never receive or store your card number. A booking that is not
        paid within {BRAND.paymentHoldMinutes} minutes is released automatically.
      </p>

      <h2>After you book</h2>
      <p>
        Your trip lives in <Link className="text-primary underline underline-offset-4" to={ROUTES.TRIPS}>Trips</Link>,
        your messages in the inbox, and your payout as a host is released {BRAND.payoutDelayHours} hours after
        check-in.
      </p>

      <h2>Reviews</h2>
      <p>
        Guests and hosts each write one review after a stay, and the two are revealed together. You have{' '}
        {BRAND.reviewWindowDays} days after check-out to write yours.
      </p>
    </Page>
  );
};

export const CancellationPoliciesPage: React.FC = () => {
  useDocumentTitle(
    'Cancellation policies',
    'The three cancellation policies with their exact refund thresholds: flexible, moderate and strict.'
  );
  setCanonical(ROUTES.CANCELLATION_POLICIES);

  return (
    <Page intro="Every home states which of the three policies applies before you pay.">
      <h1 className="font-heading text-3xl font-semibold text-ink">Cancellation policies</h1>
      <p>
        Refunds are calculated from the check-in time shown on the listing, in the listing's own time zone. The
        amount you would get back for a specific booking is always calculated on your trip page.
      </p>

      <h2>Flexible</h2>
      <ul>
        <li>Full refund up to 24 hours before check-in.</li>
        <li>No refund once you are inside that 24-hour window.</li>
      </ul>

      <h2>Moderate</h2>
      <ul>
        <li>Full refund up to 120 hours (5 days) before check-in.</li>
        <li>50% refund up to 24 hours before check-in.</li>
        <li>No refund inside 24 hours.</li>
      </ul>

      <h2>Strict</h2>
      <ul>
        <li>50% refund up to 168 hours (7 days) before check-in.</li>
        <li>No refund inside that window.</li>
      </ul>

      <h2>The service fee</h2>
      <p>
        The service fee is only refundable when the whole booking is refunded. On a 50% refund, the service fee is
        not refunded at all.
      </p>

      <h2>If a host cancels or declines</h2>
      <p>
        You are refunded in full, including the service fee, whatever the policy says. Payouts to the host are
        released {BRAND.payoutDelayHours} hours after check-in, so a host who cancels at the last minute is not paid
        for the cancelled nights.
      </p>

      <h2>Disputes</h2>
      <p>
        If a cancellation was wrong, or a stay did not match the listing, open a dispute from your trip within{' '}
        {BRAND.disputeWindowDays} days of check-out and a support agent will review it.
      </p>
      <p className="text-xs text-muted">{UPDATED}</p>
    </Page>
  );
};

export const HelpPage: React.FC = () => {
  useDocumentTitle('Help', 'Answers about searching, booking, payments, cancellations and hosting.');
  setCanonical(ROUTES.HELP);

  return (
    <Page intro="The short answers to the questions we are asked most often.">
      <h1 className="font-heading text-3xl font-semibold text-ink">Help</h1>

      <h2>How do I search?</h2>
      <p>
        Type at least two letters of a city to see suggestions, then choose dates and guests if you have fixed plans.
        Dates are optional. Everything you choose is stored in the page address, so you can bookmark or share a
        search.
      </p>

      <h2>Why is my total higher than the nightly rate?</h2>
      <p>
        The nightly rate is only part of the price. The cleaning fee, the service fee and taxes are added, and a
        length-of-stay discount is applied where the host has set one. The full breakdown is shown before you pay.
      </p>

      <h2>Instant booking or request?</h2>
      <p>
        Instant-book homes confirm immediately. Request homes ask the host first: you are charged now and have{' '}
        {BRAND.hostResponseHours} hours before the request expires, and a decline is refunded in full.
      </p>

      <h2>Can I cancel?</h2>
      <p>
        Yes, according to the policy on the listing. See{' '}
        <Link className="text-primary underline underline-offset-4" to={ROUTES.CANCELLATION_POLICIES}>
          cancellation policies
        </Link>{' '}
        for the exact thresholds.
      </p>

      <h2>Something is wrong with my booking</h2>
      <p>
        Open the trip and use "Open a dispute". A support agent reviews the booking, the payment and the message
        thread. Keep everything inside {BRAND.name}: we cannot act on evidence held elsewhere.
      </p>

      <h2>How do I host?</h2>
      <p>
        Create a host profile, accept the{' '}
        <Link className="text-primary underline underline-offset-4" to={ROUTES.TERMS}>
          terms
        </Link>
        , and submit a listing with at least {BRAND.minPhotosToSubmit} photos. An administrator reviews each
        listing before it goes live.
      </p>

      <h2>Still stuck?</h2>
      <p>Write to {ENV.SUPPORT_EMAIL} and include the reference shown on your trip.</p>
    </Page>
  );
};

export const TermsPage: React.FC = () => {
  useDocumentTitle('Terms of use', 'The terms that apply to bookings, hosting and use of this site.');
  setCanonical(ROUTES.TERMS);

  return (
    <Page intro="These terms apply to guests, hosts and staff using this site.">
      <h1 className="font-heading text-3xl font-semibold text-ink">Terms of use</h1>

      <h2>1. Accounts</h2>
      <p>
        You must be old enough to enter a contract where you live. Keep your password to yourself, and tell us
        promptly if you think someone else has used your account. One person, one account.
      </p>

      <h2>2. Booking a stay</h2>
      <p>
        A request becomes a confirmed booking when the host accepts and your payment succeeds. An instant-book
        booking is confirmed as soon as payment succeeds. Prices, availability and stay rules are decided by our
        servers; the totals you see at checkout are the amounts charged.
      </p>

      <h2>3. Payments</h2>
      <p>
        Payment is taken with a tokenised payment method. Card details are never stored here. An unpaid booking is
        released after {BRAND.paymentHoldMinutes} minutes. Our commission is {BRAND.commissionPercent}% of the
        accommodation price; the rest of the fees are shown line by line before you pay.
      </p>

      <h2>4. Cancellation</h2>
      <p>
        Each listing states one of three policies, with the refund thresholds set out on the{' '}
        <Link className="text-primary underline underline-offset-4" to={ROUTES.CANCELLATION_POLICIES}>
          cancellation policies page
        </Link>
        . A host cancellation always refunds the guest in full.
      </p>

      <h2>5. Hosting</h2>
      <p>
        Hosts must own or control the property, keep the listing and calendar accurate, honour confirmed bookings,
        and follow the house rules they publish. A host who cancels a confirmed booking repeatedly may lose hosting
        privileges. Payouts are released {BRAND.payoutDelayHours} hours after check-in unless a dispute is open.
      </p>

      <h2>6. Reviews</h2>
      <p>
        Reviews must describe a real stay. Reviews that include personal data, abuse or content unrelated to the
        stay may be removed by an administrator, with the reason recorded. Both sides of a stay are revealed at the
        same time, {BRAND.reviewWindowDays} days after check-out.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Do not attempt to book your own listing, scrape the site, automate messages, or use the site for anything
        unlawful. We may suspend accounts that do.
      </p>

      <h2>8. Liability</h2>
      <p>
        We provide the site as-is. Our liability for any booking is limited to the total you paid for that booking.
        Nothing here limits rights you have under consumer law that cannot be limited by law.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these terms. The version in force when you book is the version that applies to that booking.
        Hosts must accept the terms again if they change materially before they list a new property.
      </p>

      <h2>10. Contact</h2>
      <p>Questions about these terms go to {ENV.SUPPORT_EMAIL}.</p>
      <p className="text-xs text-muted">{UPDATED}</p>
    </Page>
  );
};

export const PrivacyPage: React.FC = () => {
  useDocumentTitle('Privacy', 'What we store, why we store it and how long we keep it.');
  setCanonical(ROUTES.PRIVACY);

  return (
    <Page intro="The short version: we store what a booking needs, we do not sell it, and we delete it when it is no longer needed.">
      <h1 className="font-heading text-3xl font-semibold text-ink">Privacy</h1>

      <h2>What we store</h2>
      <ul>
        <li>Your email address, name and optional phone number.</li>
        <li>Your bookings, messages, reviews and disputes.</li>
        <li>A host profile with a display name and a short biography.</li>
        <li>Technical records needed for security and rate limiting.</li>
      </ul>

      <h2>What we never show publicly</h2>
      <p>
        A guest's email address, phone number and exact address are never shown on a public page. A host's contact
        details are never shown either: guests are put in touch through the inbox. Listing addresses are shown as
        an approximate area until a booking is confirmed.
      </p>

      <h2>Payments</h2>
      <p>
        Payments are taken with a tokenised payment method. We receive a token and the last four digits at most; no
        card number is stored here.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        The site stores your session so you stay signed in, and remembers your last search so the search bar is
        pre-filled next time. The last search is not personal data.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Booking and payment records are kept for as long as the law requires. Messages are kept while the booking
        exists. You can close your account at any time; bookings that already happened are kept for the same
        period as the financial record.
      </p>

      <h2>Your choices</h2>
      <p>
        You can correct your profile, download your booking history, or ask us to delete an account by writing to{' '}
        {ENV.SUPPORT_EMAIL}.
      </p>
      <p className="text-xs text-muted">{UPDATED}</p>
    </Page>
  );
};