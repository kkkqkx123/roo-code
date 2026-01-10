import { sql } from "drizzle-orm"

import { testDb, disconnect } from "./src/db/db.js"

async function resetTestDatabase() {
	const db = testDb

	if (!db) {
		console.log("No database connection available, skipping database reset")
		return
	}

	try {
		// For SQLite, we need to use a different approach
		// Get all tables from sqlite_master
		const tables = db.$client.prepare(`
			SELECT name FROM sqlite_master 
			WHERE type='table' 
			AND name NOT LIKE 'sqlite_%'
		`).all() as { name: string }[]

		const tableNames = tables.map((t) => t.name)

		// Delete all data from tables (SQLite doesn't support TRUNCATE)
		for (const tableName of tableNames) {
			db.$client.prepare(`DELETE FROM "${tableName}"`).run()
		}

		console.log(`[SQLite] Cleared tables: ${tableNames.join(", ")}`)
	} catch (error) {
		console.error("Error resetting database:", error)
		throw error
	}
}

export default async function () {
	await resetTestDatabase()

	return async () => {
		await disconnect()
	}
}
