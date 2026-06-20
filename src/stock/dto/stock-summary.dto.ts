import { ApiProperty } from '@nestjs/swagger';

export class StockSummaryDto {
  @ApiProperty({ example: 'AAPL', description: 'Stock ticker symbol' })
  symbol: string;

  @ApiProperty({ example: 196.34, description: 'Most recently fetched price' })
  price: number;

  @ApiProperty({
    example: '2026-06-19T21:54:00.000Z',
    description: 'Timestamp the price was last fetched',
  })
  lastUpdated: Date;

  @ApiProperty({
    example: 195.12,
    description: 'Simple moving average over the most recent fetched prices',
  })
  movingAverage: number;
}
