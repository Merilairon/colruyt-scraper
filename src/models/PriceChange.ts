import { Model, DataTypes } from "sequelize";
import { sequelize } from "../database"; // Adjust the path to your sequelize instance
import { Product } from "./Product";

export enum PriceChangeType {
  BASIC = "P1",
  QUANTITY = "P2",
}

export class PriceChange extends Model {
  declare pricechangeId: number;
  declare productId: string;
  declare priceChangeType: PriceChangeType;
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
    priceChangeType: {
      type: DataTypes.TEXT,
      primaryKey: true,
      defaultValue: PriceChangeType.BASIC,
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
    indexes: [
      // Add a composite unique index
      { unique: true, fields: ["productId", "priceChangeType"] },
    ],
  }
);

Product.hasMany(PriceChange, { foreignKey: "productId" });
PriceChange.belongsTo(Product, { foreignKey: "productId" });
