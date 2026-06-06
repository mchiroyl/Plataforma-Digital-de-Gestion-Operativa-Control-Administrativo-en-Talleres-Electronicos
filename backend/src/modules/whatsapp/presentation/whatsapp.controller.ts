import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('channels')
  channels() {
    return this.whatsapp.channels();
  }

  @Post('channels/:channelKey/start')
  startChannel(@Param('channelKey') channelKey: string) {
    return this.whatsapp.start(channelKey);
  }

  @Post('channels/:channelKey/stop')
  stopChannel(@Param('channelKey') channelKey: string) {
    return this.whatsapp.stop(channelKey);
  }

  @Get('channels/:channelKey/status')
  statusChannel(@Param('channelKey') channelKey: string) {
    return this.whatsapp.status(channelKey);
  }

  @Get('messages')
  recentMessages(@Query('channelKey') channelKey?: string) {
    return this.whatsapp.recentMessages(channelKey);
  }

  @Post('send')
  send(@Body() body: { orderId?: number; phone: string; message: string; channelKey?: string }, @Req() request: AuthRequest) {
    return this.whatsapp.send(body.orderId, body.phone, body.message, request.user.sub, body.channelKey);
  }
}
