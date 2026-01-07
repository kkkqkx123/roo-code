import { describe, it, expect, vi, beforeEach } from "vitest"
import { ContextManager } from "../ContextManager"
import type { ClineProvider } from "../../../webview/ClineProvider"

vi.mock("../../../ignore/RooIgnoreController", () => ({
	RooIgnoreController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		initialize: vi.fn().mockResolvedValue(undefined),
		validateAccess: vi.fn().mockReturnValue(true),
	})),
}))

vi.mock("../../../protect/RooProtectedController", () => ({
	RooProtectedController: vi.fn().mockImplementation(() => ({
		dispose: vi.fn(),
		isWriteProtected: vi.fn().mockReturnValue(false),
	})),
}))

describe("ContextManager", () => {
	let mockProvider: Partial<ClineProvider>
	let contextManager: ContextManager

	beforeEach(() => {
		mockProvider = {
			getState: vi.fn(),
		} as any

		contextManager = new ContextManager({
			cwd: "/workspace",
			provider: mockProvider as ClineProvider,
			taskId: "task-1",
		})
	})

	describe("constructor", () => {
		it("should initialize with provided options", () => {
			expect(contextManager.cwd).toBe("/workspace")
			expect(contextManager.taskId).toBe("task-1")
			expect(contextManager.rooIgnoreController).toBeDefined()
			expect(contextManager.rooProtectedController).toBeDefined()
			expect(contextManager.fileContextTracker).toBeDefined()
		})

		it("should create RooIgnoreController with correct path", () => {
			expect(contextManager.rooIgnoreController).toBeDefined()
		})

		it("should create RooProtectedController with correct path", () => {
			expect(contextManager.rooProtectedController).toBeDefined()
		})

		it("should create FileContextTracker with provider and taskId", () => {
			expect(contextManager.fileContextTracker).toBeDefined()
		})
	})

	describe("isFileIgnored", () => {
		it("should return false if RooIgnoreController is not available", async () => {
			contextManager.rooIgnoreController = undefined

			const result = await contextManager.isFileIgnored("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should return true if file is ignored", async () => {
			const mockValidateAccess = vi.fn().mockReturnValue(false)
			contextManager.rooIgnoreController!.validateAccess = mockValidateAccess

			const result = await contextManager.isFileIgnored("/workspace/ignored.txt")

			expect(result).toBe(true)
			expect(mockValidateAccess).toHaveBeenCalledWith("/workspace/ignored.txt")
		})

		it("should return false if file is not ignored", async () => {
			const mockValidateAccess = vi.fn().mockReturnValue(true)
			contextManager.rooIgnoreController!.validateAccess = mockValidateAccess

			const result = await contextManager.isFileIgnored("/workspace/allowed.txt")

			expect(result).toBe(false)
			expect(mockValidateAccess).toHaveBeenCalledWith("/workspace/allowed.txt")
		})
	})

	describe("isFileProtected", () => {
		it("should return false if RooProtectedController is not available", async () => {
			contextManager.rooProtectedController = undefined

			const result = await contextManager.isFileProtected("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should return true if file is protected", async () => {
			const mockIsWriteProtected = vi.fn().mockReturnValue(true)
			contextManager.rooProtectedController!.isWriteProtected = mockIsWriteProtected

			const result = await contextManager.isFileProtected("/workspace/protected.txt")

			expect(result).toBe(true)
			expect(mockIsWriteProtected).toHaveBeenCalledWith("/workspace/protected.txt")
		})

		it("should return false if file is not protected", async () => {
			const mockIsWriteProtected = vi.fn().mockReturnValue(false)
			contextManager.rooProtectedController!.isWriteProtected = mockIsWriteProtected

			const result = await contextManager.isFileProtected("/workspace/unprotected.txt")

			expect(result).toBe(false)
			expect(mockIsWriteProtected).toHaveBeenCalledWith("/workspace/unprotected.txt")
		})
	})

	describe("getFileContextTracker", () => {
		it("should return the file context tracker", () => {
			const tracker = contextManager.getFileContextTracker()

			expect(tracker).toBe(contextManager.fileContextTracker)
		})
	})

	describe("getRooIgnoreController", () => {
		it("should return the RooIgnoreController", () => {
			const controller = contextManager.getRooIgnoreController()

			expect(controller).toBe(contextManager.rooIgnoreController)
		})
	})

	describe("getRooProtectedController", () => {
		it("should return the RooProtectedController", () => {
			const controller = contextManager.getRooProtectedController()

			expect(controller).toBe(contextManager.rooProtectedController)
		})
	})

	describe("dispose", () => {
		it("should dispose the file context tracker", async () => {
			const mockDispose = vi.fn()
			contextManager.fileContextTracker.dispose = mockDispose

			await contextManager.dispose()

			expect(mockDispose).toHaveBeenCalled()
		})
	})

	describe("file access validation", () => {
		it("should validate file access through ignore controller", async () => {
			const mockValidateAccess = vi.fn().mockReturnValue(true)
			contextManager.rooIgnoreController!.validateAccess = mockValidateAccess

			const result = await contextManager.isFileIgnored("/workspace/src/index.ts")

			expect(result).toBe(false)
			expect(mockValidateAccess).toHaveBeenCalledWith("/workspace/src/index.ts")
		})

		it("should validate file protection through protected controller", async () => {
			const mockIsWriteProtected = vi.fn().mockReturnValue(false)
			contextManager.rooProtectedController!.isWriteProtected = mockIsWriteProtected

			const result = await contextManager.isFileProtected("/workspace/src/index.ts")

			expect(result).toBe(false)
			expect(mockIsWriteProtected).toHaveBeenCalledWith("/workspace/src/index.ts")
		})
	})

	describe("controller availability", () => {
		it("should handle missing RooIgnoreController gracefully", async () => {
			contextManager.rooIgnoreController = undefined

			const result = await contextManager.isFileIgnored("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should handle missing RooProtectedController gracefully", async () => {
			contextManager.rooProtectedController = undefined

			const result = await contextManager.isFileProtected("/workspace/test.txt")

			expect(result).toBe(false)
		})

		it("should return undefined for RooIgnoreController when not available", () => {
			contextManager.rooIgnoreController = undefined

			const result = contextManager.getRooIgnoreController()

			expect(result).toBeUndefined()
		})

		it("should return undefined for RooProtectedController when not available", () => {
			contextManager.rooProtectedController = undefined

			const result = contextManager.getRooProtectedController()

			expect(result).toBeUndefined()
		})
	})
})
