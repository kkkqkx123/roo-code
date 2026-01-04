## 问题总结
### 问题描述
当提问工具（ ask_followup_question ）被触发时，用户直接输入提示词并提交，可能会把输入放在消息队列中，而非直接作为输入响应。

### 根本原因
在 webview-ui/src/components/chat/ChatView.tsx 的 handleSendMessage 函数中，原有的判断逻辑是：

1. 首先检查是否需要排队（ sendingDisabled || isStreaming || messageQueue.length > 0 ）
2. 如果需要排队，就将消息加入队列
3. 否则，检查是否有 clineAsk ，如果有则发送 askResponse
问题在于 ：当 ask_followup_question 被触发时，如果任务处于忙碌状态（ sendingDisabled 为 true）或 API 请求正在进行（ isStreaming 为 true），即使用户是在响应 followup 问题，消息也会被错误地加入队列，而不是直接发送。

### 解决方案
调整判断逻辑的优先级：

1. 首先检查是否有活跃的 clineAsk （特别是 followup 问题）
2. 如果有，直接发送 askResponse ，不进行排队
3. 只有在没有 clineAsk 的情况下，才考虑排队逻辑
这样确保了用户对问题的响应不会被错误地放入队列。

### 修改内容
在 webview-ui/src/components/chat/ChatView.tsx:564-597 中，将 clineAskRef.current 的检查移到了队列检查之前，确保用户对问题的响应能够立即发送。