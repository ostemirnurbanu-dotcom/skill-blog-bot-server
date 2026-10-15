import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../prisma/prisma.service';
import { Reputations, Prisma } from '../../generated/prisma/client';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private bot!: TelegramBot;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.botMessage();
  }

  botMessage() {
    const token = process.env.BOT_API_TOKEN;
    const thanksWords = [
      'спасибо',
      'спс',
      'благодарю',
      'thanks',
      'заработало',
      'сработало',
      '👍',
    ];

    if (!token) {
      throw new Error('BOT_API_TOKEN is not defined');
    }

    this.bot = new TelegramBot(token, { polling: true });

    this.bot.on('new_chat_members', (msg) => {
      const members = msg.new_chat_members;

      if (!members || members.length === 0) {
        return;
      }
      const name = members[0].first_name;

      return this.bot.sendMessage(
        msg.chat.id,
        `Привет, ${name}! Добро пожаловать в наш чат! Я Skill Blog Bot! Если у тебя есть вопросы, можешь задать их нам, и мы с участниками чата постараемся на них ответить и помочь 😊.`,
      );
    });

    this.bot.on('left_chat_member', (msg) =>
      this.removeReputation(String(msg.left_chat_member?.id)),
    );

    this.bot.on('message', async (msg) => {
      if (msg?.sticker) {
        if (msg.sticker.emoji === '👍') {
          await this.handleThanksWordReaction(msg, this.bot);
        }
        return;
      }

      if (msg.reply_to_message) {
        if (
          msg.reply_to_message.from?.username === 'nurbanu_skill_blog_bot' ||
          msg.reply_to_message.from?.username === msg.from?.username
        ) {
          return;
        }

        const thanksWord = msg.text
          ?.toLowerCase()
          .split(' ')
          .find((word) =>
            thanksWords.includes(
              word.replace(/[&\/\\#,+()$~%.'":*?!<>{}]/g, ''),
            ),
          );

        if (thanksWord) {
          await this.handleThanksWordReaction(msg, this.bot);
        }
      }
    });
  }

  async removeReputation(telegramId: string) {
    const user = await this.prisma.reputations.findFirst({
      where: { telegramId },
    });

    if (user) {
      await this.prisma.reputations.delete({ where: { id: user.id } });
    }
  }

  async getAllReputations(): Promise<Reputations[]> {
    return await this.prisma.reputations.findMany();
  }

  async getReputation(telegramId: string): Promise<Reputations | null> {
    return await this.prisma.reputations.findFirst({
      where: { telegramId },
    });
  }

  async updateReputation(
    id: number,
    reputation: number,
    userName: string,
    userAvatar: string,
    fullName: string,
  ): Promise<void> {
    await this.prisma.reputations.update({
      where: { id },
      data: {
        reputation,
        userName,
        userAvatar,
        fullName,
      },
    });
  }

  async addNewReputation(data: Prisma.ReputationsCreateInput): Promise<void> {
    await this.prisma.reputations.create({ data });
  }

  async sendReputationMessage(
    chatId: number,
    fromUserName: string,
    replyUserName: string,
    bot: TelegramBot,
    telegramId: string,
  ) {
    const reputationData = await this.getReputation(telegramId);

    if (!reputationData) {
      return;
    }

    await bot.sendMessage(
      chatId,
      `Поздравляю ${replyUserName}! Участник ${fromUserName} повысил твою репутацию, так держать! Твоя репутация ${reputationData.reputation}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Статистика чата',
                url: 'https://skill-a7twoezq6-nurbanu.vercel.app',
              },
            ],
          ],
        },
      },
    );
  }

  async increaseReputation(
    telegramId: string,
    userName: string,
    userAvatar: string,
    fullName: string,
  ) {
    const reputationData = await this.getReputation(telegramId);

    if (reputationData) {
      await this.updateReputation(
        reputationData.id,
        reputationData.reputation + 1,
        userName,
        userAvatar,
        fullName,
      );
      return;
    }

    await this.addNewReputation({
      telegramId,
      userName,
      userAvatar,
      fullName,
      reputation: 1,
    });
  }

  async handleThanksWordReaction(msg: TelegramBot.Message, bot: TelegramBot) {
    const user = msg.reply_to_message?.from;

    if (!user || user.is_bot) {
      return;
    }

    const telegramId = String(user.id);
    const avatarURL = await this.getUserAvatarURL(user.id, bot);

    await this.increaseReputation(
      telegramId,
      user.username ? user.username : '',
      avatarURL,
      `${user.first_name} ${user.last_name}`,
    );

    await this.sendReputationMessage(
      msg.chat.id,
      msg.from?.first_name ?? '',
      `${user.first_name} ${user.username ? `@${user.username}` : ''}`,
      bot,
      telegramId,
    );
  }

  async getUserAvatarURL(userId: number, bot: TelegramBot) {
    const userProfile = await bot.getUserProfilePhotos(userId);

    if (!userProfile.photos.length) {
      return '';
    }

    const fileId = userProfile.photos[0][0].file_id;
    const file = bot.getFile(fileId);
    const filePath = (await file).file_path;

    return `https://api.telegram.org/file/bot${process.env.BOT_API_TOKEN}/${filePath}`;
  }

  async onModuleDestroy() {
    await this.bot?.stopPolling();
  }
}
