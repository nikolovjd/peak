import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FinnhubAuthError,
  FinnhubInvalidSymbolError,
} from './providers/finnhub-stock-provider';
import { STOCK_DATA_PROVIDER } from './providers/stock-data-provider';
import type { StockDataProvider } from './providers/stock-data-provider';
import { StockService } from './stock.service';

describe('StockService', () => {
  let service: StockService;
  let stockDataProvider: jest.Mocked<StockDataProvider>;
  let prisma: {
    stockPrice: {
      findMany: jest.Mock;
      create: jest.Mock;
      createMany: jest.Mock;
    };
    trackedSymbol: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      stockPrice: {
        findMany: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
      },
      trackedSymbol: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: STOCK_DATA_PROVIDER,
          useValue: { getQuote: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AppConfigService,
          useValue: { movingAverageWindow: 10, quoteFetchBatchSize: 20 },
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    stockDataProvider = module.get(STOCK_DATA_PROVIDER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStockSummary', () => {
    it('throws NotFoundException when no prices are recorded for the symbol', async () => {
      prisma.stockPrice.findMany.mockResolvedValue([]);

      await expect(service.getStockSummary('AAPL')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the latest price, last updated time, and moving average', async () => {
      const fetchedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.stockPrice.findMany.mockResolvedValue([
        { symbol: 'AAPL', price: 30, fetchedAt },
        { symbol: 'AAPL', price: 20, fetchedAt: new Date() },
        { symbol: 'AAPL', price: 10, fetchedAt: new Date() },
      ]);

      const summary = await service.getStockSummary('AAPL');

      expect(prisma.stockPrice.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { fetchedAt: 'desc' },
        take: 10,
      });
      expect(summary).toEqual({
        symbol: 'AAPL',
        price: 30,
        lastUpdated: fetchedAt,
        movingAverage: 20,
      });
    });
  });

  describe('startTracking', () => {
    it('tracks the symbol and records an initial price when not already tracked', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue(null);
      stockDataProvider.getQuote.mockResolvedValue({
        symbol: 'AAPL',
        price: 123.45,
        previousClose: 120,
      });

      const result = await service.startTracking('AAPL');

      expect(prisma.trackedSymbol.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
      expect(stockDataProvider.getQuote).toHaveBeenCalledWith('AAPL');
      expect(prisma.trackedSymbol.create).toHaveBeenCalledWith({
        data: { symbol: 'AAPL' },
      });
      expect(prisma.stockPrice.create).toHaveBeenCalledWith({
        data: { symbol: 'AAPL', price: 123.45 },
      });
      expect(result).toEqual({ symbol: 'AAPL' });
    });

    it('is idempotent when the symbol is already tracked', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue({ symbol: 'AAPL' });

      const result = await service.startTracking('AAPL');

      expect(stockDataProvider.getQuote).not.toHaveBeenCalled();
      expect(prisma.trackedSymbol.create).not.toHaveBeenCalled();
      expect(prisma.stockPrice.create).not.toHaveBeenCalled();
      expect(result).toEqual({ symbol: 'AAPL' });
    });

    it('maps an auth failure to ServiceUnavailableException without tracking the symbol', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue(null);
      stockDataProvider.getQuote.mockRejectedValue(new FinnhubAuthError());

      await expect(service.startTracking('AAPL')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.trackedSymbol.create).not.toHaveBeenCalled();
      expect(prisma.stockPrice.create).not.toHaveBeenCalled();
    });

    it('maps an invalid symbol to NotFoundException without tracking it', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue(null);
      stockDataProvider.getQuote.mockRejectedValue(
        new FinnhubInvalidSymbolError('ZZZZINVALID'),
      );

      await expect(service.startTracking('ZZZZINVALID')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.trackedSymbol.create).not.toHaveBeenCalled();
      expect(prisma.stockPrice.create).not.toHaveBeenCalled();
    });

    it('rethrows other errors as-is without tracking the symbol', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue(null);
      const error = new Error('boom');
      stockDataProvider.getQuote.mockRejectedValue(error);

      await expect(service.startTracking('AAPL')).rejects.toBe(error);
      expect(prisma.trackedSymbol.create).not.toHaveBeenCalled();
    });
  });

  describe('pollStocksCron', () => {
    it('does nothing when there are no tracked symbols', async () => {
      prisma.trackedSymbol.findMany.mockResolvedValue([]);

      await service.pollStocksCron();

      expect(stockDataProvider.getQuote).not.toHaveBeenCalled();
      expect(prisma.stockPrice.createMany).not.toHaveBeenCalled();
    });

    it('fetches quotes for all tracked symbols and batches the writes', async () => {
      prisma.trackedSymbol.findMany.mockResolvedValue([
        { symbol: 'AAPL' },
        { symbol: 'MSFT' },
      ]);
      stockDataProvider.getQuote.mockImplementation((symbol: string) =>
        Promise.resolve({
          symbol,
          price: symbol === 'AAPL' ? 100 : 200,
          previousClose: 0,
        }),
      );

      await service.pollStocksCron();

      expect(prisma.stockPrice.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.stockPrice.createMany).toHaveBeenCalledWith({
        data: [
          { symbol: 'AAPL', price: 100 },
          { symbol: 'MSFT', price: 200 },
        ],
      });
    });

    it('skips symbols whose quote fetch fails without aborting the rest', async () => {
      prisma.trackedSymbol.findMany.mockResolvedValue([
        { symbol: 'AAPL' },
        { symbol: 'MSFT' },
      ]);
      stockDataProvider.getQuote.mockImplementation((symbol: string) => {
        if (symbol === 'AAPL') {
          return Promise.reject(new Error('rate limited'));
        }
        return Promise.resolve({ symbol, price: 200, previousClose: 0 });
      });

      await service.pollStocksCron();

      expect(prisma.stockPrice.createMany).toHaveBeenCalledWith({
        data: [{ symbol: 'MSFT', price: 200 }],
      });
    });
  });
});
