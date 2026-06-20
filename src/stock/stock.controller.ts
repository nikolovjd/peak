import { Controller, Get, Param, Put } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { StockSummaryDto } from './dto/stock-summary.dto';
import { TrackSymbolDto } from './dto/track-symbol.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get(':symbol')
  @ApiOperation({
    summary:
      'Get the latest price, last updated time, and moving average for a symbol',
  })
  @ApiParam({
    name: 'symbol',
    example: 'AAPL',
    description: 'Stock ticker symbol',
  })
  @ApiOkResponse({ type: StockSummaryDto })
  @ApiNotFoundResponse({
    description: 'No price data has been recorded for this symbol',
  })
  getStock(@Param('symbol') symbol: string): Promise<StockSummaryDto> {
    return this.stockService.getStockSummary(symbol.toUpperCase());
  }

  @Put(':symbol')
  @ApiOperation({ summary: 'Start periodic price checks for a symbol' })
  @ApiParam({
    name: 'symbol',
    example: 'AAPL',
    description: 'Stock ticker symbol',
  })
  @ApiOkResponse({ type: TrackSymbolDto })
  trackStock(@Param('symbol') symbol: string): Promise<TrackSymbolDto> {
    return this.stockService.startTracking(symbol.toUpperCase());
  }
}
