import { z } from 'zod';
import { USER_ROLES } from '../constants.js';

export const LoginInputSchema = z.object({
  email: z.string().email('Valid government or official email required'),
  apiKey: z.string().min(8, 'API key must be at least 8 characters').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).refine((data) => data.apiKey || data.password, {
  message: 'Either apiKey or password must be provided for authentication',
  path: ['apiKey'],
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(USER_ROLES).default('ANALYST'),
  department: z.string().optional(),
  apiKey: z.string().min(8).optional(),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
