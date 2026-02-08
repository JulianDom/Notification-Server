import { Module } from '@nestjs/common';
import { AdministratorsController, RefreshTokenController } from './administrators.controller';
import { AdministratorsService } from './administrators.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdministratorsController, RefreshTokenController],
  providers: [AdministratorsService],
  exports: [AdministratorsService],
})
export class AdministratorsModule {}
