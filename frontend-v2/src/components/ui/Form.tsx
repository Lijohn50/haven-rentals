import React, { forwardRef, useId, useState } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface FieldProps {
  label?: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    {label && (
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-muted">{hint}</p>}
    {error && (
      <p role="alert" className="flex items-start gap-1.5 text-xs text-danger-text">
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
        <span>{error}</span>
      </p>
    )}
  </div>
);

const controlClasses =
  'w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-bg disabled:text-muted aria-[invalid=true]:border-danger';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError, ...props }, ref) => (
    <input ref={ref} className={cn(controlClasses, hasError && 'border-danger', className)} {...props} />
  )
);
Input.displayName = 'Input';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  hasError?: boolean;
}

/** Password field with a show/hide toggle, styled like Input. */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, hasError, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn(controlClasses, 'pr-10', hasError && 'border-danger', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-control text-muted transition-colors hover:bg-bg hover:text-ink"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(controlClasses, 'min-h-[96px] resize-y leading-relaxed', hasError && 'border-danger', className)}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

/** Native select: predictable, accessible and keyboard-first, styled to match. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(controlClasses, 'appearance-none bg-[length:16px] pr-9', hasError && 'border-danger', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
      }}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, id, ...props }, ref) => {
    const generated = useId();
    const inputId = id ?? generated;
    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-primary focus:ring-2 focus:ring-primary/30"
          {...props}
        />
        <label htmlFor={inputId} className="text-sm text-ink leading-snug cursor-pointer">
          {label}
        </label>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
}) => {
  const generated = useId();
  const switchId = id ?? generated;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={switchId} className="text-sm font-medium text-ink cursor-pointer">
          {label}
        </label>
        {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60',
          checked ? 'bg-primary' : 'bg-neutral-soft'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  );
};

export interface RadioOption {
  value: string;
  label: React.ReactNode;
  description?: string;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  className?: string;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ name, value, onChange, options, className }) => (
  <div role="radiogroup" className={cn('flex flex-col gap-2', className)}>
    {options.map((option) => (
      <label
        key={option.value}
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-control border p-3 transition-colors',
          value === option.value ? 'border-primary bg-primary-soft/40' : 'border-line hover:bg-bg'
        )}
      >
        <input
          type="radio"
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={() => onChange(option.value)}
          className="mt-0.5 h-4 w-4 text-primary focus:ring-2 focus:ring-primary/30"
        />
        <span>
          <span className="block text-sm font-medium text-ink">{option.label}</span>
          {option.description && <span className="block text-xs text-muted">{option.description}</span>}
        </span>
      </label>
    ))}
  </div>
);

export interface StepperProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
}

export const Stepper: React.FC<StepperProps> = ({ label, value, min = 1, max = 50, step = 1, onChange, suffix }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-sm text-ink">{label}</span>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
        className="h-11 w-11 rounded-control border border-line text-lg leading-none text-ink hover:bg-bg disabled:opacity-40"
      >
        −
      </button>
      <span className="tabular w-16 text-center text-sm font-semibold" aria-live="polite">
        {value}
        {suffix}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, Number((value + step).toFixed(2))))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
        className="h-11 w-11 rounded-control border border-line text-lg leading-none text-ink hover:bg-bg disabled:opacity-40"
      >
        +
      </button>
    </div>
  </div>
);