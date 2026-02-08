import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiSecurity } from '@nestjs/swagger';
import { AppsService } from './apps.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@ApiTags('Apps')
@Controller('v1/apps')
@UseGuards(AdminGuard)
@ApiSecurity('admin-token')
@ApiHeader({ name: 'x-access-token', required: true })
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear aplicación' })
  async create(@Body() dto: CreateAppDto) {
    return this.appsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las aplicaciones' })
  async findAll() {
    return this.appsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener aplicación por ID' })
  async findOne(@Param('id') id: string) {
    return this.appsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar aplicación' })
  async update(@Param('id') id: string, @Body() dto: UpdateAppDto) {
    return this.appsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar aplicación' })
  async remove(@Param('id') id: string) {
    return this.appsService.remove(id);
  }
}
