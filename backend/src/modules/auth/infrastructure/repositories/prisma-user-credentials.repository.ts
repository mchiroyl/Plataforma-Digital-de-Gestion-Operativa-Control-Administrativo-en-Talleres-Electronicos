import { Injectable } from '@nestjs/common';
import { UserCredentialsRepository } from '../../application/ports/user-credentials.repository';
import { PrismaService } from '../../../../shared/infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class PrismaUserCredentialsRepository implements UserCredentialsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      passwordHash: user.passwordHash,
      role: user.role.name,
    };
  }
}
