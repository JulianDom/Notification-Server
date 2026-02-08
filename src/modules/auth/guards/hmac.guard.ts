import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class HmacGuard implements CanActivate {
  private readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const timestamp = request.headers['x-timestamp'];
    const apiKey = request.headers['x-api-key'];
    const signature = request.headers['x-signature'];

    if (!timestamp || !apiKey || !signature) {
      throw new BadRequestException('Missing required headers: x-timestamp, x-api-key, x-signature');
    }

    // Validate timestamp
    const requestTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (isNaN(requestTime) || Math.abs(now - requestTime) > this.TIMESTAMP_TOLERANCE_MS) {
      throw new UnauthorizedException('Request timestamp is invalid or expired');
    }

    // Find app by API key
    const app = await this.prisma.app.findUnique({
      where: { apiKey },
    });

    if (!app || !app.enabled) {
      throw new UnauthorizedException('Invalid API key or app disabled');
    }

    // Verify HMAC signature
    const body = request.body ? JSON.stringify(request.body) : '';
    const endpoint = request.originalUrl;
    const signaturePayload = `${endpoint}${timestamp}${body}`;

    const expectedSignature = createHmac('sha384', app.apiSecret)
      .update(signaturePayload)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Attach app to request for later use
    request.app = app;
    return true;
  }
}
