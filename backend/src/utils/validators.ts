import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const transferSchema = z.object({
  // Recipient identified by email for a human-friendly UX (no need to know
  // wallet/user IDs). Resolved to an internal ObjectId in the service layer.
  recipientEmail: z.string().trim().toLowerCase().email('Please provide a valid recipient email'),
  // Amount is accepted from the client in the MAJOR unit (e.g. dollars, "25.50")
  // as a string to avoid client-side float issues, then converted to integer
  // minor units server-side before touching any business logic.
  amount: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(
      z
        .number()
        .positive('Amount must be greater than zero')
        .max(1_000_000, 'Amount exceeds maximum allowed transfer limit')
    ),
  note: z.string().trim().max(280).optional(),
});

export const depositSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((val) => Number(val))
    .pipe(z.number().positive('Amount must be greater than zero').max(1_000_000)),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type DepositInput = z.infer<typeof depositSchema>;
