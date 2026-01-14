import type { GlobalSettings } from "@roo-code/types"
import { getShell } from "../../utils/shell"

/**
 * Risk levels for terminal commands
 */
export enum CommandRiskLevel {
  LOW = "low",
  MEDIUM = "medium", 
  HIGH = "high",
  CRITICAL = "critical"
}

/**
 * Shell types supported by the checkpoint system
 */
export enum ShellType {
  POWERSHELL = "powershell",
  BASH = "bash",
  ZSH = "zsh",
  CMD = "cmd",
  FISH = "fish",
  UNKNOWN = "unknown"
}

/**
 * Checkpoint decision result
 */
export interface CheckpointDecision {
  shouldCheckpoint: boolean
  reason: string
  riskLevel?: CommandRiskLevel
  confidence?: number
}

/**
 * Shell-specific configuration for checkpoint rules
 */
export interface ShellCheckpointConfig {
  checkpointBeforeHighRiskCommands?: boolean
  checkpointAfterHighRiskCommands?: boolean
  checkpointOnCommandError?: boolean
  checkpointCommands?: string[]
  noCheckpointCommands?: string[]
  riskLevel?: CommandRiskLevel
  shellType?: ShellType
}

/**
 * Checkpoint decision engine for determining when to create checkpoints
 * for terminal command execution
 */
export class CheckpointDecisionEngine {
  private settings: GlobalSettings

  constructor(settings: GlobalSettings) {
    this.settings = settings
  }

  /**
   * Determine if a checkpoint should be created for a given command
   */
  async shouldCreateCheckpoint(
    command: string,
    shellPath?: string
  ): Promise<CheckpointDecision> {
    // Check if checkpoints are globally enabled
    if (!this.settings.enableCheckpoints) {
      return { shouldCheckpoint: false, reason: "checkpoint_disabled" }
    }

    const shellType = this.detectShellType(shellPath)
    const shellConfig = this.getShellSpecificConfig(shellType)

    // Check if command is explicitly exempted from checkpoints
    if (this.isNoCheckpointCommand(command, shellConfig)) {
      return { shouldCheckpoint: false, reason: "command_exempted" }
    }

    // Check if command explicitly requires checkpoints
    if (this.isCheckpointCommand(command, shellConfig)) {
      return { shouldCheckpoint: true, reason: "command_required" }
    }

    // Assess risk level and make decision based on risk
    const riskLevel = this.assessCommandRisk(command, shellType)
    return this.decideByRiskLevel(riskLevel, shellConfig)
  }

  /**
   * Detect shell type from shell path
   */
  private detectShellType(shellPath?: string): ShellType {
    // If no shell path provided, use the system's detected shell
    if (!shellPath) {
      shellPath = getShell()
    }

    const path = shellPath.toLowerCase()
    
    if (path.includes("powershell") || path.includes("pwsh")) {
      return ShellType.POWERSHELL
    } else if (path.includes("bash")) {
      return ShellType.BASH
    } else if (path.includes("zsh")) {
      return ShellType.ZSH
    } else if (path.includes("cmd") || path.includes("command")) {
      return ShellType.CMD
    } else if (path.includes("fish")) {
      return ShellType.FISH
    } else if (path.includes("sh") && !path.includes("bash") && !path.includes("zsh")) {
      return ShellType.BASH // Treat generic sh as bash for risk assessment
    }

    return ShellType.UNKNOWN
  }

  /**
   * Get shell-specific configuration
   */
  private getShellSpecificConfig(shellType: ShellType): ShellCheckpointConfig {
    const shellSpecific = this.settings.checkpointShellSpecific || {}
    const globalConfig: ShellCheckpointConfig = {
      checkpointBeforeHighRiskCommands: this.settings.checkpointBeforeHighRiskCommands,
      checkpointAfterHighRiskCommands: this.settings.checkpointAfterHighRiskCommands,
      checkpointOnCommandError: this.settings.checkpointOnCommandError,
      checkpointCommands: this.settings.checkpointCommands,
      noCheckpointCommands: this.settings.noCheckpointCommands
    }

    // Merge global config with shell-specific config
    const shellConfig = shellSpecific[shellType] || {}
    return {
      ...globalConfig,
      ...shellConfig
    }
  }

  /**
   * Get shell-specific checkpoint configuration for a command
   * This function provides a public interface for external components to access
   * shell-specific checkpoint settings based on command and shell type
   */
  public getShellSpecificCheckpointSettings(
    command: string,
    shellType: ShellType,
    settings?: GlobalSettings
  ): ShellCheckpointConfig {
    const config = settings || this.settings
    const shellSpecific = config.checkpointShellSpecific || {}
    const globalConfig: ShellCheckpointConfig = {
      checkpointBeforeHighRiskCommands: config.checkpointBeforeHighRiskCommands,
      checkpointAfterHighRiskCommands: config.checkpointAfterHighRiskCommands,
      checkpointOnCommandError: config.checkpointOnCommandError,
      checkpointCommands: config.checkpointCommands,
      noCheckpointCommands: config.noCheckpointCommands
    }

    // Merge global config with shell-specific config
    const shellConfig = shellSpecific[shellType] || {}
    const mergedConfig = {
      ...globalConfig,
      ...shellConfig
    }

    // Add command-specific information to the config
    const commandRisk = this.assessCommandRisk(command, shellType)
    return {
      ...mergedConfig,
      riskLevel: commandRisk,
      shellType
    }
  }

  /**
   * Check if command is exempted from checkpoints
   */
  private isNoCheckpointCommand(command: string, config: ShellCheckpointConfig): boolean {
    const noCheckpointCommands = config.noCheckpointCommands || []
    return this.findLongestPrefixMatch(command, noCheckpointCommands) !== null
  }

  /**
   * Check if command explicitly requires checkpoints
   */
  private isCheckpointCommand(command: string, config: ShellCheckpointConfig): boolean {
    const checkpointCommands = config.checkpointCommands || []
    return this.findLongestPrefixMatch(command, checkpointCommands) !== null
  }

  /**
   * Find the longest prefix match between command and a list of patterns
   */
  private findLongestPrefixMatch(command: string, patterns: string[]): string | null {
    const normalizedCommand = command.trim().toLowerCase()
    let longestMatch: string | null = null
    let longestLength = 0

    for (const pattern of patterns) {
      const normalizedPattern = pattern.trim().toLowerCase()
      if (normalizedCommand.startsWith(normalizedPattern)) {
        if (normalizedPattern.length > longestLength) {
          longestLength = normalizedPattern.length
          longestMatch = pattern
        }
      }
    }

    return longestMatch
  }

  /**
   * Assess risk level of a command
   */
  private assessCommandRisk(command: string, shellType: ShellType): CommandRiskLevel {
    const normalizedCommand = command.trim().toLowerCase()

    // Check for critical patterns first (most specific patterns)
    const criticalPatterns = this.getCriticalPatterns(shellType)
    for (const pattern of criticalPatterns) {
      // For critical patterns, check if the command starts with the pattern
      // or contains it as a complete word (followed by space or end of string)
      if (pattern.endsWith("$")) {
        // Exact match patterns (remove $ and check for exact match)
        const exactPattern = pattern.slice(0, -1)
        if (normalizedCommand === exactPattern || normalizedCommand.startsWith(exactPattern + " ")) {
          return CommandRiskLevel.CRITICAL
        }
      } else if (normalizedCommand.includes(pattern)) {
        return CommandRiskLevel.CRITICAL
      }
    }

    // Check for high-risk patterns - use exact word matching
    const highRiskPatterns = this.getHighRiskPatterns(shellType)
    for (const pattern of highRiskPatterns) {
      // Check if the pattern appears as a complete word in the command
      if (this.isExactWordInCommand(normalizedCommand, pattern)) {
        return CommandRiskLevel.HIGH
      }
    }

    // Check for medium-risk patterns - use exact word matching
    const mediumRiskPatterns = this.getMediumRiskPatterns(shellType)
    for (const pattern of mediumRiskPatterns) {
      // Check if the pattern appears as a complete word in the command
      if (this.isExactWordInCommand(normalizedCommand, pattern)) {
        return CommandRiskLevel.MEDIUM
      }
    }

    return CommandRiskLevel.LOW
  }

  /**
   * Check if a pattern appears as an exact word in the command
   */
  private isExactWordInCommand(command: string, pattern: string): boolean {
    // Handle patterns that end with space (like "rm ")
    if (pattern.endsWith(" ")) {
      const patternWithoutSpace = pattern.slice(0, -1)
      return command.startsWith(patternWithoutSpace + " ")
    }
    
    // If pattern contains spaces, check if command starts with pattern followed by space or end
    if (pattern.includes(" ")) {
      return command.startsWith(pattern + " ") || command === pattern
    }
    
    // For single-word patterns, check if it appears as a complete word
    const words = command.split(" ")
    return words.includes(pattern)
  }

  /**
   * Check if a pattern appears in a string with word boundaries
   */
  private hasWordBoundaryMatch(text: string, pattern: string): boolean {
    // For patterns without trailing space, use simple includes
    return text.includes(pattern)
  }

  /**
   * Get critical risk patterns for a shell type
   */
  private getCriticalPatterns(shellType: ShellType): string[] {
    const commonPatterns = [
      "rm -rf /$", // Match exactly "rm -rf /"
      "rm -rf /etc$",
      "rm -rf /usr$",
      "rm -rf /var$",
      "rm -rf /home$",
      "rm -rf /root$",
      "dd if=/dev/zero of=/",
      "mkfs /",
      "fdisk /",
      ":(){ :|:& };:", // Fork bomb
      "sudo rm -rf /$",
      "sudo dd if=/dev/zero of=/",
      "sudo mkfs /",
      "sudo fdisk /"
    ]

    if (shellType === ShellType.POWERSHELL) {
      return [
        ...commonPatterns,
        "remove-item -recurse -force c:\\windows",
        "remove-item -recurse -force c:\\program files",
        "remove-item -recurse -force c:\\program files (x86)",
        "format-volume",
        "clear-content c:\\windows\\system32",
        "clear-content c:\\windows\\syswow64",
        "stop-process -name explorer",
        "stop-computer -force",
        "restart-computer -force"
      ]
    }

    if (shellType === ShellType.CMD) {
      return [
        ...commonPatterns,
        "del /f /s /q c:\\windows",
        "rd /s /q c:\\windows",
        "format c:",
        "format d:",
        "taskkill /f /im explorer.exe",
        "shutdown /s /f /t 0",
        "wmic os where primary=true call shutdown"
      ]
    }

    return commonPatterns
  }

  /**
   * Get high-risk patterns for a shell type
   */
  private getHighRiskPatterns(shellType: ShellType): string[] {
    const commonPatterns = [
      "rm -rf /", // Specific to root directory
      "rm -rf", // Match rm -rf without space to avoid matching "rm file.txt"
      "chmod 000",
      "chown root",
      "mv /",
      "cp /",
      "git reset --hard",
      "git clean -fdx",
      "find / -delete",
      "shutdown",
      "reboot",
      "killall",
      "pkill",
      "sudo rm -rf",
      "sudo chmod 000",
      "sudo chown root",
      "sudo mv /",
      "sudo cp /",
      "sudo find / -delete",
      "sudo shutdown",
      "sudo reboot"
    ]

    if (shellType === ShellType.POWERSHELL) {
      return [
        ...commonPatterns,
        "remove-item -recurse -force",
        "clear-item",
        "stop-computer",
        "restart-computer",
        "stop-process",
        "remove-variable",
        "clear-variable",
        "set-executionpolicy bypass",
        "set-executionpolicy unrestricted"
      ]
    }

    if (shellType === ShellType.CMD) {
      return [
        ...commonPatterns,
        "del /f /s /q",
        "rd /s /q",
        "format",
        "taskkill /f",
        "wmic",
        "reg delete",
        "reg add",
        "sc delete",
        "sc create"
      ]
    }

    if (shellType === ShellType.ZSH || shellType === ShellType.BASH) {
      return [
        ...commonPatterns,
        "source",
        ".",
        "eval",
        "exec",
        "python -c",
        "python3 -c",
        "node -e",
        "ruby -e"
      ]
    }

    return commonPatterns
  }

  /**
   * Get medium-risk patterns for a shell type
   */
  private getMediumRiskPatterns(shellType: ShellType): string[] {
    const commonPatterns = [
      "rm ",
      "mv ",
      "cp ",
      "chmod ",
      "chown ",
      "git checkout --",
      "git stash drop",
      "npm uninstall",
      "pip uninstall",
      "apt remove",
      "apt purge",
      "yum remove",
      "dnf remove",
      "pacman -R",
      "brew uninstall",
      "docker rm",
      "docker rmi",
      "kubectl delete"
    ]

    if (shellType === ShellType.POWERSHELL) {
      return [
        ...commonPatterns,
        "remove-item",
        "move-item",
        "copy-item",
        "npm remove",
        "uninstall-module",
        "uninstall-package",
        "docker rm",
        "docker rmi",
        "kubectl delete"
      ]
    }

    if (shellType === ShellType.CMD) {
      return [
        ...commonPatterns,
        "del ",
        "move ",
        "copy ",
        "xcopy ",
        "robocopy ",
        "ren ",
        "rename "
      ]
    }

    if (shellType === ShellType.ZSH || shellType === ShellType.BASH) {
      return [
        ...commonPatterns,
        "export",
        "alias",
        "unalias",
        "history -c",
        "source ~/",
        ". ~/"
      ]
    }

    return commonPatterns
  }

  /**
   * Make checkpoint decision based on risk level and configuration
   */
  private decideByRiskLevel(
    riskLevel: CommandRiskLevel,
    config: ShellCheckpointConfig
  ): CheckpointDecision {
    const shouldCheckpointBefore = config.checkpointBeforeHighRiskCommands || false
    const shouldCheckpointAfter = config.checkpointAfterHighRiskCommands || false

    switch (riskLevel) {
      case CommandRiskLevel.CRITICAL:
        // Critical risk commands always create checkpoints before execution
        return {
          shouldCheckpoint: true,
          reason: "critical_risk",
          riskLevel,
          confidence: 0.95
        }

      case CommandRiskLevel.HIGH:
        return {
          shouldCheckpoint: shouldCheckpointBefore,
          reason: "high_risk",
          riskLevel,
          confidence: 0.85
        }

      case CommandRiskLevel.MEDIUM:
        return {
          shouldCheckpoint: shouldCheckpointBefore,
          reason: "medium_risk",
          riskLevel,
          confidence: 0.70
        }

      case CommandRiskLevel.LOW:
      default:
        return {
          shouldCheckpoint: false,
          reason: "low_risk",
          riskLevel,
          confidence: 0.90
        }
    }
  }

  /**
   * Determine if a checkpoint should be created after command execution
   */
  async shouldCreateCheckpointAfterExecution(
    command: string,
    executedSuccessfully: boolean,
    error?: string,
    shellPath?: string
  ): Promise<CheckpointDecision> {
    // Check if checkpoints are globally enabled
    if (!this.settings.enableCheckpoints) {
      return { shouldCheckpoint: false, reason: "checkpoint_disabled" }
    }

    const shellType = this.detectShellType(shellPath)
    const shellConfig = this.getShellSpecificConfig(shellType)

    // Check if command is explicitly exempted from checkpoints
    if (this.isNoCheckpointCommand(command, shellConfig)) {
      return { shouldCheckpoint: false, reason: "command_exempted" }
    }

    // Check if checkpoint on error is enabled and command failed
    if (shellConfig.checkpointOnCommandError && !executedSuccessfully) {
      return {
        shouldCheckpoint: true,
        reason: "command_failed",
        confidence: 0.80
      }
    }

    // Check if command explicitly requires checkpoints after execution
    if (this.isCheckpointCommand(command, shellConfig)) {
      return { shouldCheckpoint: true, reason: "command_required_after" }
    }

    // Assess risk level and make decision based on risk
    const riskLevel = this.assessCommandRisk(command, shellType)
    
    // For after-execution, only create checkpoints for high/critical risk if configured
    const shouldCheckpointAfter = shellConfig.checkpointAfterHighRiskCommands || false
    
    if ((riskLevel === CommandRiskLevel.CRITICAL || riskLevel === CommandRiskLevel.HIGH) && shouldCheckpointAfter) {
      return {
        shouldCheckpoint: true,
        reason: "high_risk_after_execution",
        riskLevel,
        confidence: 0.75
      }
    }

    return {
      shouldCheckpoint: false,
      reason: "no_checkpoint_needed_after",
      riskLevel,
      confidence: 0.90
    }
  }

  /**
   * Update settings (useful when settings change)
   */
  updateSettings(settings: GlobalSettings): void {
    this.settings = settings
  }
}