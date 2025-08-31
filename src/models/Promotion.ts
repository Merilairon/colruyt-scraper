import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";
import { Product } from "./Product";
import { PromotionProduct } from "./PromotionProduct";
import { Benefit } from "./Benefit";

export class Promotion extends Model {
  declare promotionId: string;
  declare promotionType: string;
  declare activeStartDate: Date;
  declare activeEndDate: Date;
  declare topPromo: boolean;
  declare seoBrandList: string[];
  declare linkedTechnicalArticleNumber: string;
  declare linkedCommercialArticleNumber: string;
  declare products: Product[];
  declare benefits: Benefit[];
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
    topPromo: DataTypes.BOOLEAN,
    seoBrandList: DataTypes.JSON,
    linkedTechnicalArticleNumber: DataTypes.JSON,
    linkedCommercialArticleNumber: DataTypes.JSON,
  },
  { sequelize, modelName: "promotion" }
);

Promotion.belongsToMany(Product, {
  through: PromotionProduct,
  foreignKey: "promotionId",
});

Product.belongsToMany(Promotion, {
  through: PromotionProduct,
  foreignKey: "productId",
});

PromotionProduct.belongsTo(Promotion, {
  foreignKey: "promotionId",
});

PromotionProduct.belongsTo(Product, {
  foreignKey: "productId",
});
