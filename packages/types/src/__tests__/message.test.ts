// pnpm --filter @roo-code/types test src/__tests__/message.test.ts

import { clineAsks, isTerminalAsk, isBlockingAsk, isMutableAsk, isNonBlockingAsk } from "../message.js"

describe("ask messages", () => {
	test("all ask messages are classified", () => {
		for (const ask of clineAsks) {
			expect(
				isTerminalAsk(ask) || isBlockingAsk(ask) || isMutableAsk(ask) || isNonBlockingAsk(ask),
				`${ask} is not classified`,
			).toBe(true)
		}
	})
})
