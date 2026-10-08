import type { Ref } from 'react';

/**
 * Combines several refs onto one element.
 *
 * Needed whenever a form field needs both react-hook-form's registration ref and a local
 * ref (for focus management). Spreading `{...form.register('email')}` and then writing
 * `ref={emailRef}` silently replaces the registration ref, so react-hook-form never sees
 * the input, never captures a value, and zod reports "required" for fields the user filled in.
 */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined | null>): (value: T | null) => void {
  return (value: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref) (ref as { current: T | null }).current = value;
    }
  };
}