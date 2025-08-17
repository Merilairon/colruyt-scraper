import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";
import { Product } from "./Product";

export class Price extends Model {
  declare priceId: number;
  declare date: Date;
  declare recommendedQuantity?: number;
  declare basicPrice?: number;
  declare quantityPrice?: number;
  declare quantityPriceQuantity?: number;
  declare measurementUnitPrice?: number;
  declare measurementUnit?: string;
  declare isRedPrice?: boolean;
  declare pricePerUOM?: number;
  declare isPromoActive?: string;
  declare productId: string;
}

Price.init(
  {
    priceId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    recommendedQuantity: DataTypes.STRING,
    basicPrice: DataTypes.FLOAT,
    quantityPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    quantityPriceQuantity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    measurementUnitPrice: DataTypes.FLOAT,
    measurementUnit: DataTypes.STRING,
    isRedPrice: DataTypes.BOOLEAN,
    pricePerUOM: DataTypes.FLOAT,
    isPromoActive: DataTypes.STRING,
  },
  { sequelize, modelName: "price" }
);

Product.hasMany(Price, { foreignKey: "productId" });
Price.belongsTo(Product, { foreignKey: "productId" });
