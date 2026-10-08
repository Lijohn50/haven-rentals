import { z } from 'zod';

/** Client schemas mirror the backend rules; the server stays authoritative
 * (architecture 4.7). BCrypt counts BYTES, not characters. */
export const byteLength = (value: string): number => new TextEncoder().encode(value).length;

export const passwordSchema = z
  .string()
  .refine((value) => byteLength(value) >= 8, 'Use at least 8 characters')
  .refine((value) => byteLength(value) <= 72, 'Use at most 72 characters')
  .refine((value) => /[A-Za-z]/.test(value), 'Include a letter')
  .refine((value) => /\d/.test(value), 'Include a digit')
  .refine((value) => value === value.trim(), 'No leading or trailing spaces');

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Enter your email')
  .max(254, 'Email is too long')
  .email('Enter a valid email address');

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(60, 'Use at most 60 characters')
  .regex(/^[\p{L}][\p{L} '-]*$/u, 'Letters, spaces, hyphens and apostrophes only');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +14155550123');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    phone: phoneSchema.optional().or(z.literal('')),
  })
  .superRefine((values, ctx) => {
    const localPart = values.email.split('@')[0];
    if (localPart && values.password.toLowerCase().includes(localPart.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'Password must not contain your email name',
      });
    }
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;

/** Live checklist for the register form. */
export function passwordChecks(password: string, email: string): { label: string; ok: boolean }[] {
  const localPart = email.split('@')[0] ?? '';
  return [
    { label: 'At least 8 characters', ok: byteLength(password) >= 8 },
    { label: 'A letter and a digit', ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: 'No spaces at the ends', ok: password.length > 0 && password === password.trim() },
    {
      label: 'Does not contain your email name',
      ok: !localPart || !password.toLowerCase().includes(localPart.toLowerCase()),
    },
  ];
}