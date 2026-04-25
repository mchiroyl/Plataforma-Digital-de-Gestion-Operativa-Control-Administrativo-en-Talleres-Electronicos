import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './modules/auth/auth.module';
import { CoreModule } from './modules/core/core.module';
import { PublicModule } from './modules/public/public.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { SecurityContextInterceptor } from './shared/infrastructure/http/security-context.interceptor';
import { SharedInfrastructureModule } from './shared/shared-infrastructure.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SharedInfrastructureModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
        signOptions: { expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ?? '8h') as never },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 80 }]),
    AuthModule,
    CoreModule,
    PublicModule,
    WhatsappModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: SecurityContextInterceptor,
    },
  ],
})
export class AppModule {}
