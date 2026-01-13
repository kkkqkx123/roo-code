# `src\vscode-dark` 目录分析

## 概述

`vscode-dark` 目录是 Roo Code VS Code 扩展的存储目录，用于存放用户特定的数据和配置。

## 作用

`vscode-dark` 目录是 Roo Code VS Code 扩展的**存储目录**，用于存放用户特定的数据和配置。从代码分析来看，这个目录结构是通过 `getSettingsDirectoryPath()` 函数自动创建的，用于存储以下内容：

1. **MCP (Model Context Protocol) 设置** (`settings\mcp_settings.json`)
   - 存储 MCP 服务器的配置信息
   - 当前显示为空的 `{ "mcpServers": {} }`

2. **任务数据** (`tasks\` 子目录)
   - 每个任务都有独立的 UUID 命名的子目录
   - 包含任务相关的 UI 消息等数据
   - 每个任务目录包含锁文件如 `ui_messages.json.lock`

## 来源和生成机制

1. **动态创建**：该目录是在扩展运行时通过 `getSettingsDirectoryPath()` 函数动态创建的
2. **存储路径逻辑**：
   - 默认使用 VS Code 的全局存储路径
   - 用户可以配置自定义存储路径 (`customStoragePath` 设置)
   - 路径为 `{globalStoragePath}/settings/`
3. **用途**：作为扩展的持久化存储区域，保存用户配置、MCP 服务器设置和任务数据

## 目录结构

```
vscode-dark/
├── settings/
│   └── mcp_settings.json     # MCP 服务器配置
└── tasks/
    ├── {uuid}/              # 每个任务的独立目录
    │   └── ui_messages.json.lock
    └── ...                  # 多个任务目录
```

## 总结

这个目录本质上是 Roo Code 扩展的本地数据存储区，类似于用户的配置和缓存目录，用于维护扩展的运行状态和用户偏好设置。