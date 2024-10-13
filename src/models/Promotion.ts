import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";
import { Product } from "./Product";

export class Promotion extends Model {
  declare promotionId: string;
  declare promotionType: string;
  declare activeStartDate: Date;
  declare activeEndDate: Date;
  declare seoBrandList: string[];
  declare linkedTechnicalArticleNumber: string;
  declare linkedCommercialArticleNumber: string;
}

Promotion.init(
  {
    promotionId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    promotionType: DataTypes.STRING,
    activeStartDate: DataTypes.DATEONLY,
    activeEndDate: DataTypes.DATEONLY,
    //benefit: DataTypes.JSON,
    seoBrandList: DataTypes.JSON,
    linkedTechnicalArticleNumber: DataTypes.JSON,
    linkedCommercialArticleNumber: DataTypes.JSON,
  },
  { sequelize, modelName: "promotion" }
);
