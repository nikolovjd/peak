import { Module } from '@nestjs/common';
import { FinnhubStockProvider } from './providers/finnhub-stock-provider';
import { STOCK_DATA_PROVIDER } from './providers/stock-data-provider';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [
    StockService,
    FinnhubStockProvider,
    {
      provide: STOCK_DATA_PROVIDER,
      useExisting: FinnhubStockProvider,
    },
  ],
})
export class StockModule {}
