declare module 'finnhub' {
  export interface FinnhubQuoteResponse {
    c: number;
    pc: number;
  }

  export interface FinnhubApiError {
    status?: number;
    error?: string;
  }

  export class DefaultApi {
    constructor(apiKey: string);
    quote(
      symbol: string,
      callback: (
        error: Error | FinnhubApiError | null,
        data: FinnhubQuoteResponse,
        response: { status?: number } | undefined,
      ) => void,
    ): void;
  }
}
