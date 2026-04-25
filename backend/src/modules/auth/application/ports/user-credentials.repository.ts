import { AuthUserEntity } from '../../domain/auth-user.entity';

export const USER_CREDENTIALS_REPOSITORY = Symbol('USER_CREDENTIALS_REPOSITORY');

export interface UserCredentialsRepository {
  findByUsername(username: string): Promise<AuthUserEntity | null>;
}
