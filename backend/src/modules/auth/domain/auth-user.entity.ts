export type AuthUserEntity = {
  id: number;
  username: string;
  email: string;
  fullName: string;
  isActive: boolean;
  passwordHash: string;
  role: string;
};
