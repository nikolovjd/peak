import { ApiProperty } from '@nestjs/swagger';

export class TrackSymbolDto {
  @ApiProperty({
    example: 'AAPL',
    description: 'Stock ticker symbol now being tracked',
  })
  symbol: string;
}
