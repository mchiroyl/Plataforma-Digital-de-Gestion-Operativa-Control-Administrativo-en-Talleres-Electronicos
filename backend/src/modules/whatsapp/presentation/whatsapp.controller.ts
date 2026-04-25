import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthRequest } from '../../../shared/presentation/http/auth-request.type';
import { AuthGuard } from '../../auth/presentation/guards/auth.guard';
import { WhatsappService } from '../application/whatsapp.service';

@UseGuards(AuthGuard)
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Post('start')
  start() {
    return {
      status: 'MANUAL_MODE',
      message:
        'Por seguridad se usa WhatsApp Web oficial. Abra https://web.whatsapp.com/ en una pestana del navegador y escanee el QR ahi.',
      url: 'https://web.whatsapp.com/',
    };
  }

  @Get('status')
  status() {
    return this.whatsapp.status();
  }

  @Post('send')
  send(@Body() body: { orderId?: number; phone: string; message: string }, @Req() request: AuthRequest) {
    return this.whatsapp.send(body.orderId, body.phone, body.message, request.user.sub);
  }
}
