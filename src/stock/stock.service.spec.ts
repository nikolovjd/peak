import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { FinnhubAuthError } from './providers/finnhub-stock-provider';
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
    trackedSymbol: { findMany: jest.Mock; upsert: jest.Mock };
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
        upsert: jest.fn(),
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
    it('upserts the tracked symbol and records an initial price', async () => {
      stockDataProvider.getQuote.mockResolvedValue({
        symbol: 'AAPL',
        price: 123.45,
        previousClose: 120,
      });

      const result = await service.startTracking('AAPL');

      expect(prisma.trackedSymbol.upsert).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        create: { symbol: 'AAPL' },
        update: {},
      });
      expect(stockDataProvider.getQuote).toHaveBeenCalledWith('AAPL');
      expect(prisma.stockPrice.create).toHaveBeenCalledWith({
        data: { symbol: 'AAPL', price: 123.45 },
      });
      expect(result).toEqual({ symbol: 'AAPL' });
    });

    it('still upserts the tracked symbol, then maps an auth failure to ServiceUnavailableException', async () => {
      stockDataProvider.getQuote.mockRejectedValue(new FinnhubAuthError());

      await expect(service.startTracking('AAPL')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.trackedSymbol.upsert).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        create: { symbol: 'AAPL' },
        update: {},
      });
    });

    it('rethrows non-auth errors as-is', async () => {
      const error = new Error('boom');
      stockDataProvider.getQuote.mockRejectedValue(error);

      await expect(service.startTracking('AAPL')).rejects.toBe(error);
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
