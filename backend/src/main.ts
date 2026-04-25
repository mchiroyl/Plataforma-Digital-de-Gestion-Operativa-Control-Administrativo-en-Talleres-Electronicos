import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

function readAllowedOrigins() {
  return (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = readAllowedOrigins();
  const host = process.env.HOST ?? '127.0.0.1';
  const port = Number(process.env.PORT ?? 3000);

  app.setGlobalPrefix('api');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              baseUri: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              styleSrc: ["'self'", "'unsafe-inline'"],
              scriptSrc: ["'self'"],
              connectSrc: ["'self'", ...allowedOrigins],
              fontSrc: ["'self'", 'data:', 'https:'],
              formAction: ["'self'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(port, host);
}
bootstrap();
