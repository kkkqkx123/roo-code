/**
 * 翻译内容定义文件
 * 所有翻译内容都在这里定义，确保与类型完全一致
 */

export const EN_TRANSLATIONS = {
  common: {
    extension: {
      name: "Roo Code",
      description: "A whole dev team of AI agents in your editor."
    },
    number_format: {
      thousand_suffix: "k",
      million_suffix: "m",
      billion_suffix: "b"
    },
    welcome: "Welcome, {{name}}! You have {{count}} notifications.",
    items: {
      zero: "No items",
      one: "One item",
      other: "{{count}} items"
    },
    confirmation: {
      reset_state: "Are you sure you want to reset all state and secret storage in the extension? This cannot be undone.",
      delete_config_profile: "Are you sure you want to delete this configuration profile?",
      delete_custom_mode_with_rules: "Are you sure you want to delete this {scope} mode?\n\nThis will also delete the associated rules folder at:\n{rulesFolderPath}"
    },
    errors: {
      invalid_data_uri: "Invalid data URI format",
      error_copying_image: "Error copying image: {{errorMessage}}",
      error_opening_image: "Error opening image: {{error}}",
      error_saving_image: "Error saving image: {{errorMessage}}",
      could_not_open_file: "Could not open file: {{errorMessage}}",
      could_not_open_file_generic: "Could not open file!",
      checkpoint_timeout: "Timed out when attempting to restore checkpoint.",
      checkpoint_failed: "Failed to restore checkpoint.",
      // ... 可以继续添加所有翻译内容
    }
  },
  tools: {
    // 工具相关的翻译
  },
  embeddings: {
    // 嵌入相关的翻译
  },
  mcp: {
    // MCP相关的翻译
  }
} as const

export const ZH_CN_TRANSLATIONS = {
  common: {
    extension: {
      name: "Roo Code",
      description: "您的编辑器中的整个AI开发团队。"
    },
    number_format: {
      thousand_suffix: "千",
      million_suffix: "百万",
      billion_suffix: "十亿"
    },
    welcome: "欢迎，{{name}}！您有 {{count}} 条通知。",
    items: {
      zero: "没有项目",
      one: "一个项目",
      other: "{{count}} 个项目"
    },
    confirmation: {
      reset_state: "您确定要重置扩展中的所有状态和密钥存储吗？此操作无法撤销。",
      delete_config_profile: "您确定要删除此配置配置文件吗？",
      delete_custom_mode_with_rules: "您确定要删除此 {scope} 模式吗？\n\n这也将删除关联的规则文件夹：\n{rulesFolderPath}"
    },
    errors: {
      invalid_data_uri: "数据URI格式无效",
      error_copying_image: "复制图像时出错：{{errorMessage}}",
      error_opening_image: "打开图像时出错：{{error}}",
      error_saving_image: "保存图像时出错：{{errorMessage}}",
      could_not_open_file: "无法打开文件：{{errorMessage}}",
      could_not_open_file_generic: "无法打开文件！",
      checkpoint_timeout: "尝试还原检查点时超时。",
      checkpoint_failed: "还原检查点失败。",
      // ... 可以继续添加所有翻译内容
    }
  },
  tools: {
    // 工具相关的翻译
  },
  embeddings: {
    // 嵌入相关的翻译
  },
  mcp: {
    // MCP相关的翻译
  }
} as const

// 类型检查辅助函数
type AssertEqual<T, U> = T extends U ? (U extends T ? true : false) : false

// 验证翻译内容与类型定义一致
function verifyTranslations() {
  // 这里可以添加运行时验证逻辑
  console.log('Translation definitions loaded successfully')
}

verifyTranslations()