import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminGuard } from './guards/admin.guard';
import { HmacGuard } from './guards/hmac.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const expiresIn = config.get<string>('JWT_ACCESS_EXPIRATION', '45m');
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: expiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
          },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, AdminGuard, HmacGuard],
  exports: [AuthService, AdminGuard, HmacGuard, JwtModule],
})
export class AuthModule {}
