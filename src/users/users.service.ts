import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { uuidv7 } from 'uuidv7';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findByGithubId(githubId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { github_id: githubId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async createOrUpdate(profile: {
    githubId: string;
    username: string;
    email: string;
    avatarUrl: string;
  }): Promise<User> {
    let user = await this.findByGithubId(profile.githubId);

    if (!user) {
      user = this.userRepo.create({
        id: uuidv7(),
        github_id: profile.githubId,
        username: profile.username,
        email: profile.email,
        avatar_url: profile.avatarUrl,
        role: 'analyst',
        is_active: true,
      });
    } else {
      user.username = profile.username;
      user.email = profile.email;
      user.avatar_url = profile.avatarUrl;
    }

    user.last_login_at = new Date();
    return this.userRepo.save(user);
  }

  async updateRefreshToken(userId: string, token: string | null) {
    await this.userRepo.update(userId, { refresh_token: token });
  }

}