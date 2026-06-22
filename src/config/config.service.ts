import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get databaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  get finnhubApiKey(): string {
    return this.configService.getOrThrow<string>('FINNHUB_API_KEY');
  }

  get movingAverageWindow(): number {
    return this.configService.get<number>('MOVING_AVERAGE_WINDOW', 10);
  }

  get quoteFetchBatchSize(): number {
    return this.configService.get<number>('QUOTE_FETCH_BATCH_SIZE', 20);
  }
}
