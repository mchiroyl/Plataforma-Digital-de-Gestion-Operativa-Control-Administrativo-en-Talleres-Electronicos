import { Module } from '@nestjs/common';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { USER_CREDENTIALS_REPOSITORY } from './application/ports/user-credentials.repository';
import { PrismaUserCredentialsRepository } from './infrastructure/repositories/prisma-user-credentials.repository';
import { AuthController } from './presentation/controllers/auth.controller';
import { AuthGuard } from './presentation/guards/auth.guard';

@Module({
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    AuthGuard,
    PrismaUserCredentialsRepository,
    {
      provide: USER_CREDENTIALS_REPOSITORY,
      useExisting: PrismaUserCredentialsRepository,
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
