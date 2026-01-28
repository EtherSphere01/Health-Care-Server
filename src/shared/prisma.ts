import dotenv from "dotenv";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is missing. Ensure .env is loaded before Prisma initializes.",
    );
}

// Create PostgreSQL connection pool with optimized settings
const pool = new Pool({
    connectionString: databaseUrl,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Return error after 10 seconds if unable to connect
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
    log: [
        {
            emit: "event",
            level: "query",
        },
        {
            emit: "event",
            level: "error",
        },
        {
            emit: "event",
            level: "info",
        },
        {
            emit: "event",
            level: "warn",
        },
    ],
});

// prisma.$on('query', (e) => {
//     // console.log("-------------------------------------------")
//     // console.log('Query: ' + e.query);
//     // console.log("-------------------------------------------")
//     // console.log('Params: ' + e.params)
//     // console.log("-------------------------------------------")
//     // console.log('Duration: ' + e.duration + 'ms')
//     // console.log("-------------------------------------------")
// })

// prisma.$on('warn', (e) => {
//     console.log(e)
// })

// prisma.$on('info', (e) => {
//     console.log(e)
// })

// prisma.$on('error', (e) => {
//     console.log(e)
// })

export default prisma;
