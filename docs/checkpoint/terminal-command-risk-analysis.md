# 终端命令风险分析

## 终端命令执行流程分析

### 命令执行入口
**位置**: `src/core/tools/ExecuteCommandTool.ts`

**关键函数**:
```typescript
export async function executeCommandInTerminal(
  task: Task,
  options: ExecuteCommandOptions
): Promise<[boolean, ToolResponse]> {
  // 当前实现：直接执行命令，无检查点保护
  const result = await executeCommand(options)
  return [true, result]
}
```

### 命令执行测试文件
**位置**: `src/core/tools/__tests__/executeCommand.spec.ts`

**测试用例覆盖的命令类型**:
- Git操作（git add, git commit, git push）
- 文件操作（rm, mv, cp）
- 包管理（npm install, pip install）
- 系统命令（echo, ls, pwd）

## 命令风险等级分类

### 高风险命令（需要检查点）

#### 1. 文件删除操作
- `rm -rf /path` - 递归强制删除
- `git reset --hard` - 硬重置Git历史
- `git clean -fd` - 清理未跟踪文件

#### 2. 系统修改操作
- `chmod -R 777 /path` - 递归修改权限
- `chown -R user:group /path` - 递归修改所有者

#### 3. 数据库操作
- `mysql -e "DROP DATABASE dbname"` - 删除数据库
- `mongodb` 删除集合操作

#### 4. 网络操作
- `curl -X DELETE http://api/resource` - 删除API资源
- `wget` 下载并执行脚本

### 中风险命令（可选检查点）

#### 1. Git操作
- `git commit -m "message"` - 提交更改
- `git push origin main` - 推送更改

#### 2. 文件修改
- `mv file1 file2` - 移动/重命名文件
- `cp -r dir1 dir2` - 递归复制

#### 3. 包安装
- `npm install package` - 安装依赖
- `pip install package` - 安装Python包

### 低风险命令（不需要检查点）

#### 1. 查看操作
- `ls`, `pwd`, `cat` - 只读操作
- `git status`, `git log` - Git状态查看

#### 2. 环境信息
- `echo $PATH` - 环境变量查看
- `which command` - 命令位置查找

## Shell特定风险分析

### PowerShell特有风险

#### 危险操作
- `Remove-Item -Recurse -Force path` - 递归强制删除
- `Set-ExecutionPolicy Unrestricted` - 修改执行策略
- `Invoke-Expression` - 执行字符串表达式

#### 特殊语法
- `& { command }` - 调用操作符
- `.\script.ps1` - 执行脚本

### Bash/Zsh特有风险

#### 危险操作
- `rm -rf /` - 系统根目录删除（危险）
- `:(){ :|:& };:` - fork炸弹
- `command > file` - 输出重定向覆盖

#### 特殊语法
- `$(command)` - 命令替换
- `` `command` `` - 反引号命令替换

### CMD特有风险

#### 危险操作
- `del /s /q /f *` - 递归静默强制删除
- `rd /s /q directory` - 递归删除目录

## 命令参数分析

### 危险参数模式

#### 1. 递归操作
- `-r`, `-R`, `--recursive`
- 影响范围大，难以恢复

#### 2. 强制操作
- `-f`, `--force`
- 跳过确认提示，增加风险

#### 3. 静默操作
- `-q`, `--quiet`
- 无输出提示，难以察觉问题

### 参数组合风险

#### 高风险组合
- `rm -rf` - 递归强制删除
- `git reset --hard` - 硬重置
- `chmod -R 777` - 递归权限修改

## 风险检测策略

### 基于命令前缀的检测
```typescript
const highRiskPrefixes = [
  "rm -rf",
  "git reset --hard", 
  "chmod -R 777",
  "chown -R",
  "drop database",
  "Remove-Item -Recurse -Force"
]
```

### 基于参数模式的检测
```typescript
const dangerousFlags = [
  /-r[f]*/,      // 递归+强制
  /--recursive/, // 递归
  /-f/,          // 强制
  /--force/,     // 强制
  /-R[f]*/       // 递归+强制
]
```

### 基于Shell语法的检测
```typescript
const dangerousSyntax = [
  /\$\{[^}]*@[PQEAa][^}]*\}/, // 危险参数扩展
  /<<<\s*\$\(/,               // Here-string命令替换
  /=\\([^)]+\\)/,             // Zsh进程替换
]
```

## 检查点触发策略

### 1. 命令执行前检查点
**适用场景**: 高风险命令
**优势**: 提供完整回滚点
**劣势**: 可能影响性能

### 2. 命令执行后检查点
**适用场景**: 中风险命令成功执行后
**优势**: 保存成功状态
**劣势**: 无法回滚失败操作

### 3. 错误时检查点
**适用场景**: 命令执行失败时
**优势**: 保存错误状态便于调试
**劣势**: 状态可能不一致

## 用户配置需求

### 1. 命令级别配置
- 允许用户自定义需要检查点的命令
- 支持命令前缀匹配
- 支持通配符模式

### 2. 风险级别配置
- 高/中/低风险命令分类
- 基于风险级别的检查点策略

### 3. Shell特定配置
- 不同Shell环境的差异化配置
- Shell特有命令的风险评估

## 总结

终端命令存在显著的安全风险，需要基于命令类型、参数组合和Shell环境进行风险评估。通过效仿现有的命令授权系统，可以实现灵活的用户配置和智能的检查点触发策略。