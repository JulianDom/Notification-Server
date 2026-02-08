import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import * as admin from 'firebase-admin';

@Injectable()
export class AppsService {
  private firebaseApps: Map<string, admin.app.App> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppDto) {
    // Validate Firebase config
    try {
      const testApp = admin.initializeApp(
        {
          credential: admin.credential.cert(dto.firebaseConfig as admin.ServiceAccount),
        },
        `test-${Date.now()}`,
      );
      await testApp.delete();
    } catch (error) {
      throw new BadRequestException('Invalid Firebase configuration');
    }

    // Generate API key and secret
    const apiKey = `nk_${uuidv4().replace(/-/g, '')}`;
    const apiSecret = randomBytes(32).toString('hex');

    const app = await this.prisma.app.create({
      data: {
        name: dto.name,
        apiKey,
        apiSecret,
        firebaseConfig: dto.firebaseConfig,
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return apiSecret only on creation (cannot be recovered later)
    return {
      data: {
        ...app,
        apiSecret, // Only returned once!
      },
    };
  }

  async findAll() {
    const apps = await this.prisma.app.findMany({
      select: {
        id: true,
        name: true,
        apiKey: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: apps };
  }

  async findOne(id: string) {
    const app = await this.prisma.app.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        apiKey: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    return { data: app };
  }

  async update(id: string, dto: UpdateAppDto) {
    const app = await this.prisma.app.findUnique({
      where: { id },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    const updated = await this.prisma.app.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        apiKey: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: updated };
  }

  async remove(id: string) {
    const app = await this.prisma.app.findUnique({
      where: { id },
    });

    if (!app) {
      throw new NotFoundException('App not found');
    }

    // Remove from Firebase apps cache
    const firebaseApp = this.firebaseApps.get(id);
    if (firebaseApp) {
      await firebaseApp.delete();
      this.firebaseApps.delete(id);
    }

    await this.prisma.app.delete({
      where: { id },
    });

    return {};
  }

  async getFirebaseApp(appId: string): Promise<admin.app.App> {
    // Check cache first
    if (this.firebaseApps.has(appId)) {
      return this.firebaseApps.get(appId)!;
    }

    // Load from database
    const app = await this.prisma.app.findUnique({
      where: { id: appId },
    });

    if (!app || !app.enabled) {
      throw new NotFoundException('App not found or disabled');
    }

    // Initialize Firebase app
    const firebaseApp = admin.initializeApp(
      {
        credential: admin.credential.cert(app.firebaseConfig as admin.ServiceAccount),
      },
      appId,
    );

    this.firebaseApps.set(appId, firebaseApp);
    return firebaseApp;
  }
}
