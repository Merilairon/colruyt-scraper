import { Model, DataTypes } from "sequelize";
import { sequelize } from "../database";
import { Promotion } from "./Promotion";
import { Product } from "./Product";

export class PromotionProduct extends Model {
  declare promotionId: string;
  declare productId: string;
}
PromotionProduct.init(
  {
    promotionId: DataTypes.STRING,
    productId: DataTypes.STRING,
  },
  { sequelize, modelName: "promotionproduct" }
);
