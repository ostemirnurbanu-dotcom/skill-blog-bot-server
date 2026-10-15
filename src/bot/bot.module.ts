import { Module } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BotController } from './bot.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
