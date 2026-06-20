import { Test, TestingModule } from '@nestjs/testing';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

describe('StockController', () => {
  let controller: StockController;
  let stockService: { getStockSummary: jest.Mock; startTracking: jest.Mock };

  beforeEach(async () => {
    stockService = {
      getStockSummary: jest.fn(),
      startTracking: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        {
          provide: StockService,
          useValue: stockService,
        },
      ],
    }).compile();

    controller = module.get<StockController>(StockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStock', () => {
    it('delegates to StockService with the uppercased symbol', async () => {
      const summary = {
        symbol: 'AAPL',
        price: 150,
        lastUpdated: new Date(),
        movingAverage: 148,
      };
      stockService.getStockSummary.mockResolvedValue(summary);

      const result = await controller.getStock('aapl');

      expect(stockService.getStockSummary).toHaveBeenCalledWith('AAPL');
      expect(result).toBe(summary);
    });
  });

  describe('trackStock', () => {
    it('delegates to StockService with the uppercased symbol', async () => {
      stockService.startTracking.mockResolvedValue({ symbol: 'AAPL' });

      const result = await controller.trackStock('aapl');

      expect(stockService.startTracking).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual({ symbol: 'AAPL' });
    });
  });
});
