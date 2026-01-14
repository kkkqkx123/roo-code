import { Anthropic } from "@anthropic-ai/sdk"

import type { ModelInfo } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { countTokens } from "../../utils/countTokens"

export interface TokenEstimationResult {
	inputTokens: number
	outputTokens: number
}

export interface TokenValidationOptions {
	enableFallback?: boolean
	logFallback?: boolean
}

export class TokenValidationError extends Error {
	constructor(
		message: string,
		public readonly originalInputTokens?: number,
		public readonly originalOutputTokens?: number,
	) {
		super(message)
		this.name = "TokenValidationError"
	}
}

/**
 * Base class for API providers that implements common functionality.
 */
export abstract class BaseProvider implements ApiHandler {
	abstract createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	abstract getModel(): { id: string; info: ModelInfo }

	/**
	 * Converts an array of tools to be compatible with OpenAI's strict mode.
	 * Filters for function tools, applies schema conversion to their parameters,
	 * and ensures all tools have consistent strict: true values.
	 */
	protected convertToolsForOpenAI(tools: any[] | undefined): any[] | undefined {
		if (!tools) {
			return undefined
		}

		return tools.map((tool) =>
			tool.type === "function"
				? {
						...tool,
						function: {
							...tool.function,
							strict: true,
							parameters: this.convertToolSchemaForOpenAI(tool.function.parameters),
						},
					}
				: tool,
		)
	}

	/**
	 * Converts tool schemas to be compatible with OpenAI's strict mode by:
	 * - Ensuring all properties are in the required array (strict mode requirement)
	 * - Converting nullable types (["type", "null"]) to non-nullable ("type")
	 * - Recursively processing nested objects and arrays
	 *
	 * This matches the behavior of ensureAllRequired in openai-native.ts
	 */
	protected convertToolSchemaForOpenAI(schema: any): any {
		if (!schema || typeof schema !== "object" || schema.type !== "object") {
			return schema
		}

		const result = { ...schema }

		if (result.properties) {
			const allKeys = Object.keys(result.properties)
			// OpenAI strict mode requires ALL properties to be in required array
			result.required = allKeys

			// Recursively process nested objects and convert nullable types
			const newProps = { ...result.properties }
			for (const key of allKeys) {
				const prop = newProps[key]

				// Handle nullable types by removing null
				if (prop && Array.isArray(prop.type) && prop.type.includes("null")) {
					const nonNullTypes = prop.type.filter((t: string) => t !== "null")
					prop.type = nonNullTypes.length === 1 ? nonNullTypes[0] : nonNullTypes
				}

				// Recursively process nested objects
				if (prop && prop.type === "object") {
					newProps[key] = this.convertToolSchemaForOpenAI(prop)
				} else if (prop && prop.type === "array" && prop.items?.type === "object") {
					newProps[key] = {
						...prop,
						items: this.convertToolSchemaForOpenAI(prop.items),
					}
				}
			}
			result.properties = newProps
		}

		return result
	}

	/**
	 * Default token counting implementation using tiktoken.
	 * Providers can override this to use their native token counting endpoints.
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	async countTokens(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
		if (content.length === 0) {
			return 0
		}

		return countTokens(content, { useWorker: true })
	}

	/**
	 * Validates if a token count is valid (non-zero and defined).
	 *
	 * @param count The token count to validate
	 * @returns true if the token count is valid, false otherwise
	 */
	protected isValidTokenCount(count: number | undefined): boolean {
		return count !== undefined && count !== null && count > 0
	}

	/**
	 * Estimates tokens using tiktoken for input and output content.
	 * This is used as a fallback when API returns invalid token counts.
	 *
	 * @param inputContent The input content (system prompt + messages)
	 * @param outputContent The output content (assistant response)
	 * @param options Validation options
	 * @returns A promise resolving to estimated token counts
	 */
	async estimateTokensWithTiktoken(
		inputContent: Anthropic.Messages.ContentBlockParam[],
		outputContent: Anthropic.Messages.ContentBlockParam[],
		options?: TokenValidationOptions,
	): Promise<TokenEstimationResult> {
		const enableFallback = options?.enableFallback !== false
		const logFallback = options?.logFallback !== false

		try {
			const inputTokens = await this.countTokens(inputContent)
			const outputTokens = await this.countTokens(outputContent)

			if (logFallback) {
				console.warn(
					`[BaseProvider] Token count fallback to tiktoken: input=${inputTokens}, output=${outputTokens}`,
				)
			}

			return { inputTokens, outputTokens }
		} catch (error) {
			if (enableFallback) {
				console.error("[BaseProvider] Failed to estimate tokens with tiktoken:", error)
				return { inputTokens: 0, outputTokens: 0 }
			}
			throw new TokenValidationError("Failed to estimate tokens with tiktoken", 0, 0)
		}
	}

	/**
	 * Validates and potentially corrects token counts from API responses.
	 * If token counts are invalid (0, undefined, or null), estimates them using tiktoken.
	 *
	 * @param inputTokens The input token count from API
	 * @param outputTokens The output token count from API
	 * @param inputContent The input content for fallback estimation
	 * @param outputContent The output content for fallback estimation
	 * @param options Validation options
	 * @returns A promise resolving to validated/corrected token counts
	 */
	async validateAndCorrectTokenCounts(
		inputTokens: number | undefined,
		outputTokens: number | undefined,
		inputContent: Anthropic.Messages.ContentBlockParam[],
		outputContent: Anthropic.Messages.ContentBlockParam[],
		options?: TokenValidationOptions,
	): Promise<{ inputTokens: number; outputTokens: number; didFallback: boolean }> {
		const isInputValid = this.isValidTokenCount(inputTokens)
		const isOutputValid = this.isValidTokenCount(outputTokens)

		if (isInputValid && isOutputValid) {
			return { inputTokens: inputTokens!, outputTokens: outputTokens!, didFallback: false }
		}

		const logFallback = options?.logFallback !== false
		if (logFallback) {
			console.warn(
				`[BaseProvider] Invalid token counts detected. Input: ${inputTokens} (valid: ${isInputValid}), Output: ${outputTokens} (valid: ${isOutputValid})`,
			)
		}

		const estimated = await this.estimateTokensWithTiktoken(inputContent, outputContent, options)

		return {
		inputTokens: isInputValid ? inputTokens! : estimated.inputTokens,
		outputTokens: isOutputValid ? outputTokens! : estimated.outputTokens,
		didFallback: true,
	}
}

	/**
	 * Processes API usage data with unified validation and correction.
	 * Extracts token counts from API response, validates them, and returns
	 * a properly formatted usage chunk with fallback estimation if needed.
	 *
	 * @param apiUsage The raw usage data from API response
	 * @param inputContent The input content for fallback estimation
	 * @param outputContent The output content for fallback estimation
	 * @param options Validation options
	 * @returns A promise resolving to validated usage chunk
	 */
	protected async processUsageWithValidation(
		apiUsage: any,
		inputContent: Anthropic.Messages.ContentBlockParam[],
		outputContent: Anthropic.Messages.ContentBlockParam[],
		options?: TokenValidationOptions,
	): Promise<ApiStreamUsageChunk> {
		// Extract token counts from different provider formats
		const inputTokens = apiUsage?.input_tokens ?? apiUsage?.prompt_tokens
		const outputTokens = apiUsage?.output_tokens ?? apiUsage?.completion_tokens
		
		// Validate and correct token counts using unified mechanism
		const validated = await this.validateAndCorrectTokenCounts(
			inputTokens,
			outputTokens,
			inputContent,
			outputContent,
			options,
		)
		
		// Return properly formatted usage chunk with additional metadata
		return {
			type: "usage",
			inputTokens: validated.inputTokens,
			outputTokens: validated.outputTokens,
			cacheWriteTokens: apiUsage?.cache_creation_input_tokens,
			cacheReadTokens: apiUsage?.cache_read_input_tokens,
			reasoningTokens: apiUsage?.reasoning_tokens,
			totalCost: apiUsage?.total_cost,
		}
	}
}
