import { data } from ".."
import { ChatBotResponseMessage, ChatBotTable } from "../interface/chatBotTable"
import { ConfigService } from "../service/ConfigService"

export class ChatBot {
    api$chat = ''
    apiKey = ''
    model = ''
    maxtokens = 2048
    temperature = 0.7

    history: Message[] = []
    logger: any

    constructor(apichat: string, apiKey: string, model: string, logger: any = console) {
        this.api$chat = apichat + `/chat/completions`
        this.apiKey = apiKey
        this.model = model
        this.logger = logger
        this.history[0] = { role: 'system', content: '' }
        // logger.info(`聊天机器人初始化完成`)
    }

    public setSystemPrompt(prompt: string) {
        // 校验 prompt 参数
        if (typeof prompt !== 'string' || !prompt.trim()) {
            throw new Error('Prompt must be a non-empty string');
        }
        // 确保 history 已初始化
        if (!this.history) {
            this.history = [];
            this.logger.warn(`历史记录已重新初始化`)
        }

        // 替换或添加第一个元素
        this.history.splice(0, 1, {
            role: 'system',
            content: prompt
        });
    }

    public getSystemPrompt() {
        return this.history[0].content
    }

    public addUserPrompt(prompt: string) {
        if (!this.history || this.history.length < 1) {
            this.logger.info(`[历史记录] 出现未知bug导致历史记录为空`)
            this.history = []
        }
        this.history.push({
            role: 'user',
            content: prompt
        })
        this.collateHistory()
    }

    public async sendMessage(userInput: string): Promise<ChatBotResponseMessage> {
        this.logger.info(`用户输入：${userInput}`)
        this.history.push({
            role: 'user',
            content: userInput
        })
        this.collateHistory() // 整理历史消息

        const requestBody: ChatRequest = {
            model: this.model,
            messages: this.history,
            temperature: ConfigService.getTemperature() || this.temperature,
            max_tokens: ConfigService.getMaxToken() || this.maxtokens,
        }
        this.logger.info(`[API请求] 准备发送:`, {
            url: this.api$chat,
            ...requestBody,
            messages: `[${this.history.length}条消息]`,
            systemPrompt: `${this.getSystemPrompt()}`
        })

        try {
            const startTime = Date.now()
            const response = await fetch(this.api$chat, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            })

            const duration = Date.now() - startTime
            this.logger.info(`[API响应] 状态码: ${response.status}，耗时: ${duration}ms`)

            if (response.status !== 200) {
                this.logger.error(`[请求失败] 错误详情: ${await response.text()}`);
                return {
                    commonResponse: `抱歉，请求时出现异常;` + (response.statusText ?
                        `${response.statusText}` : '未知错误类型')
                }
            }

            if (!response.ok) {
                this.logger.error(`[请求失败] 错误详情: ${await response.text()}`);
                throw new Error(`API request failed: ${response.statusText}`);
            }

            const data: ChatResponse = await response.json();

            if (data.choices?.[0]?.message?.content) {
                const assistantThinking = data.choices[0].message.reasoning_content
                const assistantResponse = data.choices[0].message.content
                let assistantJsonResponse: any = undefined

                // 前置条件：仅在输入为字符串时尝试解析
                if (typeof assistantResponse === 'string') {
                    try {
                        // 安全解析JSON
                        const parsed = JSON.parse(assistantResponse)

                        // 校验解析结果为对象（非数组/原始值）
                        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            // 安全访问嵌套属性（类型安全版）
                            const hasUserContent = 'userContent' in parsed
                            assistantJsonResponse = hasUserContent ? parsed.userContent : undefined
                        }
                    } catch (error) {
                        // 可在此处添加日志输出（根据需求可选）
                        this.logger.error('[JSON Parse] 非JSON响应内容:', assistantResponse)
                        if (assistantResponse.length <= 300) {
                            assistantJsonResponse = assistantResponse
                        } else if (assistantResponse.length > 300) {
                            assistantJsonResponse = assistantResponse.slice(0, 300) + '...'
                        }
                    }
                }
                this.history.push({
                    role: 'assistant',
                    content: assistantResponse,
                })
                let totalUsage: Number = 0
                if (data.usage) {
                    totalUsage = data.usage.prompt_tokens + data.usage.completion_tokens
                }
                const response: string = `助手思考: [${assistantThinking}]\n\n` +
                    `----------\n` +
                    `${assistantResponse}\n\n` +
                    `问题用量: ${data.usage.prompt_tokens} | 回复用量: ${data.usage.completion_tokens} | 总用量: ${totalUsage} | 消耗时间: ${duration}ms`
                return { commonResponse: response, jsonResponse: assistantJsonResponse }
            }
            throw new Error(`No valid response from API`)
        } catch (error) {
            this.logger.error(`[错误处理] 捕获到异常:`, error instanceof Error ?
                `${error.name}: ${error.message}` : '未知错误类型'
            )
            return {
                commonResponse: `抱歉，请求时出现异常;` + (error instanceof Error ?
                    `${error.name}: ${error.message}` : '未知错误类型')
            }
        }
    }

    collateHistory() {
        // 当历史记录超过18条时（系统提示+17条消息）
        if (this.history.length > ConfigService.getMaxHistory() - 2) {
            // 保留第一条系统提示语
            const systemPrompt = this.history[0];
            // 删除索引 1-3 的消息，即删除第二、第三、第四条消息
            this.history = [systemPrompt, ...this.history.slice(-ConfigService.getMaxHistory() - 3)];
        }
    }

    clearHistory() {
        this.logger.info(`[历史记录] 清空对话历史 原长度: ${this.history.length}`)
        const systemPrompt = this.history[0]
        this.history = [systemPrompt]
    }
}

export const chatBots: Map<string, ChatBot> = new Map<string, ChatBot>()
