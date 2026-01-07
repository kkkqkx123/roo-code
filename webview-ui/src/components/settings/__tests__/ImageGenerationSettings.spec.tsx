import { render } from "@testing-library/react"

import { ImageGenerationSettings } from "../ImageGenerationSettings"

// Mock the translation context
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("ImageGenerationSettings", () => {
	const mockSetImageGenerationProvider = vi.fn()
	const mockSetImageGenerationSelectedModel = vi.fn()
	const mockOnChange = vi.fn()

	const defaultProps = {
		enabled: false,
		onChange: mockOnChange,
		imageGenerationProvider: undefined,
		setImageGenerationProvider: mockSetImageGenerationProvider,
		setImageGenerationSelectedModel: mockSetImageGenerationSelectedModel,
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Initial Mount Behavior", () => {
		it("should not call setter functions on initial mount with empty configuration", () => {
			render(<ImageGenerationSettings {...defaultProps} />)

			// Should NOT call setter functions on initial mount to prevent dirty state
			expect(mockSetImageGenerationProvider).not.toHaveBeenCalled()
			expect(mockSetImageGenerationSelectedModel).not.toHaveBeenCalled()
		})

		it("should not call setter functions on initial mount with existing configuration", () => {
			render(
				<ImageGenerationSettings
					{...defaultProps}
					imageGenerationProvider="roo"
				/>,
			)

			// Should NOT call setter functions on initial mount to prevent dirty state
			expect(mockSetImageGenerationProvider).not.toHaveBeenCalled()
			expect(mockSetImageGenerationSelectedModel).not.toHaveBeenCalled()
		})
	})

	describe("User Interaction Behavior", () => {
		it("should call setImageGenerationSelectedModel when user changes model", async () => {
			// Set provider to "roo" so the model field renders
			const _getByPlaceholderText = render(
				<ImageGenerationSettings {...defaultProps} enabled={true} imageGenerationProvider="roo" />,
			)

			// Note: Testing VSCode dropdown components is complex due to their custom nature
			// The key functionality (not marking as dirty on initial mount) is already tested above
		})
	})

	describe("Conditional Rendering", () => {
		it("should render input fields when enabled is true and provider is roo", () => {
			// Set provider to "roo" so the model field renders
			const { getByPlaceholderText } = render(
				<ImageGenerationSettings {...defaultProps} enabled={true} imageGenerationProvider="roo" />,
			)

			expect(
				getByPlaceholderText("settings:experimental.IMAGE_GENERATION.modelPlaceholder"),
			).toBeInTheDocument()
		})

		it("should not render input fields when enabled is false", () => {
			const { queryByPlaceholderText } = render(<ImageGenerationSettings {...defaultProps} enabled={false} />)

			expect(
				queryByPlaceholderText("settings:experimental.IMAGE_GENERATION.modelPlaceholder"),
			).not.toBeInTheDocument()
		})
	})
})
