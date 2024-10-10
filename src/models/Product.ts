import { DataTypes, Model } from "sequelize";
import { Price } from "./Price";
import { sequelize } from "../database";

export class Product extends Model {
  declare productId: string;
  declare name: string;
  declare LongName?: string;
  declare ShortName?: string;
  declare content?: string;
  declare squareImage?: string;
  declare fullImage?: string;
  declare thumbNail?: string;
  declare commercialArticleNumber: string;
  declare technicalArticleNumber: string;
  declare AlcoholVolume?: string;
  declare CountryOfOrigin?: string;
  declare FicCode?: string;
  declare IsBiffe?: boolean;
  declare IsBio?: boolean;
  declare IsExclusivelySoldInLuxembourg?: boolean;
  declare IsNew?: boolean;
  declare IsPrivateLabel?: boolean;
  declare IsWeightArticle?: boolean;
  declare OrderUnit?: string;
  declare RecentQuanityOfStockUnits?: string;
  declare WeightconversionFactor?: string;
  declare brand?: string;
  declare businessDomain?: string;
  declare isAvailable?: boolean;
  declare seoBrand?: string;
  declare topCategoryId: string;
  declare topCategoryName: string;
  declare walkRouteSequenceNumber: number;
}

Product.init(
  {
    productId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: DataTypes.STRING,
    LongName: DataTypes.STRING,
    ShortName: DataTypes.STRING,
    content: DataTypes.STRING,
    squareImage: DataTypes.STRING,
    fullImage: DataTypes.STRING,
    thumbNail: DataTypes.STRING,
    commercialArticleNumber: DataTypes.STRING,
    technicalArticleNumber: {
      type: DataTypes.STRING,
      unique: true,
    },
    AlcoholVolume: DataTypes.STRING,
    CountryOfOrigin: DataTypes.STRING,
    FicCode: DataTypes.STRING,
    IsBiffe: DataTypes.BOOLEAN,
    IsBio: DataTypes.BOOLEAN,
    IsExclusivelySoldInLuxembourg: DataTypes.BOOLEAN,
    IsNew: DataTypes.BOOLEAN,
    IsPrivateLabel: DataTypes.BOOLEAN,
    IsWeightArticle: DataTypes.BOOLEAN,
    OrderUnit: DataTypes.STRING,
    RecentQuanityOfStockUnits: DataTypes.STRING,
    WeightconversionFactor: DataTypes.STRING,
    brand: DataTypes.STRING,
    businessDomain: DataTypes.STRING,
    isAvailable: DataTypes.BOOLEAN,
    seoBrand: DataTypes.STRING,
    topCategoryId: DataTypes.STRING,
    topCategoryName: DataTypes.STRING,
    walkRouteSequenceNumber: DataTypes.INTEGER,
  },
  {
    sequelize,
    modelName: "product",
    indexes: [{ unique: true, fields: ["technicalArticleNumber"] }],
  }
);
