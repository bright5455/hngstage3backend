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

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

 @Get('github')
async githubLogin(
  @Query('cli') cli: string,
  @Res() res: Response,
) {
  const clientID = this.configService.get('GITHUB_CLIENT_ID');

  const callbackURL = encodeURIComponent(
    this.configService.get('GITHUB_CALLBACK_URL'),
  );

  const scope = 'user:email';
  const state = cli === 'true' ? 'cli' : 'web';

  return res.redirect(
    `https://github.com/login/oauth/authorize?client_id=${clientID}&redirect_uri=${callbackURL}&scope=${scope}&state=${state}`,
  );
}

  @Get('github/callback')
  async githubCallback(@Req() req: Request, @Res() res: Response) {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const isCli = state === 'cli';
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!code) {
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/index.html`,
      );
    }

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
      });

      const { access_token, refresh_token } =
        await this.authService.generateTokens(user);

      if (isCli) {
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
      return res.redirect(
        `${this.configService.get('FRONTEND_URL')}/index.html?error=auth_failed`,
      );
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