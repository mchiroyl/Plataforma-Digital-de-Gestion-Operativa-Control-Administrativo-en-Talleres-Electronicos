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
    return this.whatsapp.start();
  }

  @Post('stop')
  stop() {
    return this.whatsapp.stop();
  }

  @Get('status')
  async status() {
    return this.whatsapp.status();
  }

  @Get('messages')
  recentMessages() {
    return this.whatsapp.recentMessages();
  }

  @Post('send')
  send(@Body() body: { orderId?: number; phone: string; message: string }, @Req() request: AuthRequest) {
    return this.whatsapp.send(body.orderId, body.phone, body.message, request.user.sub);
  }
}
