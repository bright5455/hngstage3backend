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
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

 @Get('github')
  @UseGuards(AuthGuard('github'))
  @UseGuards(ThrottlerGuard)
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

  if (!code) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing code',
    });
  }

  if (!state) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing state',
    });
  }

  try {
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

    if (!tokenData.access_token) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid code or token exchange failed',
      });
    }

    const githubToken = tokenData.access_token;

    // Fetch user
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${githubToken}` },
    });

    const githubUser: any = await userRes.json();

    if (!githubUser?.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid GitHub user',
      });
    }

    const user = await this.authService.validateGithubUser({
      githubId: String(githubUser.id),
      username: githubUser.login,
      email: null,
      avatarUrl: githubUser.avatar_url,
      role: 'ANALYST',
    });

    const tokens = await this.authService.generateTokens(user);

    return res.json({
      status: 'success',
      ...tokens,
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: 'OAuth failed',
    });
  }
}

 @Post('refresh')
@HttpCode(200)
async refresh(@Body() body: any) {
  if (!body.refresh_token) {
    throw new UnauthorizedException('Refresh token required');
  }

  const tokens = await this.authService.refreshTokens(body.refresh_token);

  return {
    status: 'success',
    ...tokens,
  };
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