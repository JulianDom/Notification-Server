import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AppsService } from './apps.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: { cert: jest.fn((config) => config) },
}));

describe('AppsService.getFirebaseApp — inicialización concurrente', () => {
  let service: AppsService;
  let prisma: { app: { findUnique: jest.Mock } };
  const initializeAppMock = admin.initializeApp as jest.Mock;

  beforeEach(async () => {
    prisma = { app: { findUnique: jest.fn() } };
    initializeAppMock.mockReset();

    const moduleRef = await Test.createTestingModule({
      providers: [AppsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AppsService);
  });

  it('dos llamadas concurrentes para el mismo appId inicializan Firebase una sola vez', async () => {
    prisma.app.findUnique.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 'app-1', enabled: true, firebaseConfig: {} }), 10)),
    );
    const fakeFirebaseApp = { name: 'app-1' } as admin.app.App;
    initializeAppMock.mockReturnValue(fakeFirebaseApp);

    const [resultA, resultB] = await Promise.all([
      service.getFirebaseApp('app-1'),
      service.getFirebaseApp('app-1'),
    ]);

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(resultA).toBe(fakeFirebaseApp);
    expect(resultB).toBe(fakeFirebaseApp);
  });

  it('una llamada posterior, tras la primera ya resuelta, reusa el cache sin volver a consultar la DB', async () => {
    prisma.app.findUnique.mockResolvedValue({ id: 'app-1', enabled: true, firebaseConfig: {} });
    const fakeFirebaseApp = { name: 'app-1' } as admin.app.App;
    initializeAppMock.mockReturnValue(fakeFirebaseApp);

    await service.getFirebaseApp('app-1');
    await service.getFirebaseApp('app-1');

    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(prisma.app.findUnique).toHaveBeenCalledTimes(1);
  });

  it('si la app no existe o está deshabilitada, lanza NotFoundException y no queda una promesa colgada bloqueando futuras llamadas', async () => {
    prisma.app.findUnique.mockResolvedValueOnce(null);

    await expect(service.getFirebaseApp('app-missing')).rejects.toThrow(NotFoundException);

    // Una llamada posterior con la app ya disponible debe poder inicializar normalmente
    prisma.app.findUnique.mockResolvedValueOnce({ id: 'app-missing', enabled: true, firebaseConfig: {} });
    const fakeFirebaseApp = { name: 'app-missing' } as admin.app.App;
    initializeAppMock.mockReturnValue(fakeFirebaseApp);

    const result = await service.getFirebaseApp('app-missing');
    expect(result).toBe(fakeFirebaseApp);
  });
});
