import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { PrismaService } from '../persistence/prisma/prisma.service';
import type { AuthRequest } from '../../presentation/http/auth-request.type';

@Injectable()
export class SecurityContextInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const trackingToken = typeof request.query?.token === 'string' ? request.query.token : undefined;
    const publicOrderId =
      typeof request.params?.id === 'string' && /^\d+$/.test(request.params.id) ? Number(request.params.id) : undefined;
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader.join(' ') : userAgentHeader;

    return from(
      this.prisma.runWithSecurityContext(
        {
          userId: request.user?.sub,
          role: request.user?.role ?? 'ANON',
          trackingToken,
          publicOrderId,
          ipAddress: request.ip,
          userAgent,
        },
        async () => {
          const result = next.handle();
          return await new Promise((resolve, reject) => {
            let lastValue: unknown;
            result.subscribe({
              next: (value) => {
                lastValue = value;
              },
              error: reject,
              complete: () => resolve(lastValue),
            });
          });
        },
      ),
    );
  }
}
