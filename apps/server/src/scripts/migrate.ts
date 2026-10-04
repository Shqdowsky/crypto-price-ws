import { readdirSync, readFileSync } from "fs";
import path, { join } from "path";
import { Pool } from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { env } from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
    host: env.DB_HOST as string,
    port: env.DB_PORT as number,
    database: env.DB_NAME as string,
    user: env.DB_USER as string,
    password: env.DB_PASSWORD as string,
    max: 50
});

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    const dir = join(__dirname, "../../migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
        const alreadyApplied = await pool.query(
            `SELECT 1 FROM schema_migrations WHERE filename = $1`,
            [file]
        );

        if (alreadyApplied.rows.length > 0) {
            console.log(`Skipping ${file} (already applied)`);
            continue;
        }

        console.log(`Applying ${file}...`);
        const sql = readFileSync(join(dir, file), "utf-8");
        await pool.query("BEGIN");
        try {
            await pool.query(sql);
            console.log("her1e")
            await pool.query(`INSERT INTO schema_migrations (filename) VALUES ($1)`, [file]);
            await pool.query("COMMIT");
        } catch (err) {
            console.error("FAILED SQL EXECUTING:", err);
            await pool.query("ROLLBACK");
            throw err;
        }
    }

    await pool.end();
    console.log("Migrations complete.");
}

migrate().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});