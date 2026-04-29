import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('GITHUB_CLIENT_ID'),
      clientSecret: configService.get('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.get('GITHUB_CALLBACK_URL'),
      scope: ['user:email'],
      passReqToCallback: true, // ADD THIS
    });
  }

  async validate(
  req: any,
  accessToken: string,
  refreshToken: string,
  profile: any,
): Promise<any> {
  const user = await this.authService.validateGithubUser({
    githubId: profile.id,
    username: profile.username,
    email: profile.emails?.[0]?.value ?? null,
    avatarUrl: profile.photos?.[0]?.value ?? null,
    role: 'ANALYST',
  });

  return Object.assign({}, user, { oauthState: req.query.state ?? '' });
}
}