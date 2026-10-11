import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bed,
  Building,
  Building2,
  Castle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Home,
  KeyRound,
  LayoutGrid,
  Lock,
  MessageSquare,
  Receipt,
  Search as SearchIcon,
  Star,
  Tent,
  Warehouse,
  ArrowRight,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { useDocumentTitle, setCanonical } from '@/hooks/useSeo';
import { useAuth } from '@/providers/AuthProvider';
import { useSearch } from '@/features/search/api';
import { CURATED_DESTINATIONS, MIN_DESTINATIONS_SHOWN, type CuratedDestination } from '@/features/search/destinations';
import { SearchBar } from '@/components/patterns/SearchBar';
import { DestinationTile, ListingCard, ListingCardSkeleton } from '@/components/patterns/ListingCard';
import { propertyTypeLabels } from '@/lib/status';
import { cn } from '@/lib/cn';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Skeleton,
} from '@/components/ui';
import type { PropertyType, SearchResultResponse, SearchSort } from '@/types/api';

/* -------------------------------------------------------------------- chrome */

const SECTION = 'mx-auto w-full max-w-content px-4 sm:px-6';

const SectionHeader: React.FC<{
  eyebrow?: string;
  title: string;
  sub?: string;
  to?: string;
  linkLabel?: string;
  className?: string;
}> = ({ eyebrow, title, sub, to, linkLabel, className }) => (
  <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
    <div>
      {eyebrow && (
        <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
        {title}
      </h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
    {to && linkLabel && (
      <Link
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2 hover:text-primary-dark"
        to={to}
      >
        <span>{linkLabel}</span>
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    )}
  </div>
);

const Carousel: React.FC<{ label: string; listings: SearchResultResponse[] }> = ({ label, listings }) => {
  const scroller = React.useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });

  /** Carousel tiles are ~260-345px wide, so they must stack: a row card cannot fit. */
  const measure = React.useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const maxScroll = element.scrollWidth - element.clientWidth;
    setEdges({ start: element.scrollLeft <= 1, end: element.scrollLeft >= maxScroll - 1 });
  }, []);

  React.useEffect(() => {
    measure();
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measure, listings.length]);

  const scrollBy = (direction: 1 | -1) => {
    const element = scroller.current;
    if (!element) return;
    const card = element.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 16 : Math.max(240, element.clientWidth * 0.8);
    element.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={scroller}
        onScroll={measure}
        className="-mx-1 flex snap-x snap-mandatory items-stretch gap-5 overflow-x-auto px-1 pb-3 scrollbar-none"
      >
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="flex w-[85%] shrink-0 snap-start flex-col sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.833rem)] xl:w-[calc(25%-0.938rem)]"
          >
            <ListingCard listing={listing} layout="stack" />
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'absolute -left-4 top-[110px] z-10 hidden -translate-y-1/2 rounded-full bg-surface shadow-pop ring-1 ring-line transition-opacity duration-150 md:inline-flex',
          edges.start ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
        onClick={() => scrollBy(-1)}
        disabled={edges.start}
        aria-label={`Previous homes in ${label}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className={cn(
          'absolute -right-4 top-[110px] z-10 hidden -translate-y-1/2 rounded-full bg-surface shadow-pop ring-1 ring-line transition-opacity duration-150 md:inline-flex',
          edges.end ? 'pointer-events-none opacity-0' : 'opacity-100'
        )}
        onClick={() => scrollBy(1)}
        disabled={edges.end}
        aria-label={`Next homes in ${label}`}
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
};

const CardCarousel: React.FC<{
  label: string;
  eyebrow?: string;
  title: string;
  sub?: string;
  sort: SearchSort;
  instantBook?: boolean;
  linkTo?: string;
  linkLabel?: string;
  minResults: number;
  requireReviews?: boolean;
}> = ({ label, eyebrow, title, sub, sort, instantBook, linkTo, linkLabel, minResults, requireReviews = false }) => {
  const query = useSearch({ sort, size: 8, page: 0, instantBook });
  const listings = useMemo(
    () => (query.data?.content ?? []).filter((listing) => !requireReviews || listing.reviewCount > 0),
    [query.data, requireReviews]
  );

  if (query.isPending) {
    return (
      <section aria-label={label} className={SECTION}>
        <SectionHeader eyebrow={eyebrow} title={title} sub={sub} to={linkTo} linkLabel={linkLabel} />
        <div className="-mx-1 flex snap-x snap-mandatory items-stretch gap-5 overflow-hidden px-1">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="flex w-[85%] shrink-0 snap-start flex-col sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.833rem)] xl:w-[calc(25%-0.938rem)]"
            >
              <ListingCardSkeleton layout="stack" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (query.isError || listings.length < minResults) return null;

  return (
    <section aria-label={label} className={SECTION}>
      <SectionHeader eyebrow={eyebrow} title={title} sub={sub} to={linkTo} linkLabel={linkLabel} />
      <Carousel label={label} listings={listings} />
    </section>
  );
};

/* ---------------------------------------------------------------------- hero */

const Hero: React.FC = () => (
  <section aria-label="Search for a home" className="relative isolate overflow-hidden rounded-b-hero sm:rounded-b-[32px] bg-ink">
    <img
      src="/images/hero.jpg"
      alt=""
      aria-hidden
      width={1920}
      height={1080}
      fetchPriority="high"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover animate-fade-in"
    />
    <div className="absolute inset-0 bg-hero-scrim" aria-hidden />
    <div className={cn(SECTION, 'relative flex min-h-[520px] lg:min-h-[600px] flex-col justify-center gap-6 py-16 sm:py-20')}>
      <div className="max-w-3xl text-white">
        <h1 className="font-heading text-4xl font-semibold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-5xl lg:text-6xl">
          Find a whole home for your next trip
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3.5 py-1 text-sm font-medium text-white backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden />
            Private homes
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3.5 py-1 text-sm font-medium text-white backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden />
            Clear total prices
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3.5 py-1 text-sm font-medium text-white backdrop-blur">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" aria-hidden />
            Secure payment
          </span>
        </div>
      </div>
      <div className="mt-2">
        <SearchBar variant="hero" />
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------- property type strip */

const PROPERTY_TYPE_ICONS: Record<PropertyType, LucideIcon> = {
  HOUSE: Home,
  VILLA: Castle,
  CABIN: Tent,
  CONDO: Building2,
  APARTMENT: Building,
  STUDIO: KeyRound,
  OTHER: Warehouse,
};

const PROPERTY_TYPE_ORDER: PropertyType[] = [
  'HOUSE',
  'VILLA',
  'CABIN',
  'CONDO',
  'APARTMENT',
  'STUDIO',
  'OTHER',
];

const PropertyTypeChip: React.FC<{ type: PropertyType }> = ({ type }) => {
  const query = useSearch({ propertyType: type, size: 1, page: 0 });
  const Icon = PROPERTY_TYPE_ICONS[type];

  if (query.isPending) return <Skeleton className="h-10 w-28 shrink-0 rounded-pill" />;
  if (!query.isError && (query.data?.totalElements ?? 0) === 0) return null;

  return (
    <Link
      to={`${ROUTES.SEARCH}?propertyType=${type}`}
      className="inline-flex shrink-0 items-center gap-2 rounded-pill bg-surface px-4 py-2 text-sm font-medium text-text shadow-card ring-1 ring-line/70 transition-all hover:-translate-y-0.5 hover:ring-primary/40"
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {propertyTypeLabels[type]}
    </Link>
  );
};

const PropertyTypeStripSection: React.FC = () => (
  <section aria-label="Property types" className={SECTION}>
    <nav className="flex gap-2.5 overflow-x-auto py-2 scrollbar-none [mask-image:linear-gradient(90deg,#000_90%,transparent)] sm:[mask-image:none]">
      {PROPERTY_TYPE_ORDER.map((type) => (
        <PropertyTypeChip key={type} type={type} />
      ))}
    </nav>
  </section>
);

/* ------------------------------------------------------------------ trust bar */

const TRUST_ITEMS: { title: string; body: string; Icon: LucideIcon }[] = [
  {
    title: 'Clear total prices',
    body: 'See the nightly rate, cleaning fee, service fee and tax before you book.',
    Icon: Receipt,
  },
  {
    title: 'Secure payment',
    body: 'Pay with a protected payment token. We never see your card number.',
    Icon: Lock,
  },
  {
    title: 'Honest reviews',
    body: 'Guests and hosts review each other, and both are revealed together.',
    Icon: Star,
  },
  {
    title: 'Talk to your host',
    body: 'Ask questions before you book and keep the thread for the whole trip.',
    Icon: MessageSquare,
  },
];

const TrustBar: React.FC = () => (
  <section aria-label="Why book with us" className={SECTION}>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {TRUST_ITEMS.map(({ title, body, Icon }) => (
        <div
          key={title}
          className="group relative overflow-hidden rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-card-hover"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-soft/50 transition-transform duration-300 group-hover:scale-110"
          />
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="font-semibold text-base text-text">{title}</h3>
          <p className="mt-1.5 text-sm text-muted leading-relaxed">{body}</p>
        </div>
      ))}
    </div>
  </section>
);

/* --------------------------------------------------------- popular destinations */

const DestinationProbe: React.FC<{
  destination: CuratedDestination;
  onResolved: (city: string, count: number) => void;
}> = ({ destination, onResolved }) => {
  const query = useSearch({ city: destination.city, size: 1, page: 0 });
  useEffect(() => {
    if (query.isError) {
      onResolved(destination.city, 0);
      return;
    }
    if (query.data) onResolved(destination.city, query.data.totalElements);
  }, [query.data, query.isError, destination.city, onResolved]);
  return null;
};

const PopularDestinations: React.FC = () => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const record = useCallback((city: string, count: number) => {
    setCounts((current) => (current[city] === count ? current : { ...current, [city]: count }));
  }, []);
  const allResolved = Object.keys(counts).length >= CURATED_DESTINATIONS.length;
  const survivors = CURATED_DESTINATIONS.filter((entry) => (counts[entry.city] ?? 0) > 0);

  return (
    <>
      {CURATED_DESTINATIONS.map((entry) => (
        <DestinationProbe key={`${entry.city}-${entry.country}`} destination={entry} onResolved={record} />
      ))}

      {survivors.length === 0 && !allResolved && (
        <section aria-label="Popular destinations" className={SECTION}>
          <div className="mb-6 flex flex-col gap-1">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((slot) => (
              <Skeleton key={slot} className="aspect-[3/4] w-full rounded-card sm:aspect-[4/5]" />
            ))}
          </div>
        </section>
      )}

      {survivors.length >= MIN_DESTINATIONS_SHOWN && (
        <section aria-label="Popular destinations" className={SECTION}>
          <SectionHeader
            eyebrow="Explore Destinations"
            title="Popular destinations"
            sub="Places with whole homes ready to reserve"
            to={ROUTES.SEARCH}
            linkLabel="See all homes"
          />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {survivors.map((entry) => (
              <DestinationTile
                key={`${entry.city}-${entry.country}`}
                city={entry.city}
                country={entry.country}
                homes={counts[entry.city]}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
};

/* --------------------------------------------------------------- how it works */

const STEPS: { title: string; body: string; Icon: LucideIcon }[] = [
  {
    title: 'Search',
    body: 'Pick a destination, your dates and how many guests are coming.',
    Icon: SearchIcon,
  },
  {
    title: 'Compare',
    body: 'Compare full prices, amenities, house rules and real reviews.',
    Icon: LayoutGrid,
  },
  {
    title: 'Book',
    body: `Book instantly, or ask the host and hear back within ${BRAND.hostResponseHours} hours.`,
    Icon: Bed,
  },
];

const HowItWorks: React.FC = () => (
  <section aria-label="How it works" className="w-full bg-surface py-16 sm:py-20">
    <div className={SECTION}>
      <SectionHeader
        eyebrow="Simple & Transparent"
        title="How it works"
        sub="From discovery to check-in in three simple steps"
        to={ROUTES.HOW_IT_WORKS}
        linkLabel="Learn more"
      />
      <ol className="relative grid gap-6 md:grid-cols-3">
        {STEPS.map(({ title, body, Icon }, index) => (
          <li
            key={title}
            className="relative rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-4xl font-bold text-primary/20">
                0{index + 1}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <h3 className="mb-1.5 font-heading text-lg font-semibold text-text">
              {title}
            </h3>
            <p className="text-sm leading-relaxed text-muted">{body}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

/* ----------------------------------------------------------------- host band */

const HostBand: React.FC = () => {
  const { isAuthenticated, isHost } = useAuth();
  const to = isAuthenticated
    ? isHost
      ? ROUTES.HOST_DASHBOARD
      : ROUTES.BECOME_HOST
    : `${ROUTES.REGISTER}?next=${encodeURIComponent(ROUTES.BECOME_HOST)}`;
  const label = isHost ? 'Go to host dashboard' : 'List your property';

  return (
    <section aria-label="Hosting" className={SECTION}>
      <div className="relative overflow-hidden rounded-hero bg-ink text-white shadow-pop">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgb(13_115_107/0.45),transparent_60%)]" />
        <div className="relative grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary-soft">
              Earn from your home
            </p>
            <h2 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {BRAND.hostBand}
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-white/90">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-soft" aria-hidden />
                <span>You set the nightly price and block the dates you need.</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-soft" aria-hidden />
                <span>You approve each request, or turn on instant booking.</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-soft" aria-hidden />
                <span>Payouts are released 24 hours after guest check-in.</span>
              </li>
            </ul>
            <div className="mt-8">
              <Link
                to={to}
                className="inline-flex h-12 items-center justify-center rounded-pill bg-accent px-6 font-semibold text-white shadow-[0_8px_20px_-6px_rgb(217_92_46/0.6)] transition-all hover:bg-accent-dark active:scale-[0.98]"
              >
                {label}
              </Link>
            </div>
          </div>
          <div className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl lg:block">
            <img
              src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
              alt="Cozy modern interior"
              loading="lazy"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-5 rounded-2xl bg-white/95 p-4 text-ink shadow-pop backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">Host Earnings</div>
              <div className="mt-0.5 font-heading text-xl font-semibold text-ink">
                Keep <span className="font-bold text-primary">97%</span> of every booking
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------- the FAQ */

const FAQS: { question: string; answer: React.ReactNode }[] = [
  {
    question: 'What is the difference between instant booking and a request?',
    answer:
      'With instant booking the stay is confirmed the moment you pay. With a request the host has 24 hours to accept or decline before you pay.',
  },
  {
    question: 'When am I charged?',
    answer: (
      <>
        At payment, for both instant bookings and requests. If a host declines a request, or does not answer
        within 24 hours, the charge is reversed in full.
      </>
    ),
  },
  {
    question: 'What are the cancellation policies?',
    answer: (
      <>
        Flexible is a full refund up to 24 hours before check-in. Moderate is a full refund up to 120 hours and a
        50% refund up to 24 hours. Strict is a 50% refund up to 168 hours before check-in.{' '}
        <Link className="text-primary underline underline-offset-4 hover:text-primary-dark" to={ROUTES.CANCELLATION_POLICIES}>
          Read the full policy
        </Link>
        .
      </>
    ),
  },
  {
    question: 'How do reviews work?',
    answer: `Guests and hosts each write a review after a stay, and the two are revealed together once both are in. You have ${BRAND.reviewWindowDays} days after check-out to write yours.`,
  },
  {
    question: 'Is my payment information safe?',
    answer:
      'Payment is taken with a tokenised payment method. Card numbers are never sent to or stored by this site.',
  },
];

const Faq: React.FC = () => (
  <section aria-label="Frequently asked questions" className="w-full bg-surface py-16 sm:py-20">
    <div className={SECTION}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[.14em] text-primary">
            Got Questions?
          </p>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Frequently asked questions
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Everything you need to know about booking, cancellation policies, and payment security.
          </p>
        </div>
        <Accordion type="single" collapsible className="space-y-3">
          {FAQS.map((item) => (
            <AccordionItem
              key={item.question}
              value={item.question}
              className="rounded-2xl bg-surface px-5 shadow-sm ring-1 ring-line/70 transition-all data-[state=open]:shadow-card data-[state=open]:ring-primary/40"
            >
              <AccordionTrigger className="py-4 text-left font-medium text-text hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-muted">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------------- the page */

export const LandingPage: React.FC = () => {
  useDocumentTitle(
    'Vacation rental homes',
    'Find a whole home for your next trip. Clear total prices, secure payment, verified reviews and a host you can message.'
  );
  setCanonical(ROUTES.HOME);

  return (
    <div className="flex flex-col">
      <Hero />

      <div className="flex w-full flex-col gap-10 bg-bg pb-16 pt-8 sm:pb-20">
        <PropertyTypeStripSection />
        <TrustBar />

        <CardCarousel
          label="Top rated homes"
          eyebrow="Featured Stays"
          title="Top-rated homes"
          sub="Highest rated stays with published reviews"
          sort="RATING_DESC"
          requireReviews
          linkTo={`${ROUTES.SEARCH}?sort=RATING_DESC`}
          linkLabel="See all"
          minResults={3}
        />
      </div>

      <div className="w-full bg-surface py-16 sm:py-20">
        <PopularDestinations />
      </div>

      <div className="w-full bg-sand py-16 sm:py-20">
        <CardCarousel
          label="Book instantly"
          eyebrow="⚡ Instant Confirmation"
          title="Book instantly"
          sub="Confirmed the moment you pay — no host waiting"
          sort="RATING_DESC"
          instantBook
          linkTo={`${ROUTES.SEARCH}?instantBook=true`}
          linkLabel="See all"
          minResults={1}
        />
      </div>

      <HowItWorks />

      <div className="w-full bg-sand py-16 sm:py-20">
        <CardCarousel
          label="New on the site"
          eyebrow="Just Added"
          title="New on the site"
          sub="Recently listed homes ready for their first guests"
          sort="NEWEST"
          linkTo={`${ROUTES.SEARCH}?sort=NEWEST`}
          linkLabel="See all"
          minResults={1}
        />
      </div>

      <div className="py-12 sm:py-16">
        <HostBand />
      </div>

      <Faq />
    </div>
  );
};