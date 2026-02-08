import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { EnsureUserDto } from './dto/ensure-user.dto';
import { UnEnsureUserDto } from './dto/unensure-user.dto';
import { HmacGuard } from '../auth/guards/hmac.guard';

@ApiTags('Users')
@Controller('v1/users')
@UseGuards(HmacGuard)
@ApiHeader({ name: 'x-api-key', required: true })
@ApiHeader({ name: 'x-timestamp', required: true })
@ApiHeader({ name: 'x-signature', required: true })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('ensure')
  @ApiOperation({ summary: 'Habilitar usuario para recibir notificaciones' })
  async ensure(@Req() req: any, @Body() dto: EnsureUserDto) {
    return this.usersService.ensure(req.app.id, dto);
  }

  @Post('unEnsure')
  @ApiOperation({ summary: 'Deshabilitar usuario para no recibir notificaciones' })
  async unEnsure(@Req() req: any, @Body() dto: UnEnsureUserDto) {
    return this.usersService.unEnsure(req.app.id, dto);
  }
}
