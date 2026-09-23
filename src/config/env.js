require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'secret',
  DB_NAME: process.env.DB_NAME || 'bd_asistenciasIE',
  DB_PORT: process.env.DB_PORT || 5432,
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_shared_with_main_backend',
};
