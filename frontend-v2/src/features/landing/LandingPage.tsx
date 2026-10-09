import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bed,
  Building,
  Building2,
  Castle,
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
const SECTION_HEADING = 'font-heading text-2xl font-semibold text-ink sm:text-3xl';

const SectionHeader: React.FC<{ title: string; sub?: string; to?: string; linkLabel?: string }> = ({
  title,
  sub,
  to,
  linkLabel,
}) => (
  <div className={cn(SECTION, 'mb-4 flex flex-wrap items-end justify-between gap-3')}>
    <div>
      <h2 className={SECTION_HEADING}>{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
    {to && linkLabel && (
      <Link className="text-sm font-medium text-primary underline underline-offset-4" to={to}>
        {linkLabel}
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
    <section aria-label={label} className={SECTION}>
      <div className="relative">
        <div
          ref={scroller}
          onScroll={measure}
          className="-mx-1 flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto px-1 pb-2"
        >
          {listings.map((listing) => (
            <div
              key={listing.id}
              className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] xl:w-[calc(25%-0.75rem)]"
            >
              <ListingCard listing={listing} layout="stack" />
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="absolute -left-3 top-1/2 z-10 hidden -translate-y-1/2 bg-surface shadow-card md:inline-flex"
          onClick={() => scrollBy(-1)}
          disabled={edges.start}
          aria-label={`Previous homes in ${label}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 bg-surface shadow-card md:inline-flex"
          onClick={() => scrollBy(1)}
          disabled={edges.end}
          aria-label={`Next homes in ${label}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
};

const CardCarousel: React.FC<{
  label: string;
  title: string;
  sub?: string;
  sort: SearchSort;
  instantBook?: boolean;
  linkTo?: string;
  linkLabel?: string;
  minResults: number;
  requireReviews?: boolean;
}> = ({ label, title, sub, sort, instantBook, linkTo, linkLabel, minResults, requireReviews = false }) => {
  const query = useSearch({ sort, size: 8, page: 0, instantBook });
  const listings = useMemo(
    () => (query.data?.content ?? []).filter((listing) => !requireReviews || listing.reviewCount > 0),
    [query.data, requireReviews]
  );

  if (query.isPending) {
    return (
      <section aria-label={label} className={SECTION}>
        <SectionHeader title={title} sub={sub} to={linkTo} linkLabel={linkLabel} />
        <div className="-mx-1 flex snap-x snap-mandatory items-stretch gap-4 overflow-hidden px-1">
          {[0, 1, 2, 3].map((slot) => (
            <div
              key={slot}
              className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)] xl:w-[calc(25%-0.75rem)]"
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
    <>
      <SectionHeader title={title} sub={sub} to={linkTo} linkLabel={linkLabel} />
      <Carousel label={label} listings={listings} />
    </>
  );
};

/* ---------------------------------------------------------------------- hero */

const Hero: React.FC = () => (
  <section aria-label="Search for a home" className="relative isolate overflow-hidden bg-primary-dark">
    <img
      src="/images/hero.jpg"
      alt=""
      aria-hidden
      width={1920}
      height={1080}
      // Decorative: the hero copy sits on top of it, so an empty alt keeps it out of the
      // accessibility tree. fetchpriority lets it win the LCP race against the JS bundle.
      fetchPriority="high"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover opacity-70"
    />
    {/* The photo is dimmed in two steps on purpose. Dropping the image to 70% lets the
        `bg-primary-dark` base show through, which darkens the picture and strips out the
        high-frequency detail that competed with the headline; the scrim then sets a flat
        floor so the white h1 keeps its contrast over the brightest part of the photo. */}
    <div className="absolute inset-0 bg-ink/60" aria-hidden />
    <div className={cn(SECTION, 'relative flex min-h-[min(72vh,640px)] flex-col justify-center gap-6 py-14 sm:py-20')}>
      <div className="max-w-2xl text-white">
        <h1 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
          Find a whole home for your next trip
        </h1>
        <p className="mt-3 text-lg text-white/90">{BRAND.subcopy}</p>
      </div>
      <SearchBar variant="hero" />
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

  if (query.isPending) return <Skeleton className="h-10 w-28 shrink-0 rounded-full" />;
  if (!query.isError && (query.data?.totalElements ?? 0) === 0) return null;

  return (
    <Link
      to={`${ROUTES.SEARCH}?propertyType=${type}`}
      className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary"
    >
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      {propertyTypeLabels[type]}
    </Link>
  );
};

const PropertyTypeStripSection: React.FC = () => (
  <section aria-label="Property types" className={cn(SECTION, 'py-8')}>
    <nav className="flex gap-3 overflow-x-auto pb-1">
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
  <section aria-label="Why book with us" className="border-y border-line bg-surface">
    <ul className={cn(SECTION, 'grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4')}>
      {TRUST_ITEMS.map(({ title, body, Icon }) => (
        <li key={title} className="flex gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-dark">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-sm text-muted">{body}</p>
          </div>
        </li>
      ))}
    </ul>
  </section>
);

/* --------------------------------------------------------- popular destinations */

const DestinationProbe: React.FC<{
  destination: CuratedDestination;
  onResolved: (city: string, count: number) => void;
}> = ({ destination, onResolved }) => {
  const query = useSearch({ city: destination.city, size: 1, page: 0 });
  useEffect(() => {
    // A failed probe has to settle as zero. Without this branch `allResolved` stayed false
    // and the section kept pulsing its skeleton for the life of the page.
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
          <Skeleton className="h-8 w-64" />
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map((slot) => (
              <Skeleton key={slot} className="h-20 w-full rounded-card" />
            ))}
          </div>
        </section>
      )}

      {survivors.length >= MIN_DESTINATIONS_SHOWN && (
        <section aria-label="Popular destinations" className="py-10">
          <div className={SECTION}>
            <SectionHeader
              title="Popular destinations"
              sub="Places with whole homes already listed"
              to={ROUTES.SEARCH}
              linkLabel="See all homes"
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {survivors.map((entry) => (
                <DestinationTile
                  key={`${entry.city}-${entry.country}`}
                  city={entry.city}
                  country={entry.country}
                  homes={counts[entry.city]}
                />
              ))}
            </div>
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
  <section aria-label="How it works" className="border-y border-line bg-surface py-10">
    <div className={SECTION}>
      <SectionHeader title="How it works" to={ROUTES.HOW_IT_WORKS} linkLabel="More detail" />
      <ol className="grid gap-6 md:grid-cols-3">
        {STEPS.map(({ title, body, Icon }, index) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                {index + 1}. {title}
              </h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
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
    <section aria-label="Hosting" className="bg-primary py-12 text-white">
      <div className={cn(SECTION, 'flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">{BRAND.hostBand}</h2>
          <ul className="mt-3 space-y-1 text-sm text-white/90">
            <li>You set the nightly price and block the dates you need.</li>
            <li>You approve each request, or turn on instant booking.</li>
            <li>Payouts are released 24 hours after check-in.</li>
          </ul>
        </div>
        <Button asChild variant="primary" size="lg" className="bg-surface text-primary-dark hover:bg-primary-soft">
          <Link to={to}>{label}</Link>
        </Button>
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
        <Link className="text-primary underline underline-offset-4" to={ROUTES.CANCELLATION_POLICIES}>
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
  <section aria-label="Frequently asked questions" className={cn(SECTION, 'py-10')}>
    <h2 className={SECTION_HEADING}>Questions people ask</h2>
    <Accordion type="single" collapsible className="mt-4">
      {FAQS.map((item) => (
        <AccordionItem key={item.question} value={item.question}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
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
    <>
      <Hero />
      <PropertyTypeStripSection />
      <TrustBar />

      <div className="space-y-12 py-12">
        <CardCarousel
          label="Top rated homes"
          title="Top-rated homes"
          sub="Highest rated stays with published reviews"
          sort="RATING_DESC"
          requireReviews
          linkTo={`${ROUTES.SEARCH}?sort=RATING_DESC`}
          linkLabel="See all"
          minResults={3}
        />
        <PopularDestinations />
        <CardCarousel
          label="Book instantly"
          title="Book instantly"
          sub="Confirmed the moment you pay"
          sort="RATING_DESC"
          instantBook
          linkTo={`${ROUTES.SEARCH}?instantBook=true`}
          linkLabel="See all"
          minResults={1}
        />
      </div>

      <HowItWorks />

      <div className="space-y-12 py-12">
        <CardCarousel
          label="New on the site"
          title="New on the site"
          sub="Recently listed homes"
          sort="NEWEST"
          linkTo={`${ROUTES.SEARCH}?sort=NEWEST`}
          linkLabel="See all"
          minResults={1}
        />
      </div>

      <HostBand />
      <Faq />
    </>
  );
};