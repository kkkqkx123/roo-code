import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { EventEmitter } from "events"
import { MessageQueueManager } from "../MessageQueueManager"
import type { MessageQueueManagerOptions } from "../MessageQueueManager"
import type { ClineProvider } from "../../../webview/ClineProvider"
import type { RooIgnoreController } from "../../../ignore/RooIgnoreController"

describe("MessageQueueManager", () => {
    let messageQueueManager: MessageQueueManager
    let mockProvider: ClineProvider
    let mockRooIgnoreController: RooIgnoreController
    let mockProviderRef: WeakRef<ClineProvider>
    let options: MessageQueueManagerOptions

    beforeEach(() => {
        mockRooIgnoreController = {
            isIgnored: vi.fn().mockReturnValue(false),
        } as unknown as RooIgnoreController

        mockProvider = {
            context: {
                globalState: {
                    get: vi.fn().mockReturnValue(undefined),
                    update: vi.fn().mockResolvedValue(undefined),
                },
                workspaceState: {
                    get: vi.fn().mockReturnValue(undefined),
                    update: vi.fn().mockResolvedValue(undefined),
                },
            },
            postStateToWebview: vi.fn(),
            postMessageToWebview: vi.fn(),
            setMode: vi.fn().mockResolvedValue(undefined),
            setProviderProfile: vi.fn().mockResolvedValue(undefined),
            getApiConversationHistory: vi.fn().mockReturnValue([]),
        } as unknown as ClineProvider

        mockProviderRef = new WeakRef(mockProvider)

        options = {
            taskId: "test-task-id",
            providerRef: mockProviderRef,
            onUserMessage: vi.fn(),
        }

        messageQueueManager = new MessageQueueManager(options)
    })

    afterEach(() => {
        messageQueueManager.dispose()
    })

    describe("constructor", () => {
        it("should initialize with provided options", () => {
            expect(messageQueueManager.taskId).toBe("test-task-id")
        })

        it("should create message queue service", () => {
            const service = messageQueueManager.getMessageQueueService()
            expect(service).toBeDefined()
            expect(service.messages).toEqual([])
        })

        it("should set up state change handler", () => {
            const service = messageQueueManager.getMessageQueueService()
            service.emit("stateChanged", [])
            
            expect(options.onUserMessage).toHaveBeenCalledWith("test-task-id")
            expect(mockProvider.postStateToWebview).toHaveBeenCalled()
        })
    })

    describe("submitUserMessage", () => {
        it("should submit message with text only", async () => {
            await messageQueueManager.submitUserMessage("Hello world")
            
            expect(mockProvider.setMode).not.toHaveBeenCalled()
            expect(mockProvider.setProviderProfile).not.toHaveBeenCalled()
            expect(options.onUserMessage).toHaveBeenCalledWith("test-task-id")
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                invoke: "sendMessage",
                text: "Hello world",
                images: [],
            })
        })

        it("should submit message with text and images", async () => {
            const images = ["image1.png", "image2.png"]
            await messageQueueManager.submitUserMessage("Hello", images)
            
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                invoke: "sendMessage",
                text: "Hello",
                images: ["image1.png", "image2.png"],
            })
        })

        it("should set mode when provided", async () => {
            await messageQueueManager.submitUserMessage("Hello", [], "code")
            
            expect(mockProvider.setMode).toHaveBeenCalledWith("code")
        })

        it("should set provider profile when provided", async () => {
            await messageQueueManager.submitUserMessage("Hello", [], undefined, "profile1")
            
            expect(mockProvider.setProviderProfile).toHaveBeenCalledWith("profile1")
        })

        it("should trim text", async () => {
            await messageQueueManager.submitUserMessage("  Hello world  ")
            
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                invoke: "sendMessage",
                text: "Hello world",
                images: [],
            })
        })

        it("should not submit empty message", async () => {
            await messageQueueManager.submitUserMessage("")
            
            expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
        })

        it("should not submit whitespace-only message", async () => {
            await messageQueueManager.submitUserMessage("   ")
            
            expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
        })

        it("should not submit message with empty text and no images", async () => {
            await messageQueueManager.submitUserMessage("", [])
            
            expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
        })

        it("should handle null text", async () => {
            await messageQueueManager.submitUserMessage(null as unknown as string)
            
            expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
        })

        it("should handle undefined text", async () => {
            await messageQueueManager.submitUserMessage(undefined as unknown as string)
            
            expect(mockProvider.postMessageToWebview).not.toHaveBeenCalled()
        })

        it("should handle null images", async () => {
            await messageQueueManager.submitUserMessage("Hello", null as unknown as string[])
            
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                invoke: "sendMessage",
                text: "Hello",
                images: [],
            })
        })

        it("should handle undefined images", async () => {
            await messageQueueManager.submitUserMessage("Hello", undefined as unknown as string[])
            
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                "invoke": "sendMessage",
                text: "Hello",
                images: [],
            })
        })

        it("should submit message with images but no text", async () => {
            const images = ["image1.png"]
            await messageQueueManager.submitUserMessage("", images)
            
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                invoke: "sendMessage",
                text: "",
                images: ["image1.png"],
            })
        })

        it("should handle provider reference lost", async () => {
            const tempProvider = {} as unknown as ClineProvider
            const lostRef = new WeakRef(tempProvider)
            const onUserMessageSpy = vi.fn()
            const managerWithLostRef = new MessageQueueManager({
                taskId: "test-task-id",
                providerRef: lostRef,
                onUserMessage: onUserMessageSpy,
            })
            
            await managerWithLostRef.submitUserMessage("Hello")
            
            expect(onUserMessageSpy).toHaveBeenCalled()
            
            managerWithLostRef.dispose()
        })

        it("should handle errors gracefully", async () => {
            mockProvider.setMode = vi.fn().mockRejectedValue(new Error("Test error"))
            
            const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
            
            await messageQueueManager.submitUserMessage("Hello", [], "code")
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "[MessageQueueManager#submitUserMessage] Failed to submit user message:",
                expect.any(Error)
            )
            
            consoleErrorSpy.mockRestore()
        })
    })

    describe("processQueuedMessages", () => {
        it("should process queued messages", async () => {
            const service = messageQueueManager.getMessageQueueService()
            service.addMessage("Queued message", [])
            
            const submitSpy = vi.spyOn(messageQueueManager, "submitUserMessage").mockResolvedValue(undefined)
            
            await messageQueueManager.processQueuedMessages()
            
            setTimeout(() => {
                expect(submitSpy).toHaveBeenCalledWith("Queued message", [])
            }, 150)
        })

        it("should not process when queue is empty", async () => {
            const submitSpy = vi.spyOn(messageQueueManager, "submitUserMessage").mockResolvedValue(undefined)
            
            await messageQueueManager.processQueuedMessages()
            
            expect(submitSpy).not.toHaveBeenCalled()
        })

        it("should process messages with delay", async () => {
            const service = messageQueueManager.getMessageQueueService()
            service.addMessage("Message 1", [])
            service.addMessage("Message 2", [])
            
            const submitSpy = vi.spyOn(messageQueueManager, "submitUserMessage").mockResolvedValue(undefined)
            
            await messageQueueManager.processQueuedMessages()
            
            setTimeout(() => {
                expect(submitSpy).toHaveBeenCalledTimes(1)
                expect(submitSpy).toHaveBeenCalledWith("Message 1", [])
            }, 150)
        })
    })

    describe("validateUserMessage", () => {
        it("should validate message with text", () => {
            const result = messageQueueManager.validateUserMessage("Hello", [])
            expect(result).toBe(true)
        })

        it("should validate message with images", () => {
            const result = messageQueueManager.validateUserMessage("", ["image1.png"])
            expect(result).toBe(true)
        })

        it("should validate message with text and images", () => {
            const result = messageQueueManager.validateUserMessage("Hello", ["image1.png"])
            expect(result).toBe(true)
        })

        it("should reject empty message", () => {
            const result = messageQueueManager.validateUserMessage("", [])
            expect(result).toBe(false)
        })

        it("should reject whitespace-only message", () => {
            const result = messageQueueManager.validateUserMessage("   ", [])
            expect(result).toBe(false)
        })

        it("should reject null text", () => {
            const result = messageQueueManager.validateUserMessage(null as unknown as string, [])
            expect(result).toBe(false)
        })

        it("should reject undefined text", () => {
            const result = messageQueueManager.validateUserMessage(undefined as unknown as string, [])
            expect(result).toBe(false)
        })

        it("should handle null images", () => {
            const result = messageQueueManager.validateUserMessage("Hello", null as unknown as string[])
            expect(result).toBe(true)
        })

        it("should handle undefined images", () => {
            const result = messageQueueManager.validateUserMessage("Hello", undefined as unknown as string[])
            expect(result).toBe(true)
        })

        it("should trim text", () => {
            const result = messageQueueManager.validateUserMessage("  Hello  ", [])
            expect(result).toBe(true)
        })
    })

    describe("hasQueuedMessages", () => {
        it("should return false when queue is empty", () => {
            expect(messageQueueManager.hasQueuedMessages()).toBe(false)
        })

        it("should return true when queue has messages", () => {
            const service = messageQueueManager.getMessageQueueService()
            service.addMessage("Hello", [])
            
            expect(messageQueueManager.hasQueuedMessages()).toBe(true)
        })
    })

    describe("getQueuedMessageCount", () => {
        it("should return 0 when queue is empty", () => {
            expect(messageQueueManager.getQueuedMessageCount()).toBe(0)
        })

        it("should return correct count when queue has messages", () => {
            const service = messageQueueManager.getMessageQueueService()
            service.addMessage("Message 1", [])
            service.addMessage("Message 2", [])
            service.addMessage("Message 3", [])
            
            expect(messageQueueManager.getQueuedMessageCount()).toBe(3)
        })
    })

    describe("queuedMessages getter", () => {
        it("should return empty array when queue is empty", () => {
            expect(messageQueueManager.queuedMessages).toEqual([])
        })

        it("should return queued messages", () => {
            const service = messageQueueManager.getMessageQueueService()
            service.addMessage("Message 1", [])
            service.addMessage("Message 2", [])
            
            const messages = messageQueueManager.queuedMessages
            expect(messages.length).toBe(2)
            expect(messages[0].text).toBe("Message 1")
            expect(messages[1].text).toBe("Message 2")
        })
    })

    describe("getMessageQueueService", () => {
        it("should return message queue service", () => {
            const service = messageQueueManager.getMessageQueueService()
            expect(service).toBeDefined()
            expect(service.messages).toBeDefined()
        })
    })

    describe("dispose", () => {
        it("should dispose message queue service", () => {
            const service = messageQueueManager.getMessageQueueService()
            const disposeSpy = vi.spyOn(service, "dispose").mockImplementation(() => {})
            
            messageQueueManager.dispose()
            
            expect(disposeSpy).toHaveBeenCalled()
        })

        it("should remove state change handler", () => {
            const service = messageQueueManager.getMessageQueueService()
            const offSpy = vi.spyOn(service, "off").mockImplementation(() => service)
            
            messageQueueManager.dispose()
            
            expect(offSpy).toHaveBeenCalledWith("stateChanged", expect.any(Function))
        })
    })

    describe("integration with Task", () => {
        it("should work correctly when integrated with Task", async () => {
            const onUserMessageSpy = vi.fn()
            const manager = new MessageQueueManager({
                taskId: "integration-test",
                providerRef: mockProviderRef,
                onUserMessage: onUserMessageSpy,
            })
            
            await manager.submitUserMessage("Test message")
            
            expect(onUserMessageSpy).toHaveBeenCalledWith("integration-test")
            expect(mockProvider.postMessageToWebview).toHaveBeenCalledWith({
                type: "invoke",
                invoke: "sendMessage",
                text: "Test message",
                images: [],
            })
            
            manager.dispose()
        })
    })
})
