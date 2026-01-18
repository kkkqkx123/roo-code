import { describe, it, expect, beforeEach } from "vitest"
import { CheckpointDecisionEngine, CommandRiskLevel, ShellType } from "../CheckpointDecisionEngine"
import type { GlobalSettings } from "@shared/types"

describe("CheckpointDecisionEngine", () => {
  let settings: GlobalSettings
  let decisionEngine: CheckpointDecisionEngine

  beforeEach(() => {
    // 默认设置
    settings = {
      enableCheckpoints: true,
      checkpointBeforeHighRiskCommands: true,
      checkpointAfterHighRiskCommands: false,
      checkpointOnCommandError: true,
      checkpointCommands: ["dangerous-command"],
      noCheckpointCommands: ["safe-command"],
      checkpointShellSpecific: {}
    } as GlobalSettings

    decisionEngine = new CheckpointDecisionEngine(settings)
  })

  describe("Shell类型检测", () => {
    it("应该正确检测PowerShell", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("test", "C:\\Program Files\\PowerShell\\7\\pwsh.exe")
      expect(decision.reason).toBe("low_risk")
    })

    it("应该正确检测Bash", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("test", "/bin/bash")
      expect(decision.reason).toBe("low_risk")
    })

    it("应该正确检测Zsh", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("test", "/bin/zsh")
      expect(decision.reason).toBe("low_risk")
    })

    it("应该正确检测CMD", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("test", "C:\\Windows\\System32\\cmd.exe")
      expect(decision.reason).toBe("low_risk")
    })

    it("应该处理未知Shell类型", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("test", "/unknown/shell")
      expect(decision.reason).toBe("low_risk")
    })

    it("应该自动检测系统Shell", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("test")
      expect(decision.reason).toBe("low_risk")
    })
  })

  describe("风险评估", () => {
    it("应该识别关键风险命令", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("rm -rf /", "/bin/bash")
      expect(decision.riskLevel).toBe(CommandRiskLevel.CRITICAL)
      expect(decision.shouldCheckpoint).toBe(true)
    })

    it("应该识别高风险命令", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("rm -rf /tmp", "/bin/bash")
      expect(decision.riskLevel).toBe(CommandRiskLevel.HIGH)
      expect(decision.shouldCheckpoint).toBe(true)
    })

    it("应该识别中等风险命令", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("rm file.txt", "/bin/bash")
      expect(decision.riskLevel).toBe(CommandRiskLevel.MEDIUM)
      expect(decision.shouldCheckpoint).toBe(true)
    })

    it("应该识别低风险命令", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("ls -la", "/bin/bash")
      expect(decision.riskLevel).toBe(CommandRiskLevel.LOW)
      expect(decision.shouldCheckpoint).toBe(false)
    })

    it("应该支持PowerShell特定风险模式", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("Remove-Item -Recurse -Force C:\\Windows", "C:\\Program Files\\PowerShell\\7\\pwsh.exe")
      expect(decision.riskLevel).toBe(CommandRiskLevel.CRITICAL)
      expect(decision.shouldCheckpoint).toBe(true)
    })

    it("应该支持CMD特定风险模式", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("del /f /s /q C:\\Windows", "C:\\Windows\\System32\\cmd.exe")
      expect(decision.riskLevel).toBe(CommandRiskLevel.CRITICAL)
      expect(decision.shouldCheckpoint).toBe(true)
    })
  })

  describe("命令列表配置", () => {
    it("应该为配置的命令创建检查点", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("dangerous-command test", "/bin/bash")
      expect(decision.shouldCheckpoint).toBe(true)
      expect(decision.reason).toBe("command_required")
    })

    it("应该为配置的命令豁免检查点", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("safe-command test", "/bin/bash")
      expect(decision.shouldCheckpoint).toBe(false)
      expect(decision.reason).toBe("command_exempted")
    })

    it("应该支持最长前缀匹配", async () => {
      settings.checkpointCommands = ["git reset", "git clean"]
      decisionEngine = new CheckpointDecisionEngine(settings)

      const decision = await decisionEngine.shouldCreateCheckpoint("git reset --hard HEAD~1", "/bin/bash")
      expect(decision.shouldCheckpoint).toBe(true)
      expect(decision.reason).toBe("command_required")
    })
  })

  describe("Shell特定配置", () => {
    beforeEach(() => {
      settings.checkpointShellSpecific = {
        [ShellType.POWERSHELL]: {
          checkpointBeforeHighRiskCommands: false,
          checkpointAfterHighRiskCommands: true
        },
        [ShellType.BASH]: {
          checkpointBeforeHighRiskCommands: true,
          checkpointCommands: ["bash-specific-command"]
        }
      }
      decisionEngine = new CheckpointDecisionEngine(settings)
    })

    it("应该应用Shell特定配置", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("rm -rf /tmp", "C:\\Program Files\\PowerShell\\7\\pwsh.exe")
      expect(decision.shouldCheckpoint).toBe(false) // PowerShell配置为不创建检查点
    })

    it("应该合并全局和Shell特定配置", async () => {
      const decision = await decisionEngine.shouldCreateCheckpoint("bash-specific-command", "/bin/bash")
      expect(decision.shouldCheckpoint).toBe(true)
      expect(decision.reason).toBe("command_required")
    })
  })

  describe("执行后检查点决策", () => {
    it("应该在命令失败时创建检查点", async () => {
      const decision = await decisionEngine.shouldCreateCheckpointAfterExecution(
        "some-command",
        false, // 执行失败
        "Command failed",
        "/bin/bash"
      )
      expect(decision.shouldCheckpoint).toBe(true)
      expect(decision.reason).toBe("command_failed")
    })

    it("应该在高风险命令执行后创建检查点", async () => {
      settings.checkpointAfterHighRiskCommands = true
      decisionEngine = new CheckpointDecisionEngine(settings)

      const decision = await decisionEngine.shouldCreateCheckpointAfterExecution(
        "rm -rf /tmp",
        true, // 执行成功
        undefined,
        "/bin/bash"
      )
      expect(decision.shouldCheckpoint).toBe(true)
      expect(decision.reason).toBe("high_risk_after_execution")
    })

    it("不应该为低风险命令创建执行后检查点", async () => {
      const decision = await decisionEngine.shouldCreateCheckpointAfterExecution(
        "ls -la",
        true,
        undefined,
        "/bin/bash"
      )
      expect(decision.shouldCheckpoint).toBe(false)
      expect(decision.reason).toBe("no_checkpoint_needed_after")
    })
  })

  describe("检查点禁用", () => {
    it("应该在检查点禁用时返回false", async () => {
      settings.enableCheckpoints = false
      decisionEngine = new CheckpointDecisionEngine(settings)

      const decision = await decisionEngine.shouldCreateCheckpoint("rm -rf /", "/bin/bash")
      expect(decision.shouldCheckpoint).toBe(false)
      expect(decision.reason).toBe("checkpoint_disabled")
    })
  })

  describe("Shell特定配置获取", () => {
    it("应该返回Shell特定配置", () => {
      const config = decisionEngine.getShellSpecificCheckpointSettings(
        "test-command",
        ShellType.BASH
      )

      expect(config.checkpointBeforeHighRiskCommands).toBe(true)
      expect(config.riskLevel).toBeDefined()
      expect(config.shellType).toBe(ShellType.BASH)
    })

    it("应该支持自定义设置", () => {
      const customSettings: GlobalSettings = {
        ...settings,
        checkpointBeforeHighRiskCommands: false
      } as GlobalSettings

      const config = decisionEngine.getShellSpecificCheckpointSettings(
        "test-command",
        ShellType.BASH,
        customSettings
      )

      expect(config.checkpointBeforeHighRiskCommands).toBe(false)
    })
  })
})