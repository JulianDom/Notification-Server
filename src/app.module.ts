import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AdministratorsModule } from './modules/administrators/administrators.module';
import { AppsModule } from './modules/apps/apps.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AdministratorsModule,
    AppsModule,
    UsersModule,
    NotificationsModule,
  ],
})
export class AppModule {}
