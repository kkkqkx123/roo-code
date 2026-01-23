import { typedMessageBusClient } from "@src/utils/TypedMessageBusClient"

export function useMessageBus() {
	return typedMessageBusClient
}