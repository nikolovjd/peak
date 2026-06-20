import { Injectable } from '@nestjs/common';
import * as finnhub from 'finnhub';
import { AppConfigService } from '../../config/config.service';
import { StockDataProvider, StockQuote } from './stock-data-provider';

export class FinnhubAuthError extends Error {
  constructor(message = 'Finnhub rejected the configured API key') {
    super(message);
    this.name = 'FinnhubAuthError';
  }
}

export class FinnhubInvalidSymbolError extends Error {
  constructor(symbol: string) {
    super(`Unknown stock symbol: ${symbol}`);
    this.name = 'FinnhubInvalidSymbolError';
  }
}

@Injectable()
export class FinnhubStockProvider implements StockDataProvider {
  private readonly client: finnhub.DefaultApi;

  constructor(configService: AppConfigService) {
    this.client = new finnhub.DefaultApi(configService.finnhubApiKey);
  }

  getQuote(symbol: string): Promise<StockQuote> {
    return new Promise((resolve, reject) => {
      this.client.quote(symbol, (error, data, response) => {
        if (error) {
          reject(this.toError(error, response?.status));
          return;
        }
        if (data.c === 0 && data.pc === 0 && data.t === 0) {
          reject(new FinnhubInvalidSymbolError(symbol));
          return;
        }
        resolve({
          symbol,
          price: data.c,
          previousClose: data.pc,
        });
      });
    });
  }

  private toError(
    error: Error | finnhub.FinnhubApiError,
    status: number | undefined,
  ): Error {
    if (status === 401 || status === 403) {
      return new FinnhubAuthError();
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(error.error ?? 'Finnhub request failed');
  }
}
