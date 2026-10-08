import React, { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Accent (`accent`) is reserved for money-moving actions only: Book now, Request to book,
 * Pay, and destructive confirmations. Navigation and generic primaries stay teal (D7).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary-dark',
        accent: 'bg-accent text-white hover:bg-accent-dark',
        secondary: 'bg-primary-soft text-primary-dark hover:bg-highlight',
        outline: 'border border-line bg-surface text-ink hover:bg-bg',
        ghost: 'text-ink hover:bg-bg',
        destructive: 'bg-danger text-white hover:bg-danger-text',
        link: 'text-primary underline underline-offset-4 hover:text-primary-dark p-0 h-auto',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'h-11 w-11',
      },
      block: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading, children, disabled, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, block }), className);
    const content = (
      <>
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {children}
      </>
    );

    if (asChild) {
      return (
        <Slot ref={ref} className={classes} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { buttonVariants };