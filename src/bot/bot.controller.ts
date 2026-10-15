import { Controller, Get } from '@nestjs/common';
import { BotService } from './bot.service';
import { Reputations } from '../../generated/prisma/browser';

@Controller()
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get('/reputations')
  async getReputations(): Promise<Reputations[]> {
    const reputations = await this.botService.getAllReputations();
    return reputations.sort((a, b) => b.reputation - a.reputation);
  }
}
