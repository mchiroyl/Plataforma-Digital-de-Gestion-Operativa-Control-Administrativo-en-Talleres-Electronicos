import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LoginDto } from '../dto/login.dto';
import { AuthGuard } from '../guards/auth.guard';
import type { AuthRequest } from '../../../../shared/presentation/http/auth-request.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.loginUseCase.execute(body.username, body.password);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() request: AuthRequest) {
    return request.user;
  }
}
