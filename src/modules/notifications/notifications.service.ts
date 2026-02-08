import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppsService } from '../apps/apps.service';
import { UsersService } from '../users/users.service';
import { SendNotificationDto, NotificationType } from './dto/send-notification.dto';
import { NotificationStatus } from '@prisma/client';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly appsService: AppsService,
    private readonly usersService: UsersService,
  ) {}

  async send(appId: string, dto: SendNotificationDto) {
    const firebaseApp = await this.appsService.getFirebaseApp(appId);
    const messaging = firebaseApp.messaging();

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        appId,
        type: dto.type,
        payload: dto as any,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      let result: any;

      switch (dto.type) {
        case NotificationType.send:
          result = await this.sendSingle(messaging, appId, dto);
          break;
        case NotificationType.sendEach:
          result = await this.sendEach(messaging, appId, dto);
          break;
        case NotificationType.sendEachForMulticast:
          result = await this.sendMulticast(messaging, appId, dto);
          break;
        default:
          throw new BadRequestException(`Invalid notification type: ${dto.type}`);
      }

      // Update notification with result
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: result.failureCount > 0 ? NotificationStatus.PARTIAL : NotificationStatus.SENT,
          result,
        },
      });

      return {};
    } catch (error) {
      // Update notification with error
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          result: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      });

      throw error;
    }
  }

  private async sendSingle(
    messaging: admin.messaging.Messaging,
    appId: string,
    dto: SendNotificationDto,
  ) {
    const reference = Array.isArray(dto.references) ? dto.references[0] : dto.references;
    if (!reference) {
      throw new BadRequestException('Reference is required for send type');
    }

    const tokens = await this.usersService.getActiveTokens(appId, [reference]);
    if (tokens.length === 0) {
      throw new BadRequestException('No active tokens found for the specified user');
    }

    const firebaseData = Array.isArray(dto.firebaseData) ? dto.firebaseData[0] : dto.firebaseData;

    const message: admin.messaging.Message = {
      token: tokens[0],
      ...(firebaseData.notification && { notification: firebaseData.notification }),
      ...(firebaseData.data && { data: firebaseData.data }),
    };

    const messageId = await messaging.send(message);
    return { messageId, successCount: 1, failureCount: 0 };
  }

  private async sendEach(
    messaging: admin.messaging.Messaging,
    appId: string,
    dto: SendNotificationDto,
  ) {
    if (!Array.isArray(dto.references) || !Array.isArray(dto.firebaseData)) {
      throw new BadRequestException('references and firebaseData must be arrays for sendEach type');
    }

    if (dto.references.length !== dto.firebaseData.length) {
      throw new BadRequestException(
        'references and firebaseData arrays must have the same length',
      );
    }

    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < dto.references.length; i++) {
      const reference = dto.references[i];
      const firebaseData = dto.firebaseData[i];

      const tokens = await this.usersService.getActiveTokens(appId, [reference]);
      if (tokens.length === 0) {
        results.push({ reference, error: 'No active tokens found' });
        failureCount++;
        continue;
      }

      try {
        const message: admin.messaging.Message = {
          token: tokens[0],
          ...(firebaseData.notification && { notification: firebaseData.notification }),
          ...(firebaseData.data && { data: firebaseData.data }),
        };

        const messageId = await messaging.send(message);
        results.push({ reference, messageId });
        successCount++;
      } catch (error) {
        results.push({
          reference,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    return { results, successCount, failureCount };
  }

  private async sendMulticast(
    messaging: admin.messaging.Messaging,
    appId: string,
    dto: SendNotificationDto,
  ) {
    let tokens: string[];

    if (dto.forAll) {
      tokens = await this.usersService.getAllActiveTokens(appId);
    } else {
      if (!dto.references || dto.references.length === 0) {
        throw new BadRequestException(
          'references is required for sendEachForMulticast type when forAll is false',
        );
      }
      const references = Array.isArray(dto.references) ? dto.references : [dto.references];
      tokens = await this.usersService.getActiveTokens(appId, references);
    }

    if (tokens.length === 0) {
      throw new BadRequestException('No active tokens found for the specified criteria');
    }

    const firebaseData = Array.isArray(dto.firebaseData) ? dto.firebaseData[0] : dto.firebaseData;

    // Firebase has a limit of 500 tokens per multicast
    const batchSize = 500;
    let successCount = 0;
    let failureCount = 0;
    const responses: any[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batchTokens = tokens.slice(i, i + batchSize);

      const message: admin.messaging.MulticastMessage = {
        tokens: batchTokens,
        ...(firebaseData.notification && { notification: firebaseData.notification }),
        ...(firebaseData.data && { data: firebaseData.data }),
      };

      const batchResponse = await messaging.sendEachForMulticast(message);
      successCount += batchResponse.successCount;
      failureCount += batchResponse.failureCount;
      responses.push(...batchResponse.responses);
    }

    return {
      successCount,
      failureCount,
      totalTokens: tokens.length,
      responses: responses.map((r, i) => ({
        success: r.success,
        messageId: r.messageId,
        error: r.error?.message,
      })),
    };
  }

  // Method for admin to send notifications (requires appId in body)
  async sendAsAdmin(appId: string, dto: SendNotificationDto) {
    return this.send(appId, dto);
  }
}
