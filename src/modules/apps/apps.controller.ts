import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiSecurity } from '@nestjs/swagger';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UsersService } from '../users/users.service';
import { EnsureUserDto } from '../users/dto/ensure-user.dto';

@ApiTags('Apps')
@Controller('v1/apps')
export class AppsController {
  constructor(
    private readonly appsService: AppsService,
    private readonly usersService: UsersService,
  ) {}

  @Post(':appId/register-device')
  @ApiOperation({ summary: 'Registrar dispositivo para recibir notificaciones (uso desde app cliente)' })
  async registerDevice(@Param('appId') appId: string, @Body() dto: EnsureUserDto) {
    const app = await this.appsService.findOne(appId).catch(() => null);
    if (!app || !app.data) throw new NotFoundException('App not found');
    return this.usersService.ensure(appId, dto);
  }

  @Post()
  @UseGuards(AdminGuard)
  @ApiSecurity('admin-token')
  @ApiHeader({ name: 'x-access-token', required: true })
  @ApiOperation({ summary: 'Crear aplicación' })
  async create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiSecurity('admin-token')
  @ApiHeader({ name: 'x-access-token', required: true })
  @ApiOperation({ summary: 'Listar todas las aplicaciones' })
  async findAll() {
    return this.appsService.findAll();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  @ApiSecurity('admin-token')
  @ApiHeader({ name: 'x-access-token', required: true })
  @ApiOperation({ summary: 'Obtener aplicación por ID' })
  async findOne(@Param('id') id: string) {
    return this.appsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @ApiSecurity('admin-token')
  @ApiHeader({ name: 'x-access-token', required: true })
  @ApiOperation({ summary: 'Actualizar aplicación' })
  async update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @ApiSecurity('admin-token')
  @ApiHeader({ name: 'x-access-token', required: true })
  @ApiOperation({ summary: 'Eliminar aplicación' })
  async remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }
}
