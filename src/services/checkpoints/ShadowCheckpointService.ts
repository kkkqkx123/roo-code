import fs from "fs/promises"
import os from "os"
import * as path from "path"
import crypto from "crypto"
import EventEmitter from "events"

import simpleGit, { SimpleGit, SimpleGitOptions } from "simple-git"
import pWaitFor from "p-wait-for"
import * as vscode from "vscode"

import { fileExistsAtPath } from "../../utils/fs"
import { executeRipgrep } from "../../services/search/file-search"
import { t } from "../../i18n"

import { CheckpointDiff, CheckpointResult, CheckpointEventMap } from "./types"
import { getExcludePatterns } from "./excludes"

/**
 * Creates a SimpleGit instance with sanitized environment variables to prevent
 * interference from inherited git environment variables like GIT_DIR and GIT_WORK_TREE.
 * This ensures checkpoint operations always target the intended shadow repository.
 *
 * @param baseDir - The directory where git operations should be executed
 * @returns A SimpleGit instance with sanitized environment
 */
function createSanitizedGit(baseDir: string): SimpleGit {
	// Create a clean environment by explicitly unsetting git-related environment variables
	// that could interfere with checkpoint operations
	const sanitizedEnv: Record<string, string> = {}
	const removedVars: string[] = []

	// Copy all environment variables except git-specific ones
	for (const [key, value] of Object.entries(process.env)) {
		// Skip git environment variables that would override repository location
		if (
			key === "GIT_DIR" ||
			key === "GIT_WORK_TREE" ||
			key === "GIT_INDEX_FILE" ||
			key === "GIT_OBJECT_DIRECTORY" ||
			key === "GIT_ALTERNATE_OBJECT_DIRECTORIES" ||
			key === "GIT_CEILING_DIRECTORIES"
		) {
			removedVars.push(`${key}=${value}`)
			continue
		}

		// Only include defined values
		if (value !== undefined) {
			sanitizedEnv[key] = value
		}
	}

	// Log which git env vars were removed (helps with debugging Dev Container issues)
	if (removedVars.length > 0) {
		console.log(
			`[createSanitizedGit] Removed git environment variables for checkpoint isolation: ${removedVars.join(", ")}`,
		)
	}

	const options: Partial<SimpleGitOptions> = {
		baseDir,
		config: [],
	}

	// Create git instance and set the sanitized environment
	const git = simpleGit(options)

	// Use the .env() method to set the complete sanitized environment
	// This replaces the inherited environment with our sanitized version
	git.env(sanitizedEnv)

	console.log(`[createSanitizedGit] Created git instance for baseDir: ${baseDir}`)

	return git
}

export abstract class ShadowCheckpointService extends EventEmitter {
	public readonly taskId: string
	public readonly checkpointsDir: string
	public readonly workspaceDir: string

	protected _checkpoints: string[] = []
	protected _baseHash?: string

	protected readonly dotGitDir: string
	protected git?: SimpleGit
	protected readonly log: (message: string) => void
	protected shadowGitConfigWorktree?: string

	public get baseHash() {
		return this._baseHash
	}

	protected set baseHash(value: string | undefined) {
		this._baseHash = value
	}

	public get isInitialized() {
		return !!this.git
	}

	public getCheckpoints(): string[] {
		return this._checkpoints.slice()
	}

	constructor(taskId: string, checkpointsDir: string, workspaceDir: string, log: (message: string) => void) {
		super()

		const homedir = os.homedir()
		const desktopPath = path.join(homedir, "Desktop")
		const documentsPath = path.join(homedir, "Documents")
		const downloadsPath = path.join(homedir, "Downloads")
		const protectedPaths = [homedir, desktopPath, documentsPath, downloadsPath]

		if (protectedPaths.includes(workspaceDir)) {
			throw new Error(`Cannot use checkpoints in ${workspaceDir}`)
		}

		this.taskId = taskId
		this.checkpointsDir = checkpointsDir
		this.workspaceDir = workspaceDir

		this.dotGitDir = path.join(this.checkpointsDir, ".git")
		this.log = log
	}

	public async initShadowGit(onInit?: () => Promise<void>) {
		this.log(`[${this.constructor.name}#initShadowGit] starting initialization`)
		
		if (this.git) {
			throw new Error("Shadow git repo already initialized")
		}

		const nestedGitPath = await this.getNestedGitRepository()

		if (nestedGitPath) {
			const relativePath = path.relative(this.workspaceDir, nestedGitPath)
			const message = t("common:errors.nested_git_repos_warning", { path: relativePath })
			vscode.window.showErrorMessage(message)

			throw new Error(
				`Checkpoints are disabled because a nested git repository was detected at: ${relativePath}. ` +
					"Please remove or relocate nested git repositories to use the checkpoints feature.",
			)
		}

		await fs.mkdir(this.checkpointsDir, { recursive: true })
		const git = createSanitizedGit(this.checkpointsDir)
		const gitVersion = await git.version()
		this.log(`[${this.constructor.name}#initShadowGit] git version = ${gitVersion}`)

		let created = false
		const startTime = Date.now()

		if (await fileExistsAtPath(this.dotGitDir)) {
			this.log(`[${this.constructor.name}#initShadowGit] shadow git repo already exists at ${this.dotGitDir}`)
			
			// Check if the existing shadow repo is valid
			try {
				const worktree = await this.getShadowGitConfigWorktree(git)

				if (worktree !== this.workspaceDir) {
					throw new Error(
						`Checkpoints can only be used in the original workspace: ${worktree} !== ${this.workspaceDir}`,
					)
				}

				await this.writeExcludeFile()
				this.log(`[${this.constructor.name}#initShadowGit] attempting to get shadow repo HEAD`)
				this.baseHash = await git.revparse(["HEAD"])
				this.log(`[${this.constructor.name}#initShadowGit] got shadow repo HEAD: ${this.baseHash}`)
			} catch (error) {
				this.log(`[${this.constructor.name}#initShadowGit] existing shadow repo is invalid: ${error}`)
				this.log(`[${this.constructor.name}#initShadowGit] removing invalid shadow repo and recreating`)
				// Remove the invalid shadow repo and recreate it
			await fs.rm(this.checkpointsDir, { recursive: true, force: true })
			await fs.mkdir(this.checkpointsDir, { recursive: true })
			// Continue with creating a new shadow repo using the existing logic
			const hasGitRepo = await this.hasGitRepository(this.workspaceDir)
			
			if (hasGitRepo) {
				this.log(`[${this.constructor.name}#initShadowGit] detected git repository, using alternates`)
				
				const gitObjectsPath = await this.getGitObjectsPath(this.workspaceDir)
				
				if (gitObjectsPath) {
					await git.init()
					await git.addConfig("core.worktree", this.workspaceDir)
					await git.addConfig("commit.gpgSign", "false")
					await git.addConfig("user.name", "Roo Code")
					await git.addConfig("user.email", "noreply@example.com")
					await git.addConfig("gc.auto", "0")
					await git.addConfig("gc.autoDetach", "false")
					await this.setupGitAlternates(gitObjectsPath)
					
					// Get the workspace repository's HEAD before we set up the shadow repo environment
					try {
						this.log(`[${this.constructor.name}#initShadowGit] attempting to get workspace HEAD from ${this.workspaceDir}`)
						
						// Temporarily clear GIT_DIR to ensure we access the workspace repository, not the external one
						const originalGitDir = process.env.GIT_DIR
						if (originalGitDir) {
							delete process.env.GIT_DIR
							this.log(`[${this.constructor.name}#initShadowGit] temporarily cleared GIT_DIR: ${originalGitDir}`)
						}
						
						try {
							const workspaceGit = simpleGit(this.workspaceDir)
							this.log(`[${this.constructor.name}#initShadowGit] created workspace git instance`)
							const workspaceHead = await workspaceGit.revparse(["HEAD"])
							this.baseHash = workspaceHead
							this.log(`[${this.constructor.name}#initShadowGit] using workspace HEAD: ${this.baseHash}`)
						} finally {
							// Restore GIT_DIR if it was set
							if (originalGitDir) {
								process.env.GIT_DIR = originalGitDir
								this.log(`[${this.constructor.name}#initShadowGit] restored GIT_DIR: ${originalGitDir}`)
							}
						}
					} catch (error) {
						this.log(`[${this.constructor.name}#initShadowGit] failed to get workspace HEAD: ${error}`)
						// If workspace doesn't have a HEAD, create an initial commit in the shadow repo
						this.log(`[${this.constructor.name}#initShadowGit] creating initial commit in shadow repo`)
						const { commit } = await git.commit("initial commit", { "--allow-empty": null })
						this.baseHash = commit
						this.log(`[${this.constructor.name}#initShadowGit] created initial commit: ${this.baseHash}`)
					}
					
					await this.writeExcludeFile()
				} else {
					throw new Error("Could not determine git objects path")
				}
			} else {
				// No git repository in workspace, create a standalone shadow repo
				this.log(`[${this.constructor.name}#initShadowGit] no git repository detected, creating standalone shadow repo`)
				await git.init()
				await git.addConfig("core.worktree", this.workspaceDir)
				await git.addConfig("commit.gpgSign", "false")
				await git.addConfig("user.name", "Roo Code")
				await git.addConfig("user.email", "noreply@example.com")
				await git.addConfig("gc.auto", "0")
				await git.addConfig("gc.autoDetach", "false")
				
				// Create an initial commit
				this.log(`[${this.constructor.name}#initShadowGit] creating initial commit in shadow repo`)
				const { commit } = await git.commit("initial commit", { "--allow-empty": null })
				this.baseHash = commit
				this.log(`[${this.constructor.name}#initShadowGit] created initial commit: ${this.baseHash}`)
				
				await this.writeExcludeFile()
			}
			}
		} else {
			this.log(`[${this.constructor.name}#initShadowGit] creating shadow git repo at ${this.checkpointsDir}`)

			const hasGitRepo = await this.hasGitRepository(this.workspaceDir)

			if (hasGitRepo) {
				this.log(`[${this.constructor.name}#initShadowGit] detected git repository, using alternates`)

				const gitObjectsPath = await this.getGitObjectsPath(this.workspaceDir)

				if (gitObjectsPath) {
					await git.init()
					await git.addConfig("core.worktree", this.workspaceDir)
					await git.addConfig("commit.gpgSign", "false")
					await git.addConfig("user.name", "Roo Code")
					await git.addConfig("user.email", "noreply@example.com")
					await git.addConfig("gc.auto", "0")
					await git.addConfig("gc.autoDetach", "false")
					await this.setupGitAlternates(gitObjectsPath)
					await this.writeExcludeFile()

					try {
						// Get the workspace repository's HEAD before we set up the shadow repo environment
						// This avoids potential git environment conflicts
						this.log(`[${this.constructor.name}#initShadowGit] attempting to get workspace HEAD from ${this.workspaceDir}`)
						
						// Temporarily clear GIT_DIR to ensure we access the workspace repository, not the external one
						const originalGitDir = process.env.GIT_DIR
						if (originalGitDir) {
							delete process.env.GIT_DIR
							this.log(`[${this.constructor.name}#initShadowGit] temporarily cleared GIT_DIR: ${originalGitDir}`)
						}
						
						try {
							const workspaceGit = simpleGit(this.workspaceDir)
							this.log(`[${this.constructor.name}#initShadowGit] created workspace git instance`)
							const workspaceHead = await workspaceGit.revparse(["HEAD"])
							this.baseHash = workspaceHead
							this.log(`[${this.constructor.name}#initShadowGit] using workspace HEAD: ${this.baseHash}`)
						} finally {
							// Restore GIT_DIR if it was set
							if (originalGitDir) {
								process.env.GIT_DIR = originalGitDir
								this.log(`[${this.constructor.name}#initShadowGit] restored GIT_DIR: ${originalGitDir}`)
							}
						}
					} catch (error) {
						this.log(`[${this.constructor.name}#initShadowGit] failed to get workspace HEAD: ${error}`)
						this.log(`[${this.constructor.name}#initShadowGit] error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
						this.log(`[${this.constructor.name}#initShadowGit] error message: ${error instanceof Error ? error.message : String(error)}`)
						// If workspace doesn't have a HEAD, create an initial commit in the shadow repo
						this.log(`[${this.constructor.name}#initShadowGit] creating initial commit in shadow repo`)
						const { commit } = await git.commit("initial commit", { "--allow-empty": null })
						this.baseHash = commit
						this.log(`[${this.constructor.name}#initShadowGit] created initial commit: ${this.baseHash}`)
					}

					created = true
				} else {
					this.log(`[${this.constructor.name}#initShadowGit] could not get git objects path, falling back to regular init`)
					await this.initializeRegularRepo(git)
					created = true
				}
			} else {
				this.log(`[${this.constructor.name}#initShadowGit] no git repository detected, using regular init`)
				await this.initializeRegularRepo(git)
				created = true
			}
		}

		const duration = Date.now() - startTime

		this.log(
			`[${this.constructor.name}#initShadowGit] initialized shadow repo with base commit ${this.baseHash} in ${duration}ms`,
		)

		this.git = git
		this.log(`[${this.constructor.name}#initShadowGit] set this.git instance: ${this.git ? 'SUCCESS' : 'FAILED'}`)

		await onInit?.()

		if (!this.baseHash) {
			throw new Error("Base hash was not set during initialization")
		}

		this.emit("initialize", {
			type: "initialize",
			workspaceDir: this.workspaceDir,
			baseHash: this.baseHash,
			created,
			duration,
		})

		this.log(`[${this.constructor.name}#initShadowGit] initialization complete - git instance: ${this.git ? 'SET' : 'NOT SET'}, baseHash: ${this.baseHash}`)
		return { created, duration }
	}

	// Add basic excludes directly in git config, while respecting any
	// .gitignore in the workspace.
	// .git/info/exclude is local to the shadow git repo, so it's not
	// shared with the main repo - and won't conflict with user's
	// .gitignore.
	protected async writeExcludeFile() {
		await fs.mkdir(path.join(this.dotGitDir, "info"), { recursive: true })
		const patterns = await getExcludePatterns(this.workspaceDir)
		await fs.writeFile(path.join(this.dotGitDir, "info", "exclude"), patterns.join("\n"))
	}

	private async stageAll(git: SimpleGit) {
		try {
			await git.add([".", "--ignore-errors"])
		} catch (error) {
			this.log(
				`[${this.constructor.name}#stageAll] failed to add files to git: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async getNestedGitRepository(): Promise<string | null> {
		try {
			// Find all .git/HEAD files that are not at the root level.
			const args = ["--files", "--hidden", "--follow", "-g", "**/.git/HEAD", this.workspaceDir]

			const gitPaths = await executeRipgrep({ args, workspacePath: this.workspaceDir })

			// Filter to only include nested git directories (not the root .git).
			// Since we're searching for HEAD files, we expect type to be "file"
			const nestedGitPaths = gitPaths.filter(({ type, path: filePath }) => {
				// Check if it's a file and is a nested .git/HEAD (not at root)
				if (type !== "file") return false

				// Ensure it's a .git/HEAD file and not the root one
				const normalizedPath = filePath.replace(/\\/g, "/")
				return (
					normalizedPath.includes(".git/HEAD") &&
					!normalizedPath.startsWith(".git/") &&
					normalizedPath !== ".git/HEAD"
				)
			})

			if (nestedGitPaths.length > 0) {
				// Get the first nested git repository path
				// Remove .git/HEAD from the path to get the repository directory
				const headPath = nestedGitPaths[0].path

				// Use path module to properly extract the repository directory
				// The HEAD file is at .git/HEAD, so we need to go up two directories
				const gitDir = path.dirname(headPath) // removes HEAD, gives us .git
				const repoDir = path.dirname(gitDir) // removes .git, gives us the repo directory

				const absolutePath = path.join(this.workspaceDir, repoDir)

				this.log(
					`[${this.constructor.name}#getNestedGitRepository] found ${nestedGitPaths.length} nested git repositories, first at: ${repoDir}`,
				)
				return absolutePath
			}

			return null
		} catch (error) {
			this.log(
				`[${this.constructor.name}#getNestedGitRepository] failed to check for nested git repos: ${error instanceof Error ? error.message : String(error)}`,
			)

			// If we can't check, assume there are no nested repos to avoid blocking the feature.
			return null
		}
	}

	private async getShadowGitConfigWorktree(git: SimpleGit) {
		if (!this.shadowGitConfigWorktree) {
			try {
				this.shadowGitConfigWorktree = (await git.getConfig("core.worktree")).value || undefined
			} catch (error) {
				this.log(
					`[${this.constructor.name}#getShadowGitConfigWorktree] failed to get core.worktree: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		return this.shadowGitConfigWorktree
	}

	private async hasGitRepository(workspaceDir: string): Promise<boolean> {
		const gitDir = path.join(workspaceDir, ".git")
		try {
			await fs.access(gitDir)
			return true
		} catch {
			return false
		}
	}

	private async getGitObjectsPath(workspaceDir: string): Promise<string | null> {
		const gitDir = path.join(workspaceDir, ".git")
		try {
			const gitDirStat = await fs.stat(gitDir)

			if (gitDirStat.isDirectory()) {
				const objectsPath = path.join(gitDir, "objects")
				await fs.access(objectsPath)
				return objectsPath
			} else if (gitDirStat.isFile()) {
				const gitFile = await fs.readFile(gitDir, "utf-8")
				const gitDirPath = gitFile.trim()
				const objectsPath = path.join(gitDirPath, "objects")
				await fs.access(objectsPath)
				return objectsPath
			}
		} catch {
			return null
		}

		return null
	}

	private async setupGitAlternates(gitObjectsPath: string): Promise<void> {
		const alternatesDir = path.join(this.dotGitDir, "objects", "info")
		await fs.mkdir(alternatesDir, { recursive: true })

		const normalizedPath = path.normalize(gitObjectsPath)
		const alternatesFile = path.join(alternatesDir, "alternates")
		await fs.writeFile(alternatesFile, normalizedPath)
	}

	private async initializeRegularRepo(git: SimpleGit): Promise<void> {
		await git.init()
		await git.addConfig("core.worktree", this.workspaceDir)
		await git.addConfig("commit.gpgSign", "false")
		await git.addConfig("user.name", "Roo Code")
		await git.addConfig("user.email", "noreply@example.com")
		await this.writeExcludeFile()
		await this.stageAll(git)
		const { commit } = await git.commit("initial commit", { "--allow-empty": null })
		this.baseHash = commit
	}

	public async saveCheckpoint(
		message: string,
		options?: { allowEmpty?: boolean; suppressMessage?: boolean },
	): Promise<CheckpointResult | undefined> {
		try {
			this.log(
				`[${this.constructor.name}#saveCheckpoint] starting checkpoint save (allowEmpty: ${options?.allowEmpty ?? false})`,
			)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const startTime = Date.now()
			await this.stageAll(this.git)
			
			// Check if there are any changes to commit
			const status = await this.git.status()
			this.log(`[${this.constructor.name}#saveCheckpoint] git status: staged=${status.staged.length}, not_added=${status.not_added.length}, modified=${status.modified.length}, deleted=${status.deleted.length}`)
			const hasChanges = status.staged.length > 0 || status.not_added.length > 0 || status.modified.length > 0 || status.deleted.length > 0
			
			if (!hasChanges && !options?.allowEmpty) {
				this.log(`[${this.constructor.name}#saveCheckpoint] no changes to commit`)
				return undefined
			}
			
			const commitArgs = options?.allowEmpty ? { "--allow-empty": null } : undefined
			const result = await this.git.commit(message, commitArgs)
			const fromHash = this._checkpoints[this._checkpoints.length - 1] ?? this.baseHash!
			const toHash = result.commit || fromHash
			this._checkpoints.push(toHash)
			const duration = Date.now() - startTime

			if (result.commit) {
				this.emit("checkpoint", {
					type: "checkpoint",
					fromHash,
					toHash,
					duration,
					suppressMessage: options?.suppressMessage ?? false,
				})
			}

			if (result.commit) {
				this.log(
					`[${this.constructor.name}#saveCheckpoint] checkpoint saved in ${duration}ms -> ${result.commit}`,
				)
				return result
			} else {
				this.log(`[${this.constructor.name}#saveCheckpoint] found no changes to commit in ${duration}ms`)
				return undefined
			}
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#saveCheckpoint] failed to create checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async restoreCheckpoint(commitHash: string) {
		try {
			this.log(`[${this.constructor.name}#restoreCheckpoint] starting checkpoint restore`)

			if (!this.git) {
				throw new Error("Shadow git repo not initialized")
			}

			const start = Date.now()
			await this.git.clean("f", ["-d", "-f"])
			await this.git.reset(["--hard", commitHash])

			// Remove all checkpoints after the specified commitHash.
			const checkpointIndex = this._checkpoints.indexOf(commitHash)

			if (checkpointIndex !== -1) {
				this._checkpoints = this._checkpoints.slice(0, checkpointIndex + 1)
			}

			const duration = Date.now() - start
			this.emit("restore", { type: "restore", commitHash, duration })
			this.log(`[${this.constructor.name}#restoreCheckpoint] restored checkpoint ${commitHash} in ${duration}ms`)
		} catch (e) {
			const error = e instanceof Error ? e : new Error(String(e))
			this.log(`[${this.constructor.name}#restoreCheckpoint] failed to restore checkpoint: ${error.message}`)
			this.emit("error", { type: "error", error })
			throw error
		}
	}

	public async getDiff({ from, to }: { from?: string; to?: string }): Promise<CheckpointDiff[]> {
		this.log(`[${this.constructor.name}#getDiff] called with from=${from}, to=${to}, git=${this.git ? 'SET' : 'NOT SET'}, baseHash=${this.baseHash}`)
		
		if (!this.git) {
			throw new Error("Shadow git repo not initialized")
		}

		const result = []

		// If no 'from' is specified, use the baseHash which represents the initial state
		if (!from) {
			from = this.baseHash
			if (!from) {
				throw new Error("Base hash not set - cannot determine initial state")
			}
			this.log(`[${this.constructor.name}#getDiff] using baseHash as from: ${from}`)
		}
		
		// Add detailed logging for the revision range
		this.log(`[${this.constructor.name}#getDiff] attempting diff with range: ${from}..${to}`)
		
		// Verify that both commit hashes exist in the repository
		this.log(`[${this.constructor.name}#getDiff] Verifying commit hashes exist in repository`)
		try {
			await this.git.show([from])
			this.log(`[${this.constructor.name}#getDiff] From commit ${from} exists`)
		} catch (error) {
			this.log(`[${this.constructor.name}#getDiff] From commit ${from} does not exist: ${error}`)
		}
		if (to) {
			try {
				await this.git.show(to)
				this.log(`[${this.constructor.name}#getDiff] To commit ${to} exists`)
			} catch (error) {
				this.log(`[${this.constructor.name}#getDiff] To commit ${to} does not exist: ${error}`)
			}
		}

		// Stage all changes so that untracked files appear in diff summary.
		await this.stageAll(this.git)

		this.log(`[${this.constructor.name}#getDiff] diffing ${to ? `${from}..${to}` : `${from}..HEAD`}`)
		const { files } = to ? await this.git.diffSummary([`${from}..${to}`]) : await this.git.diffSummary([from])

		const cwdPath = (await this.getShadowGitConfigWorktree(this.git)) || this.workspaceDir || ""

		for (const file of files) {
			const relPath = file.file
			const absPath = path.join(cwdPath, relPath)
			
			this.log(`[${this.constructor.name}#getDiff] processing file: ${relPath}`)
			
			// Get the content from the 'from' commit. If file doesn't exist there, it's empty.
			let before = ""
			try {
				before = await this.git.show([`${from}:${relPath}`])
				this.log(`[${this.constructor.name}#getDiff] got before content from ${from}:${relPath}: "${before}"`)
			} catch (error) {
				this.log(`[${this.constructor.name}#getDiff] file doesn't exist in from commit ${from}:${relPath}: ${error}`)
				// File doesn't exist in the from commit, so it's empty (new file)
				before = ""
			}

			// Get the content from the 'to' commit. If no 'to' specified, use current worktree.
			let after = ""
			if (to) {
				try {
					after = await this.git.show([`${to}:${relPath}`])
					this.log(`[${this.constructor.name}#getDiff] got after content from ${to}:${relPath}: "${after}"`)
				} catch (error) {
					this.log(`[${this.constructor.name}#getDiff] file doesn't exist in to commit ${to}:${relPath}: ${error}`)
					// File doesn't exist in the to commit, so it's empty (deleted file)
					after = ""
				}
			} else {
				// No 'to' specified, so diff against current worktree
				after = await fs.readFile(absPath, "utf8").catch(() => "")
			}

			this.log(`[${this.constructor.name}#getDiff] final before: "${before}", after: "${after}"`)
			result.push({ paths: { relative: relPath, absolute: absPath }, content: { before, after } })
		}

		return result
	}

	/**
	 * EventEmitter
	 */

	override emit<K extends keyof CheckpointEventMap>(event: K, data: CheckpointEventMap[K]) {
		return super.emit(event, data)
	}

	override on<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.on(event, listener)
	}

	override off<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.off(event, listener)
	}

	override once<K extends keyof CheckpointEventMap>(event: K, listener: (data: CheckpointEventMap[K]) => void) {
		return super.once(event, listener)
	}

	/**
	 * Storage
	 */

	public static hashWorkspaceDir(workspaceDir: string) {
		return crypto.createHash("sha256").update(workspaceDir).digest("hex").toString().slice(0, 8)
	}

	protected static taskRepoDir({ taskId, globalStorageDir }: { taskId: string; globalStorageDir: string }) {
		return path.join(globalStorageDir, "tasks", taskId, "checkpoints")
	}

	protected static workspaceRepoDir({
		globalStorageDir,
		workspaceDir,
	}: {
		globalStorageDir: string
		workspaceDir: string
	}) {
		return path.join(globalStorageDir, "checkpoints", this.hashWorkspaceDir(workspaceDir))
	}

	public static async deleteTask({
		taskId,
		globalStorageDir,
		workspaceDir,
	}: {
		taskId: string
		globalStorageDir: string
		workspaceDir: string
	}) {
		const workspaceRepoDir = this.workspaceRepoDir({ globalStorageDir, workspaceDir })
		const branchName = `roo-${taskId}`
		const git = createSanitizedGit(workspaceRepoDir)
		const success = await this.deleteBranch(git, branchName)

		if (success) {
			console.log(`[${this.name}#deleteTask.${taskId}] deleted branch ${branchName}`)
		} else {
			console.error(`[${this.name}#deleteTask.${taskId}] failed to delete branch ${branchName}`)
		}
	}

	public static async deleteBranch(git: SimpleGit, branchName: string) {
		const branches = await git.branchLocal()

		if (!branches.all.includes(branchName)) {
			console.error(`[${this.constructor.name}#deleteBranch] branch ${branchName} does not exist`)
			return false
		}

		const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"])

		if (currentBranch === branchName) {
			const worktree = await git.getConfig("core.worktree")

			try {
				await git.raw(["config", "--unset", "core.worktree"])
				await git.reset(["--hard"])
				await git.clean("f", ["-d"])
				const defaultBranch = branches.all.includes("main") ? "main" : "master"
				await git.checkout([defaultBranch, "--force"])

				await pWaitFor(
					async () => {
						const newBranch = await git.revparse(["--abbrev-ref", "HEAD"])
						return newBranch === defaultBranch
					},
					{ interval: 500, timeout: 2_000 },
				)

				await git.branch(["-D", branchName])
				return true
			} catch (error) {
				console.error(
					`[${this.constructor.name}#deleteBranch] failed to delete branch ${branchName}: ${error instanceof Error ? error.message : String(error)}`,
				)

				return false
			} finally {
				if (worktree.value) {
					await git.addConfig("core.worktree", worktree.value)
				}
			}
		} else {
			await git.branch(["-D", branchName])
			return true
		}
	}
}
