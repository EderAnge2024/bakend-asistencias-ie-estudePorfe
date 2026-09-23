const { Pool } = require("pg");
require("dotenv").config();

async function run() {
  const connStr = process.env.DATABASE_URL.replace("?sslmode=require", "");
  const pool = new Pool({ 
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tablas en la BD de Monitoreo:");
    console.log(res.rows.map(r => r.table_name));

    // Obtener estructura de usuarios
    const uRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usuarios'`);
    console.log("\nColumnas en usuarios:");
    console.log(uRes.rows.map(r => r.column_name).join(', '));

    // Obtener estructura de docentes
    const dRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'docentes'`);
    console.log("\nColumnas en docentes:");
    console.log(dRes.rows.map(r => r.column_name).join(', '));

    // Obtener roles
    const rRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'roles'`);
    console.log("\nColumnas en roles:");
    console.log(rRes.rows.map(r => r.column_name).join(', '));

    // Obtener usuario_roles
    const urRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'usuario_roles'`);
    console.log("\nColumnas en usuario_roles:");
    console.log(urRes.rows.map(r => r.column_name).join(', '));

    const iRes = await pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'instituciones'`);
    console.log("\nColumnas en instituciones:");
    console.log(iRes.rows.map(r => r.column_name).join(', '));
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();