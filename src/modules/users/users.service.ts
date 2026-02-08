import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnsureUserDto } from './dto/ensure-user.dto';
import { UnEnsureUserDto } from './dto/unensure-user.dto';
import { OsType } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(appId: string, dto: EnsureUserDto) {
    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: {
        reference_appId: {
          reference: dto.reference,
          appId,
        },
      },
      include: {
        devices: true,
      },
    });

    if (!user) {
      // Create new user with device
      user = await this.prisma.user.create({
        data: {
          reference: dto.reference,
          appId,
          enabled: true,
          devices: {
            create: {
              token: dto.token,
              osType: dto.osType as OsType,
              active: true,
            },
          },
        },
        include: {
          devices: true,
        },
      });
    } else {
      // Update user to enabled
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { enabled: true },
        include: { devices: true },
      });

      // Check if device already exists
      const existingDevice = user.devices.find((d) => d.token === dto.token);

      if (!existingDevice) {
        // Add new device
        await this.prisma.deviceToken.create({
          data: {
            token: dto.token,
            osType: dto.osType as OsType,
            userId: user.id,
            active: true,
          },
        });
      } else if (!existingDevice.active) {
        // Reactivate device
        await this.prisma.deviceToken.update({
          where: { id: existingDevice.id },
          data: { active: true },
        });
      }

      // Reload user with updated devices
      user = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { devices: true },
      })!;
    }

    return {
      data: {
        id: user!.id,
        reference: user!.reference,
        enabled: user!.enabled,
        devices: user!.devices.map((d) => ({
          id: d.id,
          osType: d.osType,
          active: d.active,
        })),
      },
    };
  }

  async unEnsure(appId: string, dto: UnEnsureUserDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        reference_appId: {
          reference: dto.reference,
          appId,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Disable user and all their devices
    await this.prisma.user.update({
      where: { id: user.id },
      data: { enabled: false },
    });

    await this.prisma.deviceToken.updateMany({
      where: { userId: user.id },
      data: { active: false },
    });

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { devices: true },
    });

    return {
      data: {
        id: updatedUser!.id,
        reference: updatedUser!.reference,
        enabled: updatedUser!.enabled,
        devices: updatedUser!.devices.map((d) => ({
          id: d.id,
          osType: d.osType,
          active: d.active,
        })),
      },
    };
  }

  async getActiveTokens(appId: string, references: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        appId,
        reference: { in: references },
        enabled: true,
      },
      include: {
        devices: {
          where: { active: true },
        },
      },
    });

    return users.flatMap((u) => u.devices.map((d) => d.token));
  }

  async getAllActiveTokens(appId: string): Promise<string[]> {
    const devices = await this.prisma.deviceToken.findMany({
      where: {
        active: true,
        user: {
          appId,
          enabled: true,
        },
      },
    });

    return devices.map((d) => d.token);
  }
}
