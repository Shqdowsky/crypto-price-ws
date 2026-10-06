import { configDotenv } from "dotenv";
import path from "node:path";

configDotenv({ path: path.resolve(process.cwd(), ".env.test"), override: true });
