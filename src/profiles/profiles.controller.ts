import {
  Controller, Get, Post, Delete, Param, Body,
  Query, HttpCode, HttpStatus, HttpException,
  UseGuards, Req, Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ApiVersionGuard } from '../auth/api-version.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/profiles')
@UseGuards(JwtAuthGuard, ApiVersionGuard, RolesGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() body: any) {
    const { name } = body;
    if (!name || name === '') {
      throw new HttpException(
        { status: 'error', message: 'Missing or empty name' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (typeof name !== 'string') {
      throw new HttpException(
        { status: 'error', message: 'name must be a string' },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.profilesService.create(name);
  }

  @Get('export')
  @Roles('admin', 'analyst')
  async export(@Query() query: any, @Res() res: Response) {
    const csv = await this.profilesService.exportCsv(query);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="profiles_${timestamp}.csv"`,
    );
    return res.send(csv);
  }

  @Get('search')
  @Roles('admin', 'analyst')
  async search(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Req() req?: Request,
  ) {
    if (!q || q.trim() === '') {
      throw new HttpException(
        { status: 'error', message: 'Missing or empty query' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const baseUrl = `${req.protocol}://${req.get('host')}/api/profiles/search`;
    return this.profilesService.search(q, page, limit, baseUrl);
  }

  @Get()
  @Roles('admin', 'analyst')
  async findAll(@Query() query: any, @Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}/api/profiles`;
    return this.profilesService.findAll(query, baseUrl);
  }

  @Get(':id')
  @Roles('admin', 'analyst')
  async findOne(@Param('id') id: string) {
    return this.profilesService.findOne(id);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.profilesService.remove(id);
  }
}