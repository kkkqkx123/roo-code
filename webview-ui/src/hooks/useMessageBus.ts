import { messageBusClient } from "@src/utils/MessageBusClient"

export function useMessageBus() {
	return messageBusClient
}