export interface User {
  id: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  user_id: string;
  role: 'user' | 'admin';
  terms_accepted_at?: string;
  created_at: string;
  updated_at: string;
}

import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: User;
  profile?: Profile;
}

export interface JWTPayload {
  sub: string;
  email?: string;
  phone?: string;
  role?: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}
