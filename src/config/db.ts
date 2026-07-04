import {Pool} from "pg";
import { env } from "./env.js";
import {configDotenv} from "dotenv";
configDotenv();

const pool = new Pool({
    host: env.DB_HOST as string,
    port: env.DB_PORT as number,
    database: env.DB_NAME as string,
    user: env.DB_USER as string,
    password: env.DB_PASSWORD as string
});

pool.connect((err, client, release) => {
    if(err){
        console.error('Database connection failed:', err);
        process.exit(1)
    }else{
        console.log('Database connected successfully ✅');
        release();
    }
});

export default pool;