import { Model, DataTypes } from "sequelize";
import { sequelize } from "../data"; // Adjust the path to your sequelize instance
import { Product } from "./Product";

export class PriceChange extends Model {
  declare pricechangeId: number;
  declare productId: string;
  declare priceChange: number;
  declare priceChangePercentage: number;
  declare involvesPromotion: boolean;
  declare oldPrice: number;
  declare newprice: number;
}

PriceChange.init(
  {
    pricechangeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    priceChange: DataTypes.FLOAT,
    priceChangePercentage: DataTypes.FLOAT,
    involvesPromotion: DataTypes.BOOLEAN,
    oldPrice: DataTypes.FLOAT,
    newprice: DataTypes.FLOAT,
  },
  {
    sequelize,
    modelName: "pricechange",
  }
);

Product.hasOne(PriceChange, { foreignKey: "productId" });
PriceChange.belongsTo(Product, { foreignKey: "productId" });
