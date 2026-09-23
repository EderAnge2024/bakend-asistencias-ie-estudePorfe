require('dotenv').config();
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_shared_with_main_backend',
};