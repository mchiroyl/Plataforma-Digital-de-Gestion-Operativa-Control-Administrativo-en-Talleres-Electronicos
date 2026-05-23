import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { WhatsappService } from './application/whatsapp.service';
import { WhatsappController } from './presentation/whatsapp.controller';

@Module({
  imports: [AuthModule, CoreModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
