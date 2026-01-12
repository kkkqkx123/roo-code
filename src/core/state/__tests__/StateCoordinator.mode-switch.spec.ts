import { describe, test, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { ClineProvider } from "../../webview/ClineProvider"
import { ContextProxy } from "../../config/ContextProxy"
import { defaultModeSlug } from "../../../shared/modes"

describe("StateCoordinator - Mode Switch and Custom Mode Updates", () => {
	let provider: ClineProvider
	let mockContext: vscode.ExtensionContext
	let mockOutputChannel: vscode.OutputChannel
	let mockWebviewView: vscode.WebviewView
	let mockPostMessage: any

	beforeEach(() => {
		vi.clearAllMocks()

		const globalState: Record<string, string | undefined> = {
			mode: "code",
			currentApiConfigName: "test-config",
		}

		const secrets: Record<string, string | undefined> = {}

		mockContext = {
			extensionPath: "/test/path",
			extensionUri: {} as vscode.Uri,
			globalState: {
				get: vi.fn().mockImplementation((key: string) => globalState[key]),
				update: vi
					.fn()
					.mockImplementation((key: string, value: string | undefined) => (globalState[key] = value)),
				keys: vi.fn().mockImplementation(() => Object.keys(globalState)),
			},
			secrets: {
				get: vi.fn().mockImplementation((key: string) => secrets[key]),
				store: vi.fn().mockImplementation((key: string, value: string | undefined) => (secrets[key] = value)),
				delete: vi.fn().mockImplementation((key: string) => delete secrets[key]),
			},
			subscriptions: [],
			extension: {
				packageJSON: { version: "1.0.0" },
			},
			globalStorageUri: {
				fsPath: "/test/storage/path",
			},
		} as unknown as vscode.ExtensionContext

		const mockCustomModesManager = {
			updateCustomMode: vi.fn().mockResolvedValue(undefined),
			getCustomModes: vi.fn().mockResolvedValue([]),
			dispose: vi.fn(),
		}

		mockOutputChannel = {
			appendLine: vi.fn(),
			clear: vi.fn(),
			dispose: vi.fn(),
		} as unknown as vscode.OutputChannel

		mockPostMessage = vi.fn()

		mockWebviewView = {
			webview: {
				postMessage: mockPostMessage,
				html: "",
				options: {},
				onDidReceiveMessage: vi.fn(),
				asWebviewUri: vi.fn(),
				cspSource: "vscode-webview://test-csp-source",
			},
			visible: true,
			onDidDispose: vi.fn().mockImplementation((callback) => {
				callback()
				return { dispose: vi.fn() }
			}),
			onDidChangeVisibility: vi.fn().mockImplementation(() => ({ dispose: vi.fn() })),
		} as unknown as vscode.WebviewView

		provider = new ClineProvider(mockContext, mockOutputChannel, "sidebar", new ContextProxy(mockContext))

		provider.getMcpHub = vi.fn().mockReturnValue({
			listTools: vi.fn().mockResolvedValue([]),
			callTool: vi.fn().mockResolvedValue({ content: [] }),
			listResources: vi.fn().mockResolvedValue([]),
			readResource: vi.fn().mockResolvedValue({ contents: [] }),
			getAllServers: vi.fn().mockReturnValue([]),
		})

		// Mock customModesManager as a getter property
		Object.defineProperty(provider, 'customModesManager', {
			get: () => mockCustomModesManager,
			configurable: true
		})
	})

	describe("handleModeSwitch", () => {
		beforeEach(async () => {
			await provider.resolveWebviewView(mockWebviewView)
		})

		test("loads saved API config when switching modes", async () => {
			const profile: any = {
				name: "saved-config",
				id: "saved-config-id",
				apiProvider: "anthropic",
			}

			;(provider as any).providerSettingsManager = {
				getModeConfigId: vi.fn().mockResolvedValue("saved-config-id"),
				listConfig: vi.fn().mockResolvedValue([profile]),
				activateProfile: vi.fn().mockResolvedValue(profile),
				setModeConfig: vi.fn(),
			} as any

			await provider.handleModeSwitch("architect")

			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")

			expect(provider.providerSettingsManager.getModeConfigId).toHaveBeenCalledWith("architect")
			expect(provider.providerSettingsManager.activateProfile).toHaveBeenCalledWith({ name: "saved-config" })
			expect(mockContext.globalState.update).toHaveBeenCalledWith("currentApiConfigName", "saved-config")

			expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }))
		})

		test("saves current config when switching to mode without config", async () => {
			;(provider as any).providerSettingsManager = {
				getModeConfigId: vi.fn().mockResolvedValue(undefined),
				listConfig: vi
					.fn()
					.mockResolvedValue([{ name: "current-config", id: "current-id", apiProvider: "anthropic" }]),
				setModeConfig: vi.fn(),
			} as any

			const contextProxy = (provider as any).contextProxy
			const getValueSpy = vi.spyOn(contextProxy, "getValue")
			getValueSpy.mockImplementation((key: any) => {
				if (key === "currentApiConfigName") return "current-config"
				return undefined
			})

			await provider.handleModeSwitch("architect")

			expect(mockContext.globalState.update).toHaveBeenCalledWith("mode", "architect")

			expect(provider.providerSettingsManager.setModeConfig).toHaveBeenCalledWith("architect", "current-id")

			expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "state" }))
		})
	})

	describe("updateCustomMode", () => {
		test("updates both file and state when updating custom mode", async () => {
			await provider.resolveWebviewView(mockWebviewView)
			const messageHandler = (mockWebviewView.webview.onDidReceiveMessage as any).mock.calls[0][0]

			// Mock customModesManager as a getter property for this test
			Object.defineProperty(provider, 'customModesManager', {
				get: () => ({
					updateCustomMode: vi.fn().mockResolvedValue(undefined),
					getCustomModes: vi.fn().mockResolvedValue([
						{
							slug: "test-mode",
							name: "Test Mode",
							roleDefinition: "Updated role definition",
							groups: ["read"] as const,
						},
					]),
					dispose: vi.fn(),
				}),
				configurable: true
			})

			await messageHandler({
				type: "updateCustomMode",
				modeConfig: {
					slug: "test-mode",
					name: "Test Mode",
					roleDefinition: "Updated role definition",
					groups: ["read"] as const,
				},
			})

			expect(provider.customModesManager.updateCustomMode).toHaveBeenCalledWith(
				"test-mode",
				expect.objectContaining({
					slug: "test-mode",
					roleDefinition: "Updated role definition",
				}),
			)

			expect(mockContext.globalState.update).toHaveBeenCalledWith("customModes", [
				{ groups: ["read"], name: "Test Mode", roleDefinition: "Updated role definition", slug: "test-mode" },
			])

			expect(mockPostMessage).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "state",
					state: expect.objectContaining({
						customModes: [
							expect.objectContaining({
								slug: "test-mode",
								roleDefinition: "Updated role definition",
							}),
						],
					}),
				}),
			)
		})
	})
})
