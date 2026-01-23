import * as path from "path"
import * as fs from "fs"
import { execSync } from "child_process"
const { resolve } = path

import { defineConfig, type PluginOption, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

import { sourcemapPlugin } from "./src/vite-plugins/sourcemapPlugin.js"

function getGitSha() {
	let gitSha: string | undefined = undefined

	try {
		gitSha = execSync("git rev-parse HEAD").toString().trim()
	} catch (_error) {
		// Do nothing.
	}

	return gitSha
}

const wasmPlugin = (): Plugin => ({
	name: "wasm",
	async load(id) {
		if (id.endsWith(".wasm")) {
			const buffer = await fs.promises.readFile(id)
			const bytes = Array.from(buffer)

			return `
            		const wasmModule = new WebAssembly.Module(new Uint8Array([${bytes.join(',')}]));
            		export default wasmModule;
          		`
		}
	},
})

const copyLocalesPlugin = (): Plugin => ({
	name: "copy-locales",
	async writeBundle() {
		const localesDir = path.resolve(__dirname, "src/i18n/locales")
		const outDir = path.resolve(__dirname, "../src/webview-ui/build/i18n/locales")

		try {
			await fs.promises.mkdir(outDir, { recursive: true })

			const languages = await fs.promises.readdir(localesDir)

			for (const language of languages) {
				const langDir = path.join(localesDir, language)
				const outLangDir = path.join(outDir, language)
				const stat = await fs.promises.stat(langDir)

				if (stat.isDirectory()) {
					await fs.promises.mkdir(outLangDir, { recursive: true })
					const files = await fs.promises.readdir(langDir)

					for (const file of files) {
						if (file.endsWith(".json")) {
							const srcFile = path.join(langDir, file)
							const destFile = path.join(outLangDir, file)
							await fs.promises.copyFile(srcFile, destFile)
						}
					}
				}
			}

			console.log("[copy-locales] Copied locale files to build directory")
		} catch (error) {
			console.warn("[copy-locales] Failed to copy locale files:", error)
		}
	},
})

const copyCodiconsPlugin = (): Plugin => ({
	name: "copy-codicons",
	async writeBundle() {
		const codiconsDir = path.resolve(__dirname, "node_modules/@vscode/codicons/dist")
		const outDir = path.resolve(__dirname, "../src/webview-ui/build/node_modules/@vscode/codicons/dist")

		try {
			await fs.promises.mkdir(outDir, { recursive: true })

			const files = await fs.promises.readdir(codiconsDir)

			for (const file of files) {
				if (file.endsWith(".css") || file.endsWith(".ttf") || file.endsWith(".svg") || file.endsWith(".woff") || file.endsWith(".woff2")) {
					const srcFile = path.join(codiconsDir, file)
					const destFile = path.join(outDir, file)
					await fs.promises.copyFile(srcFile, destFile)
				}
			}

			console.log("[copy-codicons] Copied codicon font files to build directory")
		} catch (error) {
			console.warn("[copy-codicons] Failed to copy codicon font files:", error)
		}
	},
})

const persistPortPlugin = (): Plugin => ({
	name: "write-port-to-file",
	configureServer(viteDevServer) {
		viteDevServer?.httpServer?.once("listening", () => {
			const address = viteDevServer?.httpServer?.address()
			const port = address && typeof address === "object" ? address.port : null

			if (port) {
				fs.writeFileSync(resolve(__dirname, "..", ".vite-port"), port.toString())
				console.log(`[Vite Plugin] Server started on port ${port}`)
			} else {
				console.warn("[Vite Plugin] Could not determine server port")
			}
		})
	},
})

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	let outDir = "../src/webview-ui/build"

	const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "src", "package.json"), "utf8"))
	const gitSha = getGitSha()

	const define: Record<string, any> = {
		"process.platform": JSON.stringify(process.platform),
		"process.env.VSCODE_TEXTMATE_DEBUG": JSON.stringify(process.env.VSCODE_TEXTMATE_DEBUG),
		"process.env.PKG_NAME": JSON.stringify(pkg.name),
		"process.env.PKG_VERSION": JSON.stringify(pkg.version),
		"process.env.PKG_OUTPUT_CHANNEL": JSON.stringify("Roo-Code"),
		...(gitSha ? { "process.env.PKG_SHA": JSON.stringify(gitSha) } : {}),
	}

	// TODO: We can use `@roo-code/build` to generate `define` once the
	// monorepo is deployed.
	if (mode === "nightly") {
		outDir = "../apps/vscode-nightly/build/webview-ui/build"

		const nightlyPkg = JSON.parse(
			fs.readFileSync(path.join(__dirname, "..", "apps", "vscode-nightly", "package.nightly.json"), "utf8"),
		)

		define["process.env.PKG_NAME"] = JSON.stringify(nightlyPkg.name)
		define["process.env.PKG_VERSION"] = JSON.stringify(nightlyPkg.version)
		define["process.env.PKG_OUTPUT_CHANNEL"] = JSON.stringify("Roo-Code-Nightly")
	}

	const plugins: PluginOption[] = [react(), tailwindcss(), copyLocalesPlugin(), copyCodiconsPlugin(), persistPortPlugin(), wasmPlugin(), sourcemapPlugin()]

	return {
		plugins,
		resolve: {
			alias: {
				"@": resolve(__dirname, "./src"),
				"@src": resolve(__dirname, "./src"),
				"@shared": resolve(__dirname, "../shared"),
				"@shared/types": resolve(__dirname, "../shared/types"),
				"@shared/types/*": resolve(__dirname, "../shared/types/*"),
				"@shared/schemas": resolve(__dirname, "../shared/schemas"),
				"@shared/schemas/*": resolve(__dirname, "../shared/schemas/*"),
				"@shared/utils": resolve(__dirname, "../shared/utils"),
				"@shared/utils/*": resolve(__dirname, "../shared/utils/*"),
				"@shared/constants": resolve(__dirname, "../shared/constants"),
				"@shared/constants/*": resolve(__dirname, "../shared/constants/*"),
				"@shared/config": resolve(__dirname, "../shared/config"),
				"@shared/config/*": resolve(__dirname, "../shared/config/*"),
				"@shared/i18n": resolve(__dirname, "../shared/i18n"),
				"@shared/i18n/*": resolve(__dirname, "../shared/i18n/*"),
			},
		},
		build: {
			outDir,
			emptyOutDir: true,
			reportCompressedSize: false,
			// Generate complete source maps with original TypeScript sources
			sourcemap: true,
			// Ensure source maps are properly included in the build
			minify: mode === "production" ? "esbuild" : false,
			// Target modern browsers for VS Code webview
			target: "esnext",
			// Set chunk size warning limit
			chunkSizeWarningLimit: 1000,
			// Use a single combined CSS bundle so both webviews share styles
			cssCodeSplit: false,
			rollupOptions: {
				input: {
					index: resolve(__dirname, "index.html"),
					"browser-panel": resolve(__dirname, "browser-panel.html"),
				},
				output: {
					entryFileNames: `assets/[name].js`,
					chunkFileNames: (chunkInfo) => {
						if (chunkInfo.name === "mermaid-bundle") {
							return `assets/mermaid-bundle.js`
						}
						// Default naming for other chunks, ensuring uniqueness from entry
						return `assets/chunk-[hash].js`
					},
					assetFileNames: (assetInfo) => {
						const name = assetInfo.name || ""

						// Force all CSS into a single predictable file used by both webviews
						if (name.endsWith(".css")) {
							return "assets/index.css"
						}

						if (name.endsWith(".woff2") || name.endsWith(".woff") || name.endsWith(".ttf")) {
							return "assets/fonts/[name][extname]"
						}
						// Ensure source maps are included in the build
						if (name.endsWith(".map")) {
							return "assets/[name]"
						}
						return "assets/[name][extname]"
					},
					manualChunks: (id, { getModuleInfo }) => {
						// Consolidate all mermaid code and its direct large dependencies (like dagre)
						// into a single chunk. The 'channel.js' error often points to dagre.
						if (
							id.includes("node_modules/mermaid") ||
							id.includes("node_modules/dagre") || // dagre is a common dep for graph layout
							id.includes("node_modules/cytoscape") // another potential graph lib
							// Add other known large mermaid dependencies if identified
						) {
							return "mermaid-bundle"
						}

						// Check if the module is part of any explicitly defined mermaid-related dynamic import
						// This is a more advanced check if simple path matching isn't enough.
						const moduleInfo = getModuleInfo(id)
						if (moduleInfo?.importers.some((importer) => importer.includes("node_modules/mermaid"))) {
							return "mermaid-bundle"
						}
						if (
							moduleInfo?.dynamicImporters.some((importer) => importer.includes("node_modules/mermaid"))
						) {
							return "mermaid-bundle"
						}
					},
				},
			},
		},
		server: {
			hmr: {
				host: "localhost",
				protocol: "ws",
				// Enable error overlay for better debugging
				overlay: true,
			},
			cors: {
				// Only allow all origins in development for VS Code webview integration
				origin: mode === "development" ? "*" : false,
				methods: "*",
				allowedHeaders: "*",
			},
		},
		define,
		optimizeDeps: {
			include: [
				"mermaid",
				"dagre", // Explicitly include dagre for pre-bundling
				// Add other known large mermaid dependencies if identified
			],
			exclude: ["vscode-oniguruma", "shiki"],
		},
		assetsInclude: ["**/*.wasm", "**/*.wav"],
	}
})
