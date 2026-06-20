export interface StockQuote {
  symbol: string;
  price: number;
  previousClose: number;
}

export interface StockDataProvider {
  getQuote: (symbol: string) => Promise<StockQuote>;
}

export const STOCK_DATA_PROVIDER = Symbol('STOCK_DATA_PROVIDER');
