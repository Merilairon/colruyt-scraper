import { Price } from "./Price";
import { Product } from "./Product";

export class PriceDifference {
  longName: string;
  priceChange: number;
  priceChangePercentage: number;
  involvesPromotion: boolean;
  oldPrice: Price;
  price: Price;
  product: Product;
}
