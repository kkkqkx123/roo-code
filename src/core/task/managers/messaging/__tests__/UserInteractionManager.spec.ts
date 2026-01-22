import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { UserInteractionManager } from "../UserInteractionManager"
import type { ClineMessage, ClineSay } from "@shared/types"
import type { TaskStateManager } from "../../core/TaskStateManager"
import type { MessageManager } from "../MessageManager"
import type { ClineProvider } from "../../../../webview/ClineProvider"

describe("UserInteractionManager", () => {
	let userInteractionManager: UserInteractionManager
	let mockStateManager: TaskStateManager
	let mockMessageManager: MessageManager
	let mockProvider: ClineProvider

	beforeEach(() => {
		mockProvider = {
			log: vi.fn(),
		} as unknown as ClineProvider

		mockStateManager = {
			getProvider: vi.fn().mockReturnValue(mockProvider),
		} as unknown as TaskStateManager

		mockMessageManager = {
			getClineMessages: vi.fn().mockReturnValue([]),
			addToClineMessages: vi.fn().mockResolvedValue(undefined),
			updateClineMessage: vi.fn().mockResolvedValue(undefined),
		} as unknown as MessageManager

		userInteractionManager = new UserInteractionManager({
			stateManager: mockStateManager,
			messageManager: mockMessageManager,
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Initialization", () => {
		it("should initialize with empty state", () => {
			expect((userInteractionManager as any).askState).toBeNull()
		})
	})

	describe("say() - Basic Message", () => {
		it("should add a simple text message", async () => {
			await userInteractionManager.say("text", "Hello world")

			expect(mockMessageManager.addToClineMessages).toHaveBeenCalled()
		})

		it("should add message with images", async () => {
			const images = ["data:image/png;base64,iVBORw0KG..."]

			await userInteractionManager.say("text", "Test message", images)

			expect(mockMessageManager.addToClineMessages).toHaveBeenCalled()
		})

		it("should add message with checkpoint", async () => {
			const checkpoint = { hash: "abc123" }

			await userInteractionManager.say("text", "Test", undefined, undefined, checkpoint)

			expect(mockMessageManager.addToClineMessages).toHaveBeenCalled()
		})
	})

	describe("say() - Partial Messages", () => {
		it("should add partial message", async () => {
			await userInteractionManager.say("text", "Partial", undefined, true)

			expect(mockMessageManager.addToClineMessages).toHaveBeenCalled()
		})

		it("should update existing partial message", async () => {
			const ts = Date.now()
			const existingMessage: ClineMessage = {
				type: "say",
				say: "text",
				ts,
				text: "Partial",
				partial: true,
			}

			;(mockMessageManager.getClineMessages as any).mockReturnValue([existingMessage])

			await userInteractionManager.say("text", "Updated", undefined, true)

			expect(mockMessageManager.updateClineMessage).toHaveBeenCalled()
		})

		it("should finalize partial message", async () => {
			const ts = Date.now()
			const existingMessage: ClineMessage = {
				type: "say",
				say: "text",
				ts,
				text: "Partial",
				partial: true,
			}

			;(mockMessageManager.getClineMessages as any).mockReturnValue([existingMessage])

			await userInteractionManager.say("text", "Final", undefined, false)

			expect(mockMessageManager.updateClineMessage).toHaveBeenCalled()
		})

		it("should return undefined when finalizing without existing partial", async () => {
			;(mockMessageManager.getClineMessages as any).mockReturnValue([])

			const result = await userInteractionManager.say("text", "Final", undefined, false)

			expect(result).toBeUndefined()
		})
	})

	describe("say() - Non-Interactive Messages", () => {
		it("should not update lastMessageTs for non-interactive messages", async () => {
			await userInteractionManager.say("text", "Non-interactive", undefined, undefined, undefined, undefined, { isNonInteractive: true })

			expect(mockMessageManager.addToClineMessages).toHaveBeenCalled()
		})
	})

	describe("sayAndCreateMissingParamError", () => {
		it("should create error message for missing parameter", async () => {
			const toolName = "read_file"
			const paramName = "path"

			await userInteractionManager.sayAndCreateMissingParamError(toolName, paramName)

			expect(mockMessageManager.addToClineMessages).toHaveBeenCalled()
		})
	})

	describe("handleWebviewAskResponse", () => {
		it("should update ask state with response", () => {
			const askResponse: any = "yesButtonClicked"
			const text = "Response text"
			const images = ["data:image/png;base64,..."]

			;(userInteractionManager as any).askState = {
				timestamp: Date.now(),
			}

			userInteractionManager.handleWebviewAskResponse(askResponse, text, images)

			const askState = (userInteractionManager as any).askState
			expect(askState?.askResponse).toBe(askResponse)
			expect(askState?.askResponseText).toBe(text)
			expect(askState?.askResponseImages).toBe(images)
		})

		it("should update lastMessageTs for messageResponse", () => {
			const ts = Date.now() - 100
			;(userInteractionManager as any).lastMessageTs = ts

			userInteractionManager.handleWebviewAskResponse("messageResponse", "Test")

			expect((userInteractionManager as any).lastMessageTs).toBeGreaterThan(ts)
		})

		it("should update lastMessageTs for yesButtonClicked", () => {
			const ts = Date.now() - 100
			;(userInteractionManager as any).lastMessageTs = ts

			userInteractionManager.handleWebviewAskResponse("yesButtonClicked", "Test")

			expect((userInteractionManager as any).lastMessageTs).toBeGreaterThan(ts)
		})
	})

	describe("cancelAutoApprovalTimeout", () => {
		it("should cancel auto approval timeout", () => {
			const clearTimeoutSpy = vi.spyOn(global, "clearTimeout")

			;(userInteractionManager as any).autoApprovalTimeoutRef = setTimeout(() => {}, 1000)

			userInteractionManager.cancelAutoApprovalTimeout()

			expect(clearTimeoutSpy).toHaveBeenCalled()
			expect((userInteractionManager as any).autoApprovalTimeoutRef).toBeUndefined()
		})
	})
})
