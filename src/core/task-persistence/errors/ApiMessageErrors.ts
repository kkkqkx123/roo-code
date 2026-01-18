/**
 * API 消息相关错误类
 * 提供统一的错误处理机制
 */

/**
 * API 消息读取错误
 */
export class ApiMessageReadError extends Error {
	constructor(message: string, public override cause?: Error) {
		super(message)
		this.name = "ApiMessageReadError"
	}
}

/**
 * API 消息保存错误
 */
export class ApiMessageSaveError extends Error {
	constructor(message: string, public override cause?: Error) {
		super(message)
		this.name = "ApiMessageSaveError"
	}
}

/**
 * API 消息验证错误
 */
export class ApiMessageValidationError extends Error {
	constructor(message: string, public invalidMessages?: any[]) {
		super(message)
		this.name = "ApiMessageValidationError"
	}
}

/**
 * API 消息解析错误
 */
export class ApiMessageParseError extends Error {
	constructor(message: string, public override cause?: Error) {
		super(message)
		this.name = "ApiMessageParseError"
	}
}

/**
 * API 消息迁移错误
 */
export class ApiMessageMigrationError extends Error {
	constructor(message: string, public override cause?: Error) {
		super(message)
		this.name = "ApiMessageMigrationError"
	}
}

/**
 * API 消息文件未找到错误
 */
export class ApiMessageFileNotFoundError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "ApiMessageFileNotFoundError"
	}
}