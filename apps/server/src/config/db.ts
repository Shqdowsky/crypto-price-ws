import { Pool } from "pg";
import { dbConfig } from "./env.js";

const pool = new Pool(dbConfig);

if (process.env.NODE_ENV !== "test") {
	pool.connect((err, client, release) => {
		if (err) {
			console.error("Database connection failed:", err);
			process.exit(1);
		} else {
			console.log("Database connected successfully ✅");
			release();
		}
	});
}

export default pool;
