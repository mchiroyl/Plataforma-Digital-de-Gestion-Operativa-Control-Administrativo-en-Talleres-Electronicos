import { Request } from 'express';

export type AuthUser = {
  sub: number;
  username: string;
  role: string;
};

export type AuthRequest = Request & { user: AuthUser };
