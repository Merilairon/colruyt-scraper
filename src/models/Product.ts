import { Price } from "./Price";

export class Product {
  commercialArticleNumber: string;
  technicalArticleNumber: string;
  seoBrand?: string;
  name: string;
  longName?: string;
  content?: string;
  price?: Price;
  topCategoryName: string;
  squareImage?: string;
}
