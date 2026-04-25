import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreService } from './application/core.service';
import { CoreController } from './presentation/core.controller';

@Module({
  imports: [AuthModule],
  controllers: [CoreController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
