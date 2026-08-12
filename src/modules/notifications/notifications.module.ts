import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushService } from './expo-push.service';
import { AuthModule } from '../auth/auth.module';
import { AppsModule } from '../apps/apps.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AuthModule, AppsModule, UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, ExpoPushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
