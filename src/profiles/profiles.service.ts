import {
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { uuidv7 } from 'uuidv7';
import { Profile } from './profiles.entity';
import { createObjectCsvStringifier } from 'csv-writer';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly httpService: HttpService,
  ) {}

  private getAgeGroup(age: number): string {
    if (age <= 12) return 'child';
    if (age <= 19) return 'teenager';
    if (age <= 59) return 'adult';
    return 'senior';
  }

  async create(name: string) {
    const normalized = name.trim().toLowerCase();

    const existing = await this.profileRepo.findOne({
      where: { name: normalized },
    });

    if (existing) {
      return {
        status: 'success',
        message: 'Profile already exists',
        data: existing,
      };
    }

    let genderData: any, agifyData: any, nationalizeData: any;

    try {
      const [genderRes, agifyRes, nationalizeRes] = await Promise.all([
        firstValueFrom(
          this.httpService.get('https://api.genderize.io', {
            params: { name: normalized },
          }),
        ),
        firstValueFrom(
          this.httpService.get('https://api.agify.io', {
            params: { name: normalized },
          }),
        ),
        firstValueFrom(
          this.httpService.get('https://api.nationalize.io', {
            params: { name: normalized },
          }),
        ),
      ]);

      genderData = genderRes.data;
      agifyData = agifyRes.data;
      nationalizeData = nationalizeRes.data;
    } catch {
      throw new HttpException(
        { status: 'error', message: 'Upstream or server failure' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (genderData.gender === null || genderData.count === 0) {
      throw new HttpException(
        { status: 'error', message: 'Genderize returned an invalid response' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (agifyData.age === null) {
      throw new HttpException(
        { status: 'error', message: 'Agify returned an invalid response' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!nationalizeData.country || nationalizeData.country.length === 0) {
      throw new HttpException(
        { status: 'error', message: 'Nationalize returned an invalid response' },
        HttpStatus.BAD_GATEWAY,
      );
    }

    const topCountry = nationalizeData.country.reduce(
      (best: any, current: any) =>
        current.probability > best.probability ? current : best,
      nationalizeData.country[0],
    );

    const countryNames: Record<string, string> = {
      NG: 'Nigeria', US: 'United States', GB: 'United Kingdom',
      KE: 'Kenya', GH: 'Ghana', ZA: 'South Africa', TZ: 'Tanzania',
      ET: 'Ethiopia', UG: 'Uganda', RW: 'Rwanda', CM: 'Cameroon',
      SN: 'Senegal', ML: 'Mali', BJ: 'Benin', CD: 'DR Congo',
      AO: 'Angola', MZ: 'Mozambique', ZM: 'Zambia', ZW: 'Zimbabwe',
      SD: 'Sudan', MA: 'Morocco', TN: 'Tunisia', EG: 'Egypt',
      IN: 'India', BR: 'Brazil', FR: 'France', AU: 'Australia',
      JP: 'Japan', DE: 'Germany', CA: 'Canada', GA: 'Gabon',
      NA: 'Namibia', MW: 'Malawi', SO: 'Somalia', ER: 'Eritrea',
      GM: 'Gambia', NE: 'Niger', MG: 'Madagascar', CI: "Côte d'Ivoire",
    };

    const profile = this.profileRepo.create({
      id: uuidv7(),
      name: normalized,
      gender: genderData.gender,
      gender_probability: genderData.probability,
      age: agifyData.age,
      age_group: this.getAgeGroup(agifyData.age),
      country_id: topCountry.country_id,
      country_name: countryNames[topCountry.country_id] ?? topCountry.country_id,
      country_probability: topCountry.probability,
    });

    const saved = await this.profileRepo.save(profile);
    return { status: 'success', data: saved };
  }

  async findAll(query: any, baseUrl: string) {
    const allowedSortBy = ['age', 'created_at', 'gender_probability'];
    const allowedOrder = ['asc', 'desc'];

    if (query.sort_by && !allowedSortBy.includes(query.sort_by)) {
      throw new HttpException(
        { status: 'error', message: 'Invalid query parameters' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (query.order && !allowedOrder.includes(query.order.toLowerCase())) {
      throw new HttpException(
        { status: 'error', message: 'Invalid query parameters' },
        HttpStatus.BAD_REQUEST,
      );
    }

    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit ?? '10', 10) || 10));
    const skip = (page - 1) * limit;

    const qb = this.profileRepo.createQueryBuilder('profile');

    if (query.gender) {
      qb.andWhere('LOWER(profile.gender) = LOWER(:gender)', { gender: query.gender });
    }
    if (query.age_group) {
      qb.andWhere('LOWER(profile.age_group) = LOWER(:age_group)', { age_group: query.age_group });
    }
    if (query.country_id) {
      qb.andWhere('LOWER(profile.country_id) = LOWER(:country_id)', { country_id: query.country_id });
    }
    if (query.min_age) {
      qb.andWhere('profile.age >= :min_age', { min_age: parseInt(query.min_age, 10) });
    }
    if (query.max_age) {
      qb.andWhere('profile.age <= :max_age', { max_age: parseInt(query.max_age, 10) });
    }
    if (query.min_gender_probability) {
      qb.andWhere('profile.gender_probability >= :mgp', {
        mgp: parseFloat(query.min_gender_probability),
      });
    }
    if (query.min_country_probability) {
      qb.andWhere('profile.country_probability >= :mcp', {
        mcp: parseFloat(query.min_country_probability),
      });
    }

    const sortField = query.sort_by ?? 'created_at';
    const sortOrder = (query.order?.toUpperCase() ?? 'ASC') as 'ASC' | 'DESC';
    qb.orderBy(`profile.${sortField}`, sortOrder);
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    const total_pages = Math.ceil(total / limit);

    const buildUrl = (p: number) => {
      const params = new URLSearchParams({ ...query, page: String(p), limit: String(limit) });
      return `${baseUrl}?${params.toString()}`;
    };

    return {
      status: 'success',
      page,
      limit,
      total,
      total_pages,
      links: {
        self: buildUrl(page),
        next: page < total_pages ? buildUrl(page + 1) : null,
        prev: page > 1 ? buildUrl(page - 1) : null,
      },
      data,
    };
  }

  async search(q: string, page?: string, limit?: string, baseUrl?: string) {
    const filters = this.parseNaturalLanguage(q);
    if (!filters) {
      throw new HttpException(
        { status: 'error', message: 'Unable to interpret query' },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.findAll({ ...filters, page, limit }, baseUrl ?? '/api/profiles/search');
  }

  private parseNaturalLanguage(q: string): Record<string, string> | null {
    const lower = q.toLowerCase().trim();
    const filters: Record<string, string> = {};
    let matched = false;

    if (/\bmales?\b/.test(lower)) { filters.gender = 'male'; matched = true; }
    else if (/\bfemales?\b|\bwomen\b|\bwoman\b|\bgirls?\b/.test(lower)) { filters.gender = 'female'; matched = true; }

    if (/\bchildren\b|\bchild\b|\bkids?\b/.test(lower)) { filters.age_group = 'child'; matched = true; }
    else if (/\bteenagers?\b|\bteens?\b/.test(lower)) { filters.age_group = 'teenager'; matched = true; }
    else if (/\badults?\b/.test(lower)) { filters.age_group = 'adult'; matched = true; }
    else if (/\bseniors?\b|\belderly\b|\bold\b/.test(lower)) { filters.age_group = 'senior'; matched = true; }

    if (/\byoung\b/.test(lower)) { filters.min_age = '16'; filters.max_age = '24'; matched = true; }

    const aboveMatch = lower.match(/(?:above|over|older than)\s+(\d+)/);
    if (aboveMatch) { filters.min_age = aboveMatch[1]; matched = true; }

    const belowMatch = lower.match(/(?:below|under|younger than)\s+(\d+)/);
    if (belowMatch) { filters.max_age = belowMatch[1]; matched = true; }

    const betweenMatch = lower.match(/between\s+(\d+)\s+and\s+(\d+)/);
    if (betweenMatch) { filters.min_age = betweenMatch[1]; filters.max_age = betweenMatch[2]; matched = true; }

    const countryMap: Record<string, string> = {
      nigeria: 'NG', kenya: 'KE', ghana: 'GH', 'south africa': 'ZA',
      tanzania: 'TZ', ethiopia: 'ET', uganda: 'UG', rwanda: 'RW',
      cameroon: 'CM', senegal: 'SN', mali: 'ML', benin: 'BJ',
      'dr congo': 'CD', angola: 'AO', mozambique: 'MZ', zambia: 'ZM',
      zimbabwe: 'ZW', sudan: 'SD', morocco: 'MA', tunisia: 'TN',
      egypt: 'EG', india: 'IN', brazil: 'BR', france: 'FR',
      australia: 'AU', japan: 'JP', germany: 'DE', canada: 'CA',
      'united states': 'US', usa: 'US', 'united kingdom': 'GB', uk: 'GB',
      gabon: 'GA', namibia: 'NA', malawi: 'MW', somalia: 'SO',
      eritrea: 'ER', gambia: 'GM', niger: 'NE', madagascar: 'MG',
      'ivory coast': 'CI',
    };

    for (const [countryName, code] of Object.entries(countryMap)) {
      const regex = new RegExp(
        `(?:from|in|of)\\s+${countryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      );
      if (regex.test(lower)) { filters.country_id = code; matched = true; break; }
    }

    return matched ? filters : null;
  }

  async exportCsv(query: any): Promise<string> {
    const qb = this.profileRepo.createQueryBuilder('profile');

    if (query.gender) qb.andWhere('LOWER(profile.gender) = LOWER(:gender)', { gender: query.gender });
    if (query.age_group) qb.andWhere('LOWER(profile.age_group) = LOWER(:age_group)', { age_group: query.age_group });
    if (query.country_id) qb.andWhere('LOWER(profile.country_id) = LOWER(:country_id)', { country_id: query.country_id });
    if (query.min_age) qb.andWhere('profile.age >= :min_age', { min_age: parseInt(query.min_age, 10) });
    if (query.max_age) qb.andWhere('profile.age <= :max_age', { max_age: parseInt(query.max_age, 10) });

    const sortField = query.sort_by ?? 'created_at';
    const sortOrder = (query.order?.toUpperCase() ?? 'ASC') as 'ASC' | 'DESC';
    qb.orderBy(`profile.${sortField}`, sortOrder);

    const profiles = await qb.getMany();

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'id', title: 'id' },
        { id: 'name', title: 'name' },
        { id: 'gender', title: 'gender' },
        { id: 'gender_probability', title: 'gender_probability' },
        { id: 'age', title: 'age' },
        { id: 'age_group', title: 'age_group' },
        { id: 'country_id', title: 'country_id' },
        { id: 'country_name', title: 'country_name' },
        { id: 'country_probability', title: 'country_probability' },
        { id: 'created_at', title: 'created_at' },
      ],
    });

    return (
      csvStringifier.getHeaderString() +
      csvStringifier.stringifyRecords(profiles)
    );
  }

  async findOne(id: string) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException({ status: 'error', message: 'Profile not found' });
    }
    return { status: 'success', data: profile };
  }

  async remove(id: string) {
    const profile = await this.profileRepo.findOne({ where: { id } });
    if (!profile) {
      throw new NotFoundException({ status: 'error', message: 'Profile not found' });
    }
    await this.profileRepo.delete(id);
  }
}