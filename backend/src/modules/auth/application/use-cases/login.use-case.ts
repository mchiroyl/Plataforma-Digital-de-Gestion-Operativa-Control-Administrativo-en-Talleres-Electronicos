import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { USER_CREDENTIALS_REPOSITORY } from '../ports/user-credentials.repository';
import type { UserCredentialsRepository } from '../ports/user-credentials.repository';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_CREDENTIALS_REPOSITORY)
    private readonly userCredentialsRepository: UserCredentialsRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(username: string, password: string) {
    const user = await this.userCredentialsRepository.findByUsername(username.trim().toLowerCase());
    if (!user || !user.isActive) throw new UnauthorizedException('Credenciales invalidas');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales invalidas');

    const payload = { sub: user.id, username: user.username, role: user.role };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    };
  }
}
