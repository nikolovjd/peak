import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { StockSummaryDto } from './dto/stock-summary.dto';
import { TrackSymbolDto } from './dto/track-symbol.dto';
import {
  FinnhubAuthError,
  FinnhubInvalidSymbolError,
} from './providers/finnhub-stock-provider';
import { STOCK_DATA_PROVIDER } from './providers/stock-data-provider';
import type { StockDataProvider } from './providers/stock-data-provider';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @Inject(STOCK_DATA_PROVIDER)
    private readonly stockDataProvider: StockDataProvider,
    private readonly prisma: PrismaService,
    private readonly configService: AppConfigService,
  ) {}

  async getStockSummary(symbol: string): Promise<StockSummaryDto> {
    const recentPrices = await this.prisma.stockPrice.findMany({
      where: { symbol },
      orderBy: { fetchedAt: 'desc' },
      take: this.configService.movingAverageWindow,
    });

    const [latest] = recentPrices;
    if (!latest) {
      throw new NotFoundException(`No price data found for ${symbol}`);
    }

    const movingAverage =
      recentPrices.reduce((sum, entry) => sum + entry.price, 0) /
      recentPrices.length;

    return {
      symbol,
      price: latest.price,
      lastUpdated: latest.fetchedAt,
      movingAverage,
    };
  }

  async startTracking(symbol: string): Promise<TrackSymbolDto> {
    const alreadyTracked = await this.prisma.trackedSymbol.findUnique({
      where: { symbol },
    });
    if (alreadyTracked) {
      return { symbol };
    }

    const quote = await this.fetchQuote(symbol);

    await this.prisma.trackedSymbol.create({ data: { symbol } });
    await this.prisma.stockPrice.create({
      data: { symbol, price: quote.price },
    });

    return { symbol };
  }

  @Cron('* * * * *')
  async pollStocksCron() {
    const trackedSymbols = await this.prisma.trackedSymbol.findMany();
    const priceRecords: { symbol: string; price: number }[] = [];

    for (
      let i = 0;
      i < trackedSymbols.length;
      i += this.configService.quoteFetchBatchSize
    ) {
      const batch = trackedSymbols.slice(
        i,
        i + this.configService.quoteFetchBatchSize,
      );
      const results = await Promise.allSettled(
        batch.map(({ symbol }) => this.stockDataProvider.getQuote(symbol)),
      );

      results.forEach((result, index) => {
        const { symbol } = batch[index];
        if (result.status === 'fulfilled') {
          priceRecords.push({ symbol, price: result.value.price });
        } else {
          this.logger.error(
            `Failed to fetch quote for ${symbol}`,
            result.reason,
          );
        }
      });
    }

    if (priceRecords.length > 0) {
      await this.prisma.stockPrice.createMany({ data: priceRecords });
    }
  }

  private async fetchQuote(symbol: string) {
    try {
      return await this.stockDataProvider.getQuote(symbol);
    } catch (error) {
      if (error instanceof FinnhubAuthError) {
        throw new ServiceUnavailableException(error.message);
      }
      if (error instanceof FinnhubInvalidSymbolError) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
