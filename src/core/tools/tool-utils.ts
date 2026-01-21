import type { ToolProtocol } from "@shared/types/tool"

export const TOOL_PROTOCOL = {
	XML: "xml",
	NATIVE: "native",
} as const

export const NATIVE_TOOL_DEFAULTS = {
	supportsNativeTools: true,
	defaultToolProtocol: TOOL_PROTOCOL.NATIVE,
} as const

export function isNativeProtocol(protocol: ToolProtocol): boolean {
	return protocol === TOOL_PROTOCOL.NATIVE
}

export function getEffectiveProtocol(toolProtocol?: ToolProtocol): ToolProtocol {
	return toolProtocol || TOOL_PROTOCOL.XML
}
