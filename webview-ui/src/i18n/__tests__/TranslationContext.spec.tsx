import { render } from "@/utils/test-utils"

import TranslationProvider, { useAppTranslation } from "../TranslationContext"

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		language: "en",
	}),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: {
			t: (key: string, _options?: Record<string, any>) => {
				// Mock specific translations used in tests
				if (key === "chat:autoApprove.title") return "Auto-Approve"
				if (key === "common:confirmation.deleteMessage") {
					return "Delete Message"
				}
				return key
			},
			changeLanguage: vi.fn(),
		},
	}),
}))

vi.mock("../setup", () => ({
	default: {
		t: (key: string, _options?: Record<string, any>) => {
			// Mock specific translations used in tests
			if (key === "chat:autoApprove.title") return "Auto-Approve"
			if (key === "common:confirmation.deleteMessage") {
				return "Delete Message"
			}
			return key
		},
		changeLanguage: vi.fn(),
	},
	loadTranslations: vi.fn(),
}))

const TestComponent = () => {
	const { t } = useAppTranslation()
	return (
		<div>
			<h1 data-testid="translation-test">{t("chat:autoApprove.title")}</h1>
			<p data-testid="translation-interpolation">{t("common:confirmation.deleteMessage")}</p>
		</div>
	)
}

describe("TranslationContext", () => {
	it("should provide translations via context", () => {
		const { getByTestId } = render(
			<TranslationProvider>
				<TestComponent />
			</TranslationProvider>,
		)

		// Check if translation is provided correctly
		expect(getByTestId("translation-test")).toHaveTextContent("Auto-Approve")
	})

	it("should handle interpolation in translations", () => {
		const { getByTestId } = render(
			<TranslationProvider>
				<TestComponent />
			</TranslationProvider>,
		)

		expect(getByTestId("translation-interpolation")).toHaveTextContent("Delete Message")
	})

	it("should provide tDynamic function for dynamic keys", () => {
		const TestDynamicComponent = () => {
			const { tDynamic } = useAppTranslation()
			return <div data-testid="dynamic-translation">{tDynamic("chat:autoApprove.title")}</div>
		}

		const { getByTestId } = render(
			<TranslationProvider>
				<TestDynamicComponent />
			</TranslationProvider>,
		)

		expect(getByTestId("dynamic-translation")).toHaveTextContent("Auto-Approve")
	})
})
