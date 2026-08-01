import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";

export class User extends Model {
  declare id: number;
  declare auth0Id: string;
  declare email: string;
  declare displayName?: string;
  declare locale?: string;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    auth0Id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    displayName: DataTypes.STRING,
    locale: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: "user",
    tableName: "users",
    timestamps: true,
  },
);
