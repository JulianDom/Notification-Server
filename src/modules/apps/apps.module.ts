import { Module } from '@nestjs/common';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';
import { AuthModule } from '../auth/auth.module';
import { UsersService } from '../users/users.service';

@Module({
  imports: [AuthModule],
  controllers: [AppsController],
  providers: [AppsService, UsersService],
  exports: [AppsService],
})
export class AppsModule {}
