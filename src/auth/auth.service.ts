import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateGithubUser(profile: {
    githubId: string;
    username: string;
    email: string;
    avatarUrl: string;
  }) {
    return this.usersService.createOrUpdate(profile);
  }

  async generateTokens(user: any) {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const access_token = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY'),
    });

    const refresh_token = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY'),
    });

    await this.usersService.updateRefreshToken(user.id, refresh_token);

    return { access_token, refresh_token };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);

      if (!user || user.refresh_token !== refreshToken) {
        throw new UnauthorizedException({
          status: 'error',
          message: 'Invalid refresh token',
        });
      }

      if (!user.is_active) {
        throw new ForbiddenException({
          status: 'error',
          message: 'Account is inactive',
        });
      }

      // Invalidate old token immediately
      await this.usersService.updateRefreshToken(user.id, null);

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Invalid or expired refresh token',
      });
    }
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
  }

  // For CLI PKCE flow
  generateCliTokens(user: any) {
    return this.generateTokens(user);
  }
}