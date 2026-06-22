import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { STOCK_DATA_PROVIDER } from '../src/stock/providers/stock-data-provider';

describe('Stock (e2e)', () => {
  let app: INestApplication<App>;
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
  let stockDataProvider: { getQuote: jest.Mock };

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
    stockDataProvider = { getQuote: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(STOCK_DATA_PROVIDER)
      .useValue(stockDataProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /stock/:symbol', () => {
    it('returns the stock summary for a tracked symbol', async () => {
      const fetchedAt = new Date('2026-01-01T00:00:00.000Z');
      prisma.stockPrice.findMany.mockResolvedValue([
        { symbol: 'AAPL', price: 150, fetchedAt },
      ]);

      const response = await request(app.getHttpServer())
        .get('/stock/aapl')
        .expect(200);

      expect(prisma.stockPrice.findMany).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        orderBy: { fetchedAt: 'desc' },
        take: 10,
      });
      expect(response.body).toEqual({
        symbol: 'AAPL',
        price: 150,
        lastUpdated: fetchedAt.toISOString(),
        movingAverage: 150,
      });
    });

    it('returns 404 when no price data has been recorded for the symbol', async () => {
      prisma.stockPrice.findMany.mockResolvedValue([]);

      await request(app.getHttpServer()).get('/stock/zzzz').expect(404);
    });
  });

  describe('PUT /stock/:symbol', () => {
    it('starts tracking a symbol', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue(null);
      stockDataProvider.getQuote.mockResolvedValue({
        symbol: 'AAPL',
        price: 123.45,
        previousClose: 120,
      });

      const response = await request(app.getHttpServer())
        .put('/stock/aapl')
        .expect(200);

      expect(stockDataProvider.getQuote).toHaveBeenCalledWith('AAPL');
      expect(prisma.trackedSymbol.create).toHaveBeenCalledWith({
        data: { symbol: 'AAPL' },
      });
      expect(response.body).toEqual({ symbol: 'AAPL' });
    });

    it('is idempotent when the symbol is already tracked', async () => {
      prisma.trackedSymbol.findUnique.mockResolvedValue({ symbol: 'AAPL' });

      const response = await request(app.getHttpServer())
        .put('/stock/aapl')
        .expect(200);

      expect(stockDataProvider.getQuote).not.toHaveBeenCalled();
      expect(prisma.trackedSymbol.create).not.toHaveBeenCalled();
      expect(response.body).toEqual({ symbol: 'AAPL' });
    });
  });
});
