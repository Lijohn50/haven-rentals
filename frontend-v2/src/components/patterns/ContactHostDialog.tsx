import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/providers/AuthProvider';
import { useStartConversation } from '@/features/messaging/api';
import { ApiError } from '@/api/errors';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Field, InlineAlert, Textarea } from '@/components/ui';

const MIN = 1;
const MAX = 2000;

export const ContactHostDialog: React.FC<{
  listingId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ listingId, open, onOpenChange }) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const start = useStartConversation();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const trimmed = message.trim();
  const next = `/listings/${listingId}`;

  const send = async () => {
    setError(null);
    if (trimmed.length < MIN) {
      setError('Write a message before sending.');
      return;
    }
    try {
      const conversation = await start.mutateAsync({ listingId, message: trimmed });
      setMessage('');
      onOpenChange(false);
      navigate(ROUTES.CONVERSATION(conversation.id));
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.code === 'EMAIL_NOT_VERIFIED') {
          setError('Confirm your email address before messaging a host.');
          return;
        }
        if (caught.code === 'BUSINESS_RULE_VIOLATION') {
          setError(caught.detail);
          return;
        }
        if (caught.code === 'UNAUTHENTICATED') {
          navigate(`${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`);
          return;
        }
        setError(caught.detail);
        return;
      }
      setError('We could not start that conversation. Try again in a moment.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Message the host</DialogTitle>
        <DialogDescription>
          Ask anything before you book. The host can reply from their inbox.
        </DialogDescription>

        {!isAuthenticated ? (
          <div className="mt-4 flex flex-col gap-3">
            <InlineAlert tone="info">Sign in to send a message.</InlineAlert>
            <Button asChild>
              <Link to={`${ROUTES.LOGIN}?next=${encodeURIComponent(next)}`}>Sign in</Link>
            </Button>
          </div>
        ) : (
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            {user && !user.emailVerified && (
              <InlineAlert tone="warning">
                Your email address is not confirmed yet.{' '}
                <Link className="underline underline-offset-4" to={ROUTES.VERIFY_EMAIL}>
                  Confirm it
                </Link>{' '}
                to message a host.
              </InlineAlert>
            )}

            <Field
              label="Message"
              htmlFor="contact-host-message"
              required
              error={error}
              hint={`${trimmed.length}/${MAX} characters`}
            >
              <Textarea
                id="contact-host-message"
                value={message}
                maxLength={MAX}
                rows={5}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Hi, we are two adults travelling in May. Is the home suitable for a week?"
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={start.isPending} disabled={trimmed.length < MIN}>
                <MessageSquare className="h-4 w-4" aria-hidden />
                Send message
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};