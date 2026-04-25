import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

export type SecurityContext = {
  userId?: number;
  role: string;
  trackingToken?: string;
  publicOrderId?: number;
  ipAddress?: string;
  userAgent?: string;
};

type RequestStore = {
  prisma?: Prisma.TransactionClient;
  security: SecurityContext;
};

@Injectable()
export class RequestSecurityContextService {
  private readonly storage = new AsyncLocalStorage<RequestStore>();

  run<T>(store: RequestStore, callback: () => Promise<T>): Promise<T> {
    return this.storage.run(store, callback);
  }

  getStore() {
    return this.storage.getStore();
  }
}
