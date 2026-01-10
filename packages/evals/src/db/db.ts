import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import * as schema from "./schema.js"

const sqlite = new Database('./evals.db')
const client = drizzle({ client: sqlite, schema })

let testDb: typeof client | undefined = undefined

if (process.env.NODE_ENV === "test") {
	// For tests, use an in-memory database
	const testSqlite = new Database(':memory:')
	testDb = drizzle({ client: testSqlite, schema })
}

const disconnect = () => {
	sqlite.close()
}

type DatabaseOrTransaction = typeof client | Parameters<Parameters<typeof client.transaction>[0]>[0]

export { client, testDb, disconnect, type DatabaseOrTransaction }
