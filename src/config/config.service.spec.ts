import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './config.service';

describe('AppConfigService', () => {
  let configService: AppConfigService;
  let getOrThrow: jest.Mock;

  beforeEach(() => {
    getOrThrow = jest.fn();
    configService = new AppConfigService({
      getOrThrow,
    } as unknown as ConfigService);
  });

  it('reads DATABASE_URL for databaseUrl', () => {
    getOrThrow.mockReturnValue('postgresql://localhost/db');

    expect(configService.databaseUrl).toBe('postgresql://localhost/db');
    expect(getOrThrow).toHaveBeenCalledWith('DATABASE_URL');
  });
});
