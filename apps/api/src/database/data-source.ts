/* eslint-disable prettier/prettier */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,

  entities: [User],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});