import { Controller, Post, Body, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto, AdminSendNotificationDto } from './dto/send-notification.dto';
import { HmacGuard } from '../auth/guards/hmac.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Notifications')
@Controller('v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(HmacGuard)
  @ApiOperation({ summary: 'Enviar notificación (autenticación HMAC)' })
  @ApiHeader({ name: 'x-api-key', required: true })
  @ApiHeader({ name: 'x-timestamp', required: true })
  @ApiHeader({ name: 'x-signature', required: true })
  async send(@Req() req: any, @Body() dto: SendNotificationDto) {
    return this.notificationsService.send(req.app.id, dto);
  }

  @Post('admin')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Enviar notificación (autenticación admin)' })
  @ApiHeader({ name: 'x-access-token', required: true })
  async sendAsAdmin(@Body() dto: AdminSendNotificationDto) {
    return this.notificationsService.sendAsAdmin(dto.appId, dto);
  }
}
