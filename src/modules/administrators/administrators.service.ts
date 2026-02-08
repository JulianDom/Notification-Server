import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from './dto/login.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AdministratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async login(dto: LoginDto) {
    const admin = await this.prisma.administrator.findUnique({
      where: { username: dto.username },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!admin.enabled) {
      throw new UnauthorizedException('Administrator account is disabled');
    }

    const isPasswordValid = await this.authService.comparePassword(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.authService.generateAccessToken(admin.id);
    const refreshToken = this.authService.generateRefreshToken(admin.id);

    // Store refresh token
    await this.prisma.administrator.update({
      where: { id: admin.id },
      data: { refreshToken },
    });

    return {
      data: {
        id: admin.id,
        username: admin.username,
        emailAddress: admin.emailAddress,
        accessToken,
        refreshToken,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const payload = this.authService.verifyToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.prisma.administrator.findUnique({
      where: { id: payload.sub },
    });

    if (!admin || !admin.enabled || admin.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newAccessToken = this.authService.generateAccessToken(admin.id);

    return {
      data: newAccessToken,
    };
  }

  async update(id: string, dto: UpdateAdminDto) {
    const admin = await this.prisma.administrator.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException('Administrator not found');
    }

    const updated = await this.prisma.administrator.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        username: true,
        emailAddress: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: updated };
  }

  async changePassword(id: string, dto: ChangePasswordDto) {
    if (dto.passwordNew !== dto.passwordNewVerify) {
      throw new BadRequestException('New passwords do not match');
    }

    const admin = await this.prisma.administrator.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new NotFoundException('Administrator not found');
    }

    const isPasswordValid = await this.authService.comparePassword(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await this.authService.hashPassword(dto.passwordNew);

    const updated = await this.prisma.administrator.update({
      where: { id },
      data: { password: hashedPassword },
      select: {
        id: true,
        username: true,
        emailAddress: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: updated };
  }
}
