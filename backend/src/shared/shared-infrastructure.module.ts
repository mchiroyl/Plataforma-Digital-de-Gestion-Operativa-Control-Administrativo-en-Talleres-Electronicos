import { Global, Module } from '@nestjs/common';
import { PrismaService } from './infrastructure/persistence/prisma/prisma.service';
import { RequestSecurityContextService } from './infrastructure/context/request-security-context.service';

@Global()
@Module({
  providers: [PrismaService, RequestSecurityContextService],
  exports: [PrismaService, RequestSecurityContextService],
})
export class SharedInfrastructureModule {}
