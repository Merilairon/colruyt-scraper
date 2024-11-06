import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(process.env.PG_HOST, { logging: false });
