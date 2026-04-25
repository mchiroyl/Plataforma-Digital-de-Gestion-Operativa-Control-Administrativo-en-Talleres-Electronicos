import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsappService } from './application/whatsapp.service';
import { WhatsappController } from './presentation/whatsapp.controller';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
