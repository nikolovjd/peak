import * as finnhub from 'finnhub';
import { AppConfigService } from '../../config/config.service';
import {
  FinnhubAuthError,
  FinnhubInvalidSymbolError,
  FinnhubStockProvider,
} from './finnhub-stock-provider';

jest.mock('finnhub');

const MockedDefaultApi = finnhub.DefaultApi as jest.MockedClass<
  typeof finnhub.DefaultApi
>;

describe('FinnhubStockProvider', () => {
  let provider: FinnhubStockProvider;
  let quoteMock: jest.Mock;

  beforeEach(() => {
    quoteMock = jest.fn();
    MockedDefaultApi.mockImplementation(() => ({ quote: quoteMock }));

    const configService = {
      finnhubApiKey: 'test-api-key',
    } as AppConfigService;

    provider = new FinnhubStockProvider(configService);
  });

  it('constructs the finnhub client with the configured api key', () => {
    expect(MockedDefaultApi).toHaveBeenCalledWith('test-api-key');
  });

  it('resolves with a mapped quote on success', async () => {
    quoteMock.mockImplementation(
      (
        _symbol: string,
        callback: (
          error: Error | null,
          data: { c: number; pc: number },
        ) => void,
      ) => {
        callback(null, { c: 150.5, pc: 148.2 });
      },
    );

    const quote = await provider.getQuote('AAPL');

    expect(quoteMock).toHaveBeenCalledWith('AAPL', expect.any(Function));
    expect(quote).toEqual({
      symbol: 'AAPL',
      price: 150.5,
      previousClose: 148.2,
    });
  });

  it('rejects when the finnhub client returns an error', async () => {
    const apiError = new Error('rate limited');
    quoteMock.mockImplementation(
      (
        _symbol: string,
        callback: (
          error: Error | null,
          data: { c: number; pc: number },
        ) => void,
      ) => {
        callback(apiError, { c: 0, pc: 0 });
      },
    );

    await expect(provider.getQuote('AAPL')).rejects.toBe(apiError);
  });

  it('rejects with a FinnhubAuthError when the api key is invalid', async () => {
    quoteMock.mockImplementation(
      (
        _symbol: string,
        callback: (
          error: { error: string } | null,
          data: { c: number; pc: number },
          response: { status: number },
        ) => void,
      ) => {
        callback(
          { error: 'Invalid API key.' },
          { c: 0, pc: 0 },
          { status: 401 },
        );
      },
    );

    await expect(provider.getQuote('AAPL')).rejects.toBeInstanceOf(
      FinnhubAuthError,
    );
  });

  it('rejects with a FinnhubInvalidSymbolError when finnhub returns an all-zero quote', async () => {
    quoteMock.mockImplementation(
      (
        _symbol: string,
        callback: (
          error: null,
          data: { c: number; pc: number; t: number },
        ) => void,
      ) => {
        callback(null, { c: 0, pc: 0, t: 0 });
      },
    );

    await expect(provider.getQuote('ZZZZINVALID')).rejects.toBeInstanceOf(
      FinnhubInvalidSymbolError,
    );
  });

  it('wraps a non-Error rejection in a generic Error', async () => {
    quoteMock.mockImplementation(
      (
        _symbol: string,
        callback: (
          error: { error: string } | null,
          data: { c: number; pc: number },
          response: { status: number } | undefined,
        ) => void,
      ) => {
        callback({ error: 'rate limited' }, { c: 0, pc: 0 }, undefined);
      },
    );

    await expect(provider.getQuote('AAPL')).rejects.toThrow('rate limited');
  });
});
