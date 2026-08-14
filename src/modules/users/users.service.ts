import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EnsureUserDto } from './dto/ensure-user.dto';
import { UnEnsureUserDto } from './dto/unensure-user.dto';
import { DeactivateTokenDto } from './dto/deactivate-token.dto';
import { OsType } from '@prisma/client';

const SERIALIZATION_FAILURE_MAX_RETRIES = 3;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ensure(appId: string, dto: EnsureUserDto) {
    // Todo el bloque (desactivar tokens viejos + activar el nuevo) corre en una
    // única transacción serializable: dos register-device casi simultáneos para
    // el mismo (reference, appId) — ej. un efecto de React disparándose dos
    // veces con tokens distintos — antes podían intercalarse (llamada A
    // desactiva todo y activa tokenA, llamada B lee el estado ANTES del commit
    // de A, desactiva todo de nuevo y activa tokenB, dejando el resultado final
    // dependiendo del orden de ejecución en vez de "el último token registrado
    // gana"). Serializable hace que Postgres aborte una de las dos transacciones
    // en conflicto (error 40001) en vez de aplicar ambas sobre datos obsoletos;
    // se reintenta esa transacción abortada un par de veces antes de rendirse.
    for (let attempt = 1; attempt <= SERIALIZATION_FAILURE_MAX_RETRIES; attempt++) {
      try {
        return await this.ensureInTransaction(appId, dto);
      } catch (error) {
        const isSerializationFailure =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' || (error.meta?.code as string | undefined) === '40001');
        if (!isSerializationFailure || attempt === SERIALIZATION_FAILURE_MAX_RETRIES) throw error;
        this.logger.warn(`ensure() conflicto de serialización, reintentando (intento ${attempt})`);
      }
    }
    // Inalcanzable: el loop siempre retorna o lanza en la última iteración.
    throw new Error('ensure() agotó los reintentos sin retornar');
  }

  private async ensureInTransaction(appId: string, dto: EnsureUserDto) {
    const user = await this.prisma.$transaction(
      async (tx) => {
        let user = await tx.user.upsert({
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

        const existingDevice = user.devices.find((d) => d.token === dto.token);

        if (!existingDevice) {
          // Deactivate other active tokens for this user/osType before adding the new one,
          // so a device that re-registers (app reinstall, token rotation) never leaves
          // stale tokens active — FCM sends would otherwise fan out to dead tokens or
          // duplicate across every token still valid on the same physical device.
          await tx.deviceToken.updateMany({
            where: { userId: user.id, osType: dto.osType as OsType, active: true },
            data: { active: false },
          });

          // Add new device. `upsert` on the same (token, userId) unique constraint
          // for the same reason as the user upsert above: two concurrent calls
          // registering the identical token must not race a plain create().
          await tx.deviceToken.upsert({
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
          await tx.deviceToken.updateMany({
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
            await tx.deviceToken.update({
              where: { id: existingDevice.id },
              data: { active: true },
            });
          }
        }

        // Reload user with updated devices
        const reloaded = await tx.user.findUnique({
          where: { id: user.id },
          include: { devices: true },
        });
        if (reloaded) {
          user = reloaded;
        }

        return user;
      },
      { isolationLevel: 'Serializable' },
    );

    return {
      data: {
        id: user.id,
        reference: user.reference,
        enabled: user.enabled,
        devices: user.devices.map((d) => ({
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
