import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { Profile } from './profiles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Profile]), HttpModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}