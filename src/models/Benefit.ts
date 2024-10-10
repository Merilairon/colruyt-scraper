import { Model, DataTypes } from "sequelize";
import { sequelize } from "../data";
import { Promotion } from "./Promotion";

export class Benefit extends Model {
  declare benefitAmount?: number;
  declare benefitPercentage?: number;
  declare minLimit?: number;
  declare maxLimit?: number;
  declare limitUnit?: string;
  declare promotionId: string;
}

Benefit.init(
  {
    benefitAmount: DataTypes.FLOAT,
    benefitPercentage: DataTypes.FLOAT,
    minLimit: DataTypes.FLOAT,
    maxLimit: DataTypes.FLOAT,
    limitUnit: DataTypes.STRING,
  },
  { sequelize, modelName: "benefit" }
);

Promotion.hasMany(Benefit, { foreignKey: "promotionId" });
Benefit.belongsTo(Promotion, { foreignKey: "promotionId" });
