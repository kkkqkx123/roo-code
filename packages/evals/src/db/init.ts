#!/usr/bin/env node

import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

import * as schema from "./schema.js"

const sqlite = new Database('./evals.db')
const db = drizzle({ client: sqlite, schema })

console.log('🔄 Initializing SQLite database...')

// Run migrations
migrate(db, { migrationsFolder: './drizzle' })

console.log('✅ Database initialized successfully')

sqlite.close()

process.exit(0)