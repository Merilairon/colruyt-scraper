import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";
import { User } from "./User";

export interface ShoppingListItem {
  productId: string;
  quantity: number;
}

export interface ChangeFilter {
  filterName: string;
  fromPercentage?: number;
  toPercentage?: number;
  category?: string;
}

export class UserData extends Model {
  declare userId: number;
  declare shoppingList: ShoppingListItem[];
  declare favourites: string[];
  declare filters: ChangeFilter[];
}

UserData.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
    },
    shoppingList: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    favourites: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    filters: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [
        {
          filterName: "-100% to -50%",
          fromPercentage: -100,
          toPercentage: -50,
        },
        { filterName: "-50% to -25%", fromPercentage: -50, toPercentage: -25 },
        { filterName: "-25% to 0%", fromPercentage: -25, toPercentage: 0 },
      ],
    },
  },
  {
    sequelize,
    modelName: "userData",
    tableName: "userData",
    timestamps: true,
  },
);

User.hasOne(UserData, { foreignKey: "userId", onDelete: "CASCADE" });
UserData.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
