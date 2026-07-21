import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService.ensure — un solo token activo por (usuario, osType)', () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    deviceToken: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      deviceToken: { create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('al registrar un token nuevo para un usuario existente, desactiva los demás tokens activos del mismo osType antes de crear el nuevo', async () => {
    const existingUser = {
      id: 'user-1',
      reference: 'ref-1',
      enabled: true,
      devices: [
        { id: 'device-old-1', token: 'token-old-1', osType: 'android', active: true },
        { id: 'device-old-2', token: 'token-old-2', osType: 'android', active: true },
      ],
    };

    prisma.user.findUnique
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce({ ...existingUser, devices: [...existingUser.devices, { id: 'device-new', token: 'token-new', osType: 'android', active: true }] });
    prisma.user.update.mockResolvedValue({ ...existingUser, enabled: true });
    prisma.deviceToken.updateMany.mockResolvedValue({ count: 2 });
    prisma.deviceToken.create.mockResolvedValue({ id: 'device-new', token: 'token-new', osType: 'android', active: true });

    await service.ensure('app-1', { reference: 'ref-1', token: 'token-new', osType: 'android' } as any);

    expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', osType: 'android', active: true },
      data: { active: false },
    });
    expect(prisma.deviceToken.create).toHaveBeenCalledWith({
      data: { token: 'token-new', osType: 'android', userId: 'user-1', active: true },
    });
  });

  it('si el token ya existe para ese usuario, reactiva ese device y desactiva los otros tokens del mismo osType', async () => {
    const existingUser = {
      id: 'user-1',
      reference: 'ref-1',
      enabled: true,
      devices: [
        { id: 'device-a', token: 'token-a', osType: 'android', active: false },
        { id: 'device-b', token: 'token-b', osType: 'android', active: true },
      ],
    };

    prisma.user.findUnique
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(existingUser);
    prisma.user.update.mockResolvedValue({ ...existingUser, enabled: true });
    prisma.deviceToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.deviceToken.update.mockResolvedValue({ id: 'device-a', active: true });

    await service.ensure('app-1', { reference: 'ref-1', token: 'token-a', osType: 'android' } as any);

    expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', osType: 'android', active: true, id: { not: 'device-a' } },
      data: { active: false },
    });
    expect(prisma.deviceToken.update).toHaveBeenCalledWith({
      where: { id: 'device-a' },
      data: { active: true },
    });
  });

  it('no toca dispositivos de otro osType (ej. ios) al registrar un token android nuevo', async () => {
    const existingUser = {
      id: 'user-1',
      reference: 'ref-1',
      enabled: true,
      devices: [
        { id: 'device-ios', token: 'token-ios', osType: 'ios', active: true },
      ],
    };

    prisma.user.findUnique
      .mockResolvedValueOnce(existingUser)
      .mockResolvedValueOnce(existingUser);
    prisma.user.update.mockResolvedValue({ ...existingUser, enabled: true });
    prisma.deviceToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.deviceToken.create.mockResolvedValue({ id: 'device-android', token: 'token-android', osType: 'android', active: true });

    await service.ensure('app-1', { reference: 'ref-1', token: 'token-android', osType: 'android' } as any);

    expect(prisma.deviceToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', osType: 'android', active: true },
      data: { active: false },
    });
  });
});
