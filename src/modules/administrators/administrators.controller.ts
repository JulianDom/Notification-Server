import { Controller, Post, Put, Body, Param, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { AdministratorsService } from './administrators.service';
import { LoginDto } from './dto/login.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Administrators')
@Controller('v1/administrators')
export class AdministratorsController {
  constructor(private readonly administratorsService: AdministratorsService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login de administrador' })
  async login(@Body() dto: LoginDto) {
    return this.administratorsService.login(dto);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Actualizar administrador' })
  @ApiHeader({ name: 'x-access-token', required: true })
  async update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.administratorsService.update(id, dto);
  }

  @Put(':id/changePassword')
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Cambiar contraseña de administrador' })
  @ApiHeader({ name: 'x-access-token', required: true })
  async changePassword(@Param('id') id: string, @Body() dto: ChangePasswordDto) {
    return this.administratorsService.changePassword(id, dto);
  }
}

@Controller()
export class RefreshTokenController {
  constructor(private readonly administratorsService: AdministratorsService) {}

  @Post('refreshToken')
  @ApiTags('Auth')
  @ApiOperation({ summary: 'Actualizar token de acceso' })
  @ApiHeader({ name: 'x-refresh-token', required: true })
  async refreshToken(@Headers('x-refresh-token') refreshToken: string) {
    return this.administratorsService.refreshToken(refreshToken);
  }
}
