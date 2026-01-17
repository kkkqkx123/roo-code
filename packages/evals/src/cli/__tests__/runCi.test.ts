import { describe, it, expect, vi, afterEach } from "vitest"
import { runCi } from "../runCi.js"

vi.mock("../../exercises/index.js", () => ({
	EVALS_REPO_PATH: "/mock/evals/repo",
	exerciseLanguages: ["go", "python"],
	getExercisesForLanguage: vi.fn((path, language) => {
		if (language === "go") {
			return Promise.resolve([
				{ language: "go", exercise: "go/hello" },
				{ language: "go", exercise: "go/sum" },
			])
		}
		if (language === "python") {
			return Promise.resolve([
				{ language: "python", exercise: "python/hello" },
				{ language: "python", exercise: "python/sum" },
			])
		}
		return Promise.resolve([])
	}),
}))

vi.mock("../runEvals.js", () => ({
	runEvals: vi.fn(() => Promise.resolve()),
}))

vi.mock("../../db/index.js", () => ({
	createRun: vi.fn((args) => Promise.resolve({
		id: 1,
		model: args.model || "anthropic/claude-sonnet-4",
		concurrency: args.concurrency || 1,
		createdAt: new Date().toISOString(),
		settings: null,
		taskMetricsId: null,
	})),
	createTask: vi.fn((args) => Promise.resolve({
		id: 1,
		runId: args.runId,
		language: args.language,
		exercise: args.exercise,
		createdAt: new Date().toISOString(),
		completedAt: null,
		passed: null,
		error: null,
		executionTime: null,
		toolUsage: null,
	})),
	findRun: vi.fn(() => Promise.resolve(null)),
	getTasks: vi.fn(() => Promise.resolve([])),
	db: {
		query: {
			runs: {
				findMany: vi.fn(() => Promise.resolve([])),
			},
			tasks: {
				findMany: vi.fn(() => Promise.resolve([])),
			},
		},
		delete: vi.fn(() => ({
			where: vi.fn(() => Promise.resolve()),
		})),
	},
}))

describe("runCi", () => {
 	afterEach(() => {
 		vi.clearAllMocks()
 	})

	describe("basic execution", () => {
		it("should create a run with default model and concurrency", async () => {
			const { createRun } = await import("../../db/index.js")
			const { runEvals } = await import("../runEvals.js")
			
			await runCi({})

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 1
			})
			expect(runEvals).toHaveBeenCalledWith(1)
		})

		it("should create a run with custom concurrency", async () => {
			const { createRun } = await import("../../db/index.js")
			const { runEvals } = await import("../runEvals.js")
			
			await runCi({ concurrency: 3 })

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 3
			})
			expect(runEvals).toHaveBeenCalledWith(1)
		})

		it("should create tasks for all languages", async () => {
			const { createRun, createTask } = await import("../../db/index.js")
			const { runEvals } = await import("../runEvals.js")
			
			await runCi({})

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 1
			})
			expect(runEvals).toHaveBeenCalledWith(1)
			expect(createTask).toHaveBeenCalledTimes(4)
			expect(createTask).toHaveBeenCalledWith({
				runId: 1,
				language: "go",
				exercise: { language: "go", exercise: "go/hello" }
			})
			expect(createTask).toHaveBeenCalledWith({
				runId: 1,
				language: "go",
				exercise: { language: "go", exercise: "go/sum" }
			})
			expect(createTask).toHaveBeenCalledWith({
				runId: 1,
				language: "python",
				exercise: { language: "python", exercise: "python/hello" }
			})
			expect(createTask).toHaveBeenCalledWith({
				runId: 1,
				language: "python",
				exercise: { language: "python", exercise: "python/sum" }
			})
		})

		it("should limit exercises per language when specified", async () => {
			const { createRun, createTask } = await import("../../db/index.js")
			const { runEvals } = await import("../runEvals.js")
			
			await runCi({ exercisesPerLanguage: 1 })

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 1
			})
			expect(runEvals).toHaveBeenCalledWith(1)
			expect(createTask).toHaveBeenCalledTimes(2)
			// Should only create one task per language
			expect(createTask).toHaveBeenCalledWith({
				runId: 1,
				language: "go",
				exercise: { language: "go", exercise: "go/hello" }
			})
			expect(createTask).toHaveBeenCalledWith({
				runId: 1,
				language: "python",
				exercise: { language: "python", exercise: "python/hello" }
			})
		})

		it("should call runEvals with the created run id", async () => {
			const { createRun } = await import("../../db/index.js")
			const { runEvals } = await import("../runEvals.js")
			
			await runCi({})

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 1
			})
			expect(runEvals).toHaveBeenCalledWith(1)
		})
	})

	describe("error handling", () => {
		it("should handle errors from getExercisesForLanguage", async () => {
			const { getExercisesForLanguage } = await import("../../exercises/index.js")
			
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(getExercisesForLanguage as any).mockRejectedValue(new Error("Failed to get exercises"))

			await expect(runCi({})).rejects.toThrow("Failed to get exercises")
		})

		it("should handle errors from createRun", async () => {
			const { createRun } = await import("../../db/index.js")
			
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(createRun as any).mockRejectedValue(new Error("Failed to create run"))

			await expect(runCi({})).rejects.toThrow("Failed to create run")
		})

		it("should handle errors from createTask", async () => {
			const { createRun, createTask } = await import("../../db/index.js")
			const { getExercisesForLanguage } = await import("../../exercises/index.js")
			
			// Mock createRun to succeed first, then createTask to fail
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(createRun as any).mockResolvedValue({
				id: 1,
				model: "anthropic/claude-sonnet-4",
				concurrency: 1,
				createdAt: new Date().toISOString(),
				settings: null,
				taskMetricsId: null,
			})

			// Mock getExercisesForLanguage to succeed so we get to createTask step
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(getExercisesForLanguage as any).mockResolvedValue([
				{ name: "test-exercise", language: "javascript" }
			])

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(createTask as any).mockRejectedValue(new Error("Failed to create task"))

			await expect(runCi({})).rejects.toThrow("Failed to create task")
		})

		it("should handle errors from runEvals", async () => {
			const { createRun, createTask } = await import("../../db/index.js")
			const { getExercisesForLanguage } = await import("../../exercises/index.js")
			const { runEvals } = await import("../runEvals.js")
			
			// Mock createRun to succeed first, then runEvals to fail
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(createRun as any).mockResolvedValue({
				id: 1,
				model: "anthropic/claude-sonnet-4",
				concurrency: 1,
				createdAt: new Date().toISOString(),
				settings: null,
				taskMetricsId: null,
			})
			
			// Mock getExercisesForLanguage and createTask to succeed so we get to runEvals step
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(getExercisesForLanguage as any).mockResolvedValue([
				{ language: "javascript", exercise: "test-exercise" }
			])
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(createTask as any).mockResolvedValue({
				id: 1,
				runId: 1,
				language: "javascript",
				exercise: { language: "javascript", exercise: "test-exercise" },
				createdAt: new Date().toISOString(),
			})
			
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(runEvals as any).mockRejectedValue(new Error("Failed to run evals"))

			await expect(runCi({})).rejects.toThrow("Failed to run evals")
			
			// Reset the mock after this test to prevent affecting other tests
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			;(runEvals as any).mockResolvedValue(undefined)
		})
	})

	describe("concurrency handling", () => {
		it("should respect custom concurrency parameter", async () => {
			const { createRun } = await import("../../db/index.js")
			
			await runCi({ concurrency: 5 })

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 5
			})
		})

		it("should use default concurrency of 1 when not specified", async () => {
			const { createRun } = await import("../../db/index.js")
			
			await runCi({})

			expect(createRun).toHaveBeenCalledWith({
				model: "anthropic/claude-sonnet-4",
				concurrency: 1
			})
		})
	})
})
