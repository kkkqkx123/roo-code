import { z } from "zod"

export const checkpointSchema = z.object({
	from: z.string(),
	to: z.string(),
})

export const checkpointMetadataSchema = z.object({
	isCheckpoint: z.boolean(),
	requestIndex: z.number().optional(),
	systemPrompt: z.string().optional(),
	toolProtocol: z.string().optional(),
	contextTokens: z.number().optional(),
})

export type Checkpoint = z.infer<typeof checkpointSchema>
export type CheckpointMetadata = z.infer<typeof checkpointMetadataSchema>
