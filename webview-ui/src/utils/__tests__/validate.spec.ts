import type { ProviderSettings } from "@roo-code/types"

// Mock i18next to return translation keys with interpolated values
vi.mock("i18next", () => ({
	default: {
		t: (key: string, options?: Record<string, string>) => {
			if (options) {
				let result = key
				Object.entries(options).forEach(([k, v]) => {
					result += ` ${k}=${v}`
				})
				return result
			}
			return key
		},
	},
}))

import { validateBedrockArn } from "../validate"

describe("validateBedrockArn", () => {
	describe("always returns isValid: true (no strict format validation)", () => {
		it("accepts standard AWS Bedrock ARNs", () => {
			const result = validateBedrockArn(
				"arn:aws:bedrock:us-west-2:123456789012:inference-profile/us.anthropic.claude-3-5-sonnet-v2",
			)
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-west-2")
			expect(result.errorMessage).toBeUndefined()
		})

		it("accepts AWS GovCloud ARNs", () => {
			const result = validateBedrockArn(
				"arn:aws-us-gov:bedrock:us-gov-west-1:123456789012:inference-profile/model",
			)
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-gov-west-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("accepts AWS China ARNs", () => {
			const result = validateBedrockArn("arn:aws-cn:bedrock:cn-north-1:123456789012:inference-profile/model")
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("cn-north-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("accepts SageMaker ARNs", () => {
			const result = validateBedrockArn("arn:aws:sagemaker:us-east-1:123456789012:endpoint/my-endpoint")
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-east-1")
			expect(result.errorMessage).toBeUndefined()
		})

		it("accepts non-standard ARN formats without validation errors", () => {
			// Users are advanced - trust their input
			const result = validateBedrockArn("arn:custom:service:region:account:resource")
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("region")
			expect(result.errorMessage).toBeUndefined()
		})

		it("accepts completely custom ARN strings", () => {
			// Even unusual formats should be accepted
			const result = validateBedrockArn("some-custom-arn-format")
			expect(result.isValid).toBe(true)
			// May not be able to extract region from non-standard format
			expect(result.errorMessage).toBeUndefined()
		})
	})

	describe("region mismatch warnings", () => {
		it("shows warning when ARN region differs from provided region", () => {
			const result = validateBedrockArn(
				"arn:aws:bedrock:us-west-2:123456789012:inference-profile/model",
				"us-east-1",
			)
			expect(result.isValid).toBe(true) // Still valid, just a warning
			expect(result.arnRegion).toBe("us-west-2")
			expect(result.errorMessage).toBeDefined()
			expect(result.errorMessage).toContain("us-west-2")
		})

		it("shows no warning when ARN region matches provided region", () => {
			const result = validateBedrockArn(
				"arn:aws:bedrock:us-west-2:123456789012:inference-profile/model",
				"us-west-2",
			)
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-west-2")
			expect(result.errorMessage).toBeUndefined()
		})

		it("shows no warning when no region is provided to check against", () => {
			const result = validateBedrockArn("arn:aws:bedrock:us-west-2:123456789012:inference-profile/model")
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBe("us-west-2")
			expect(result.errorMessage).toBeUndefined()
		})

		it("shows no warning when region cannot be extracted from ARN", () => {
			const result = validateBedrockArn("non-arn-format", "us-east-1")
			expect(result.isValid).toBe(true)
			expect(result.arnRegion).toBeUndefined()
			expect(result.errorMessage).toBeUndefined()
		})
	})
})
