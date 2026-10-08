import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '@/api/errors';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { Breadcrumbs } from '@/components/layout/MobileTabBar';
import { PhotoThumb } from '@/components/patterns/PhotoGallery';
import {
  messagingApi,
  useConversation,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/features/messaging/api';
import {
  Avatar,
  Banner,
  Button,
  EmptyState,
  ErrorState,
  InlineAlert,
  Skeleton,
  Textarea,
} from '@/components/ui';
import { usePageVisible } from '@/hooks/useUtilities';
import { useDocumentTitle } from '@/hooks/useSeo';
import { cn } from '@/lib/cn';
import { formatAbsolute, formatRelative } from '@/lib/format';
import { newMessageIdempotencyKey, readDraft, writeDraft } from '@/lib/idempotency';
import type { ConversationResponse, MessageResponse } from '@/types/api';

const MIN_LENGTH = 1;
const MAX_LENGTH = 2000;
const COUNTER_FROM = 1800;

interface PendingMessage {
  localId: string;
  body: string;
  idempotencyKey: string;
  sentAt: string;
  state: 'sending' | 'failed';
  error: string | null;
}

function isUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'SERVICE_UNAVAILABLE';
}

function counterpartName(conversation: ConversationResponse | undefined): string {
  return conversation?.counterpartDisplayName?.trim() || 'Deleted User';
}

function failureText(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'RATE_LIMITED': {
        const minutes = Math.max(1, Math.round(error.retryAfter / 60));
        return `You've sent that several times. Try again in ${minutes} minute${
          minutes === 1 ? '' : 's'
        }.`;
      }
      case 'SERVICE_UNAVAILABLE':
        return 'Messages are temporarily unavailable. Your draft is kept.';
      case 'EMAIL_NOT_VERIFIED':
        return 'Confirm your email address before sending messages.';
      case 'ACCOUNT_SUSPENDED':
        return 'Your account cannot send messages right now.';
      case 'UNAUTHENTICATED':
        return 'Your session expired. Sign in again to send this message.';
      case 'IDEMPOTENCY_KEY_REUSED':
        return 'That message was already sent. Refresh the thread to see it.';
      default:
        return 'We could not send that message.';
    }
  }
  return 'We could not send that message. Try again.';
}

const ConversationRow: React.FC<{
  conversation: ConversationResponse;
  active: boolean;
}> = ({ conversation, active }) => (
  <li>
    <Link
      to={ROUTES.CONVERSATION(conversation.id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-start gap-3 rounded-control border p-2.5 transition-colors',
        active ? 'border-primary bg-primary-soft/50' : 'border-transparent hover:bg-surface'
      )}
    >
      <PhotoThumb
        src={null}
        alt={conversation.listingTitle}
        className="h-12 w-16 shrink-0"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            {counterpartName(conversation)}
          </span>
          <span className="tabular shrink-0 text-xs text-muted">
            {formatRelative(conversation.lastMessageAt)}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">
          {conversation.listingTitle}
        </span>
        <span className="mt-0.5 block truncate text-sm text-ink">
          {conversation.lastMessagePreview || 'No messages yet'}
        </span>
        {conversation.unreadCount > 0 && (
          <span className="tabular mt-1.5 inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs text-white">
            {conversation.unreadCount}
            <span className="sr-only"> unread messages</span>
          </span>
        )}
      </span>
    </Link>
  </li>
);

const MessageBubble: React.FC<{
  message: MessageResponse;
  mine: boolean;
  senderName: string;
  isLast: boolean;
  pendingState?: 'sending' | 'failed';
  error?: string | null;
  onRetry?: () => void;
}> = ({ message, mine, senderName, isLast, pendingState, error, onRetry }) => (
  <li className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
    <span className="text-xs font-medium text-muted">{senderName}</span>
    <div
      className={cn(
        'max-w-[85%] whitespace-pre-wrap break-words rounded-card px-3 py-2 text-sm',
        mine ? 'bg-primary text-white' : 'border border-line bg-surface text-ink'
      )}
    >
      {message.body}
    </div>
    <span className="flex items-center gap-1.5 text-xs text-muted" title={formatAbsolute(message.sentAt)}>
      <time dateTime={message.sentAt}>{formatRelative(message.sentAt)}</time>
      {isLast && mine && message.readAt ? <span>Read</span> : null}
    </span>
    {pendingState === 'sending' && <span className="text-xs text-muted">Sending…</span>}
    {pendingState === 'failed' && (
      <span className="flex flex-wrap items-center gap-2 text-xs text-danger-text">
        {error}
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </span>
    )}
  </li>
);

const Thread: React.FC<{
  conversationId: number;
  conversation: ConversationResponse | undefined;
  name: string;
  unreadCount: number;
  pageVisible: boolean;
}> = ({ conversationId, conversation, name, unreadCount, pageVisible }) => {
  const { user } = useAuth();
  const messages = useMessages(conversationId, pageVisible);
  const sendMessage = useSendMessage(conversationId);
  const markRead = useMarkConversationRead();

  const [older, setOlder] = useState<MessageResponse[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [body, setBody] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<number | null>(null);
  const atBottomRef = useRef(true);
  // The mutation result is a fresh object each render; only `mutate` may be depended on.
  const markReadRef = useRef(markRead.mutate);
  markReadRef.current = markRead.mutate;

  useEffect(() => {
    setOlder([]);
    setCursor(null);
    setHasEarlier(false);
    setEarlierError(null);
    setPending([]);
    setComposerError(null);
    setBody(readDraft(conversationId));
    atBottomRef.current = true;
  }, [conversationId]);

  // Read state is driven by the list badge, so this only fires while the badge is lit.
  useEffect(() => {
    if (unreadCount <= 0) return;
    markReadRef.current(conversationId);
  }, [conversationId, unreadCount]);

  const ordered = useMemo(() => {
    const latest = [...(messages.data?.content ?? [])].reverse();
    return [...older, ...latest];
  }, [older, messages.data?.content]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    if (restoreRef.current !== null) {
      node.scrollTop = node.scrollHeight - restoreRef.current;
      restoreRef.current = null;
      return;
    }
    if (atBottomRef.current) node.scrollTop = node.scrollHeight;
  }, [conversationId, ordered.length, pending.length]);

  const nextCursor = cursor ?? messages.data?.nextCursor ?? null;
  const canLoadEarlier = cursor === null ? messages.data?.hasMore ?? false : hasEarlier;

  const loadEarlier = async () => {
    if (nextCursor === null) return;
    const node = scrollRef.current;
    if (node) restoreRef.current = node.scrollHeight - node.scrollTop;
    setLoadingEarlier(true);
    setEarlierError(null);
    try {
      const page = await messagingApi.messages(conversationId, nextCursor);
      setOlder((previous) => [...[...page.content].reverse(), ...previous]);
      setCursor(page.nextCursor);
      setHasEarlier(page.hasMore);
    } catch (caught) {
      restoreRef.current = null;
      setEarlierError(failureText(caught));
    } finally {
      setLoadingEarlier(false);
    }
  };

  const send = async (raw: string, reuse?: PendingMessage) => {
    const text = raw.trim();
    if (text.length < MIN_LENGTH) {
      setComposerError('Write a message before sending.');
      return;
    }
    if (text.length > MAX_LENGTH) {
      setComposerError(`Messages are limited to ${MAX_LENGTH} characters.`);
      return;
    }
    setComposerError(null);

    // A retry reuses the key from the first attempt, so the server cannot store it twice.
    const entry: PendingMessage = reuse
      ? { ...reuse, body: text, state: 'sending', error: null }
      : {
          localId: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          body: text,
          idempotencyKey: newMessageIdempotencyKey(),
          sentAt: new Date().toISOString(),
          state: 'sending',
          error: null,
        };

    setPending((previous) => {
      const known = previous.some((item) => item.localId === entry.localId);
      if (!known) return [...previous, entry];
      return previous.map((item) => (item.localId === entry.localId ? entry : item));
    });

    try {
      await sendMessage.mutateAsync({
        body: text,
        idempotencyKey: entry.idempotencyKey,
      });
      setPending((previous) => previous.filter((item) => item.localId !== entry.localId));
      if (!reuse) {
        writeDraft(conversationId, '');
        setBody('');
      }
    } catch (caught) {
      const reason = failureText(caught);
      setPending((previous) =>
        previous.map((item) =>
          item.localId === entry.localId ? { ...item, state: 'failed', error: reason } : item
        )
      );
      if (isUnavailable(caught)) toast.error(reason);
    }
  };

  const updateBody = (value: string) => {
    setBody(value);
    writeDraft(conversationId, value);
    if (composerError) setComposerError(null);
  };

  const submit = () => {
    void send(body);
  };

  const lastId = ordered.length > 0 ? ordered[ordered.length - 1].id : null;
  const emptyThread = ordered.length === 0 && pending.length === 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex items-center gap-3 border-b border-line p-4">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-ink">{name}</h2>
          {conversation && (
            <Link
              to={ROUTES.LISTING(conversation.listingId)}
              className="block truncate text-xs text-muted hover:text-primary"
            >
              {conversation.listingTitle}
            </Link>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={() => {
          const node = scrollRef.current;
          if (!node) return;
          atBottomRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64;
        }}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="flex max-h-[55vh] min-h-[14rem] flex-col gap-3 overflow-y-auto bg-bg p-4"
      >
        {messages.isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="ml-auto h-14 w-2/3" />
            <Skeleton className="h-14 w-1/2" />
          </div>
        )}

        {messages.isError &&
          (isUnavailable(messages.error) ? (
            <Banner
              tone="warning"
              title="Messages are temporarily unavailable"
              action={
                <Button variant="outline" size="sm" onClick={() => void messages.refetch()}>
                  Try again
                </Button>
              }
            >
              You can still write a message below; sending resumes once the service is back.
            </Banner>
          ) : (
            <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
          ))}

        {canLoadEarlier && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" loading={loadingEarlier} onClick={() => void loadEarlier()}>
              Load earlier
            </Button>
          </div>
        )}

        {earlierError && <InlineAlert tone="danger">{earlierError}</InlineAlert>}

        {emptyThread && !messages.isLoading && !messages.isError && (
          <EmptyState
            title="No messages yet"
            description={`Say hello to ${name}. Messages are plain text, up to ${MAX_LENGTH} characters.`}
          />
        )}

        <ul className="flex flex-col gap-3">
          {ordered.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.senderId === user?.id}
              senderName={message.senderId === user?.id ? 'You' : name}
              isLast={message.id === lastId}
            />
          ))}
          {pending.map((item) => (
            <MessageBubble
              key={item.localId}
              message={{
                id: item.localId,
                conversationId,
                senderId: user?.id ?? 0,
                body: item.body,
                sentAt: item.sentAt,
                readAt: null,
              }}
              mine
              senderName="You"
              isLast={false}
              pendingState={item.state}
              error={item.error}
              onRetry={() => void send(item.body, item)}
            />
          ))}
        </ul>
      </div>

      <form
        className="flex flex-col gap-2 border-t border-line p-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor="inbox-composer" className="text-sm font-medium text-ink">
          Message {name}
        </label>
        <Textarea
          id="inbox-composer"
          rows={3}
          value={body}
          placeholder="Write a message…"
          onChange={(event) => updateBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            submit();
          }}
        />
        {composerError && <InlineAlert tone="danger">{composerError}</InlineAlert>}
        <div className="flex items-center justify-between gap-3">
          <span className="tabular text-xs text-muted">
            {body.length > COUNTER_FROM ? `${body.length}/${MAX_LENGTH}` : ''}
          </span>
          <Button type="submit" size="sm" disabled={body.trim().length < MIN_LENGTH}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
};

export const InboxPage: React.FC = () => {
  useDocumentTitle('Inbox');

  const { conversationId } = useParams();
  const parsed = conversationId === undefined ? Number.NaN : Number(conversationId);
  const activeId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  const pageVisible = usePageVisible();
  const conversations = useConversations(pageVisible);
  const detail = useConversation(activeId);

  const conversation =
    conversations.data?.find((item) => item.id === activeId) ?? detail.data;
  const name = counterpartName(conversation);

  return (
    <div className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 sm:px-6">
      <Breadcrumbs
        items={
          activeId === null
            ? [{ label: 'Inbox' }]
            : [{ label: 'Inbox', to: ROUTES.INBOX }, { label: name }]
        }
      />

      <h1 className="text-2xl font-semibold text-ink">Inbox</h1>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
        <section
          aria-label="Conversations"
          className={cn('min-w-0', activeId !== null && 'hidden lg:block')}
        >
          {conversations.isLoading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          )}

          {conversations.isError &&
            (isUnavailable(conversations.error) ? (
              <Banner
                tone="warning"
                title="Messages are temporarily unavailable"
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void conversations.refetch()}
                  >
                    Try again
                  </Button>
                }
              >
                Everything else keeps working while messaging is down.
              </Banner>
            ) : (
              <ErrorState
                error={conversations.error}
                onRetry={() => void conversations.refetch()}
              />
            ))}

          {conversations.data && conversations.data.length === 0 && (
            <EmptyState
              title="No conversations yet"
              description="Message a host from any listing and the conversation shows up here."
            />
          )}

          {conversations.data && conversations.data.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {conversations.data.map((item) => (
                <ConversationRow
                  key={item.id}
                  conversation={item}
                  active={item.id === activeId}
                />
              ))}
            </ul>
          )}
        </section>

        <section
          aria-label="Message thread"
          className={cn('min-w-0', activeId === null && 'hidden lg:block')}
        >
          {activeId === null ? (
            <EmptyState
              title="Select a conversation"
              description="Pick a conversation on the left to read it and reply."
            />
          ) : (
            <Thread
              conversationId={activeId}
              conversation={conversation}
              name={name}
              unreadCount={conversation?.unreadCount ?? 0}
              pageVisible={pageVisible}
            />
          )}
        </section>
      </div>
    </div>
  );
};
