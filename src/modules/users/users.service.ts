import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnsureUserDto } from './dto/ensure-user.dto';
import { UnEnsureUserDto } from './dto/unensure-user.dto';
import { DeactivateTokenDto } from './dto/deactivate-token.dto';
import { OsType } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async ensure(appId: string, dto: EnsureUserDto) {
    // `upsert` (not findUnique + create/update) so two concurrent register-device
    // calls for the same brand-new (reference, appId) can't both see "no user"
    // and both attempt create(), which previously threw a P2002 unique constraint
    // error and surfaced as a 500 to the app on double-registration (e.g. a
    // React effect firing twice, or a retry racing the original request).
    let user = await this.prisma.user.upsert({
      where: {
        reference_appId: {
          reference: dto.reference,
          appId,
        },
      },
      create: {
        reference: dto.reference,
        appId,
        enabled: true,
      },
      update: {
        enabled: true,
      },
      include: {
        devices: true,
      },
    });

    {
      // Check if device already exists
      const existingDevice = user.devices.find((d) => d.token === dto.token);

      if (!existingDevice) {
        // Deactivate other active tokens for this user/osType before adding the new one,
        // so a device that re-registers (app reinstall, token rotation) never leaves
        // stale tokens active — FCM sends would otherwise fan out to dead tokens or
        // duplicate across every token still valid on the same physical device.
        await this.prisma.deviceToken.updateMany({
          where: { userId: user.id, osType: dto.osType as OsType, active: true },
          data: { active: false },
        });

        // Add new device. `upsert` on the same (token, userId) unique constraint
        // for the same reason as the user upsert above: two concurrent calls
        // registering the identical token must not race a plain create().
        await this.prisma.deviceToken.upsert({
          where: {
            token_userId: {
              token: dto.token,
              userId: user.id,
            },
          },
          create: {
            token: dto.token,
            osType: dto.osType as OsType,
            userId: user.id,
            active: true,
          },
          update: {
            active: true,
          },
        });
      } else {
        // Deactivate any other active token for this user/osType, keeping only this device active
        await this.prisma.deviceToken.updateMany({
          where: {
            userId: user.id,
            osType: dto.osType as OsType,
            active: true,
            id: { not: existingDevice.id },
          },
          data: { active: false },
        });

        if (!existingDevice.active) {
          // Reactivate device
          await this.prisma.deviceToken.update({
            where: { id: existingDevice.id },
            data: { active: true },
          });
        }
      }

      // Reload user with updated devices
      const reloaded = await this.prisma.user.findUnique({
        where: { id: user.id },
        include: { devices: true },
      });
      if (reloaded) {
        user = reloaded;
      }
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

  async deactivateToken(appId: string, dto: DeactivateTokenDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        reference_appId: {
          reference: dto.reference,
          appId,
        },
      },
    });

    // Logout no debe fallar si el usuario/token ya no existe (doble logout, token ya rotado, etc).
    if (!user) return;

    await this.prisma.deviceToken.updateMany({
      where: { userId: user.id, token: dto.token },
      data: { active: false },
    });
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
