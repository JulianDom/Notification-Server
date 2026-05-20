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
  Logger,
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
  private readonly logger = new Logger(AppsController.name);

  constructor(
    private readonly appsService: AppsService,
    private readonly usersService: UsersService,
  ) {}

  @Post(':appId/register-device')
  @ApiOperation({ summary: 'Registrar dispositivo para recibir notificaciones (uso desde app cliente)' })
  async registerDevice(@Param('appId') appId: string, @Body() dto: EnsureUserDto) {
    const app = await this.appsService.findOne(appId).catch(() => null);
    if (!app || !app.data) {
      this.logger.warn(`[REGISTER_DEVICE] ⚠️ App not found: appId=${appId}`);
      throw new NotFoundException('App not found');
    }
    this.logger.log(`[REGISTER_DEVICE] reference=${dto.reference} osType=${dto.osType} token=${dto.token.substring(0, 20)}... appId=${appId}`);
    const result = await this.usersService.ensure(appId, dto);
    this.logger.log(`[REGISTER_DEVICE] ✅ reference=${dto.reference} registered/updated`);
    return result;
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
