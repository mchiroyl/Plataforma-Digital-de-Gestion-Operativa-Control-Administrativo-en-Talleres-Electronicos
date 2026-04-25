import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { PublicController } from './presentation/public.controller';

@Module({
  imports: [CoreModule],
  controllers: [PublicController],
})
export class PublicModule {}
