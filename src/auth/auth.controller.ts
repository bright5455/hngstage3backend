import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Throttle } from '@nestjs/throttler';

// In-memory store for PKCE state (use Redis in production)
const pkceStore = new Map<string, { codeVerifier: string; source: string }>();

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('github')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  async githubLogin(
    @Query('cli') cli: string,
    @Query('code_challenge') codeChallenge: string,
    @Query('state') clientState: string,
    @Res() res: Response,
  ) {
    const clientID = this.configService.get('GITHUB_CLIENT_ID');
    const callbackURL = encodeURIComponent(
      this.configService.get('GITHUB_CALLBACK_URL'),
    );
    const scope = 'user:email';

    // Generate state for CSRF protection
    const state = clientState ?? crypto.randomBytes(16).toString('hex');
    const source = cli === 'true' ? 'cli' : 'web';

    // Store state with source
    pkceStore.set(state, {
      codeVerifier: codeChallenge ?? '',
      source,
    });

    // Clean up old states after 10 minutes
    setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

    return res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${clientID}&redirect_uri=${callbackURL}&scope=${scope}&state=${state}`,
    );
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const isProduction =
      this.configService.get('NODE_ENV') === 'production';

    // Validate state
    if (!state || !pkceStore.has(state)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or missing state parameter',
      });
    }

    // Validate code
    if (!code) {
      pkceStore.delete(state);
      return res.status(400).json({
        status: 'error',
        message: 'Missing authorization code',
      });
    }

    const { source } = pkceStore.get(state);
    pkceStore.delete(state);

    try {
      // Exchange code for GitHub token
      const tokenRes = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: this.configService.get('GITHUB_CLIENT_ID'),
            client_secret: this.configService.get('GITHUB_CLIENT_SECRET'),
            code,
          }),
        },
      );

      const tokenData: any = await tokenRes.json();

      if (tokenData.error || !tokenData.access_token) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid authorization code',
        });
      }

      const githubToken = tokenData.access_token;

      // Get user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/json',
        },
      });
      const githubUser: any = await userRes.json();

      // Get emails
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/json',
        },
      });
      const emails: any[] = await emailRes.json();
      const primaryEmail =
        emails.find((e: any) => e.primary)?.email ?? null;

      // Create or update user
      const user = await this.authService.validateGithubUser({
        githubId: String(githubUser.id),
        username: githubUser.login,
        email: primaryEmail,
        avatarUrl: githubUser.avatar_url,
        role: 'ANALYST',
      });

      const { access_token, refresh_token } =
        await this.authService.generateTokens(user);

      if (source === 'cli') {
        return res.redirect(
          `http://localhost:9876/callback?access_token=${access_token}&refresh_token=${refresh_token}&username=${user.username}`,
        );
      }

      // Web flow — set HTTP-only cookies
      res.cookie('access_token', access_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 3 * 60 * 1000,
      });

      res.cookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
      });

      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/dashboard.html`,
      );
    } catch (err) {
      return res.status(500).json({
        status: 'error',
        message: 'Authentication failed',
      });
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const refreshToken =
      body.refresh_token ?? req.cookies?.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Refresh token required',
      });
    }

    const tokens = await this.authService.refreshTokens(refreshToken);
    const isProduction =
      this.configService.get('NODE_ENV') === 'production';

    if (req.cookies?.refresh_token) {
      res.cookie('access_token', tokens.access_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 3 * 60 * 1000,
      });
      res.cookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000,
      });
    }

    return res.json({
      status: 'success',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res() res: Response) {
    await this.authService.logout(req.user.id);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.json({
      status: 'success',
      message: 'Logged out successfully',
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const user = req.user;
    return {
      status: 'success',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      },
    };
  }
}