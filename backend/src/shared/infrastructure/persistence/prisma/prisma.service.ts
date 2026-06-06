import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { RequestSecurityContextService, SecurityContext } from '../../context/request-security-context.service';

type PrismaTransactionCallback<T> = (prisma: Prisma.TransactionClient) => Promise<T>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL,
      },
    },
  });

  constructor(private readonly requestSecurityContext: RequestSecurityContextService) {}

  private get currentClient() {
    return this.requestSecurityContext.getStore()?.prisma ?? this.prismaClient;
  }

  get user() {
    return this.currentClient.user;
  }

  get role() {
    return this.currentClient.role;
  }

  get shopSettings() {
    return this.currentClient.shopSettings;
  }

  get repairOrder() {
    return this.currentClient.repairOrder;
  }

  get clientTable() {
    return this.currentClient.client;
  }

  get client() {
    return this.currentClient.client;
  }

  get technician() {
    return this.currentClient.technician;
  }

  get sparePart() {
    return this.currentClient.sparePart;
  }

  get payment() {
    return this.currentClient.payment;
  }

  get expense() {
    return this.currentClient.expense;
  }

  get repairOrderEvidence() {
    return this.currentClient.repairOrderEvidence;
  }

  get equipmentType() {
    return this.currentClient.equipmentType;
  }

  get faultCategory() {
    return this.currentClient.faultCategory;
  }

  get faultType() {
    return this.currentClient.faultType;
  }

  get equipment() {
    return this.currentClient.equipment;
  }

  get inventoryMovement() {
    return this.currentClient.inventoryMovement;
  }

  get inventorySale() {
    return this.currentClient.inventorySale;
  }

  get inventorySaleItem() {
    return this.currentClient.inventorySaleItem;
  }

  get orderFaultType() {
    return this.currentClient.orderFaultType;
  }

  get statusHistory() {
    return this.currentClient.statusHistory;
  }

  get quoteDetail() {
    return this.currentClient.quoteDetail;
  }

  get whatsappNotification() {
    return this.currentClient.whatsappNotification;
  }

  get auditLog() {
    return this.currentClient.auditLog;
  }

  async onModuleInit() {
    await this.prismaClient.$connect();
  }

  async onModuleDestroy() {
    await this.prismaClient.$disconnect();
  }

  async $transaction<T>(input: Prisma.PrismaPromise<T>[], options?: object): Promise<T[]>;
  async $transaction<T>(fn: PrismaTransactionCallback<T>, options?: object): Promise<T>;
  async $transaction<T>(
    input: Prisma.PrismaPromise<T>[] | PrismaTransactionCallback<T>,
    options?: object,
  ): Promise<T | T[]> {
    const contextualTransaction = this.requestSecurityContext.getStore()?.prisma;
    if (contextualTransaction && typeof input === 'function') {
      return input(contextualTransaction);
    }
    if (contextualTransaction && Array.isArray(input)) {
      return Promise.all(input);
    }
    return this.prismaClient.$transaction(input as never, options as never);
  }

  async runWithSecurityContext<T>(security: SecurityContext, work: () => Promise<T>) {
    return this.prismaClient.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.user_id', ${security.userId ? String(security.userId) : ''}, true),
          set_config('app.user_role', ${security.role}, true),
          set_config('app.tracking_token', ${security.trackingToken ?? ''}, true),
          set_config('app.public_order_id', ${security.publicOrderId ? String(security.publicOrderId) : ''}, true),
          set_config('app.ip_address', ${security.ipAddress ?? ''}, true),
          set_config('app.user_agent', ${security.userAgent ?? ''}, true)
      `;

      return this.requestSecurityContext.run({ prisma: tx, security }, work);
    }, { timeout: 20000, maxWait: 10000 });
  }
}
