import { Injectable } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

export interface JwtPayload {
  sub: string;
  type: 'access' | 'refresh';
  role: 'admin';
  [key: string]: unknown;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private getSignOptions(expiresIn: string): JwtSignOptions {
    return { expiresIn } as JwtSignOptions;
  }

  generateAccessToken(adminId: string): string {
    const payload: JwtPayload = {
      sub: adminId,
      type: 'access',
      role: 'admin',
    };
    return this.jwtService.sign(
      payload as Record<string, unknown>,
      this.getSignOptions(this.configService.get<string>('JWT_ACCESS_EXPIRATION', '45m')),
    );
  }

  generateRefreshToken(adminId: string): string {
    const payload: JwtPayload = {
      sub: adminId,
      type: 'refresh',
      role: 'admin',
    };
    return this.jwtService.sign(
      payload as Record<string, unknown>,
      this.getSignOptions(this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d')),
    );
  }

  verifyToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }
}
