import { Session } from "koishi"
import { data } from ".."
import { ChatBotResponseMessage, ChatBotTable } from "../interface/chatBotTable"
import { ConfigService } from "../service/ConfigService"

type ApiResponse = { response: Response, duration?: number }
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

    public getSystemPrompt(): string | undefined {
        const prompt = this.history[0]
        try {
            if (prompt?.role === 'system') {
                return prompt.content
            } else {
                return undefined
            }
        } catch (error) {
            data.ctx.logger.warn(`解析系统提示失败: ${error.message}`)
            return undefined
        }
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

    async sendMessageWithHistory(userInput: string): Promise<ChatBotResponseMessage> {
        this.logger.info(`用户输入：${userInput}`)
        this.history.push({
            role: 'user',
            content: userInput
        })
        this.collateHistory() // 整理历史消息
        const message = this.history
        const requestResp = await this._sendApiRequest(message)
        const response = await this._handleResponse(requestResp)
        return response
    }

    async sendMessage(input: string) {
        // 一种不带历史记录的聊天方式
        this.logger.info(`用户输入：${input}`)
        const message: Message[] = [{
            role: 'user',
            content: input,
        }]
        const requestResp = await this._sendApiRequest(message)
        const handleResp = await this._handleResponse(requestResp)
        return handleResp
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

    private async _sendApiRequest(message: Message[]): Promise<ApiResponse> {
        const startTime = Date.now();
        const requestBody: ChatRequest = {
            model: this.model,
            messages: message,
            max_tokens: this.maxtokens,
            temperature: this.temperature,
        }
        try {
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
            return { response: response, duration: duration }
        } catch (error) {
            this.logger.error(`[错误处理] 捕获到异常:`, error instanceof Error ?
                `${error.name}: ${error.message}` : '未知错误类型'
            )
            return {
                response: new Response("请求错误", {
                    status: 500,
                }),
                duration: Date.now() - startTime
            }
        }
    }

    private async _handleResponse(apiResponse: ApiResponse): Promise<ChatBotResponseMessage> {
        const varResponse = apiResponse.response;
        if (varResponse.status !== 200) {
            this.logger.error(`[请求失败] 错误详情: ${await varResponse.text()}`);
            return {
                commonResponse: `抱歉，请求时出现异常;` + (varResponse.statusText ?
                    `${varResponse.statusText}` : '未知错误类型')
            }
        }

        if (!varResponse.ok) {
            this.logger.error(`[请求失败] 错误详情: ${await varResponse.text()}`);
            throw new Error(`API request failed: ${varResponse.statusText}`);
        }

        const data: ChatResponse = await varResponse.json();

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
            let totalUsage: number = 0
            if (data.usage) {
                totalUsage = data.usage.prompt_tokens + data.usage.completion_tokens
            }
            const response: string = `助手思考: [${assistantThinking}]\n\n` +
                `----------\n` +
                `${assistantResponse}\n\n` +
                `问题用量: ${data.usage.prompt_tokens} | 回复用量: ${data.usage.completion_tokens} | 总用量: ${totalUsage} | 消耗时间: ${apiResponse.duration}ms`
            return {
                commonResponse: response, jsonResponse: assistantJsonResponse, useInfo: {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: totalUsage,
                }
            }
        }
    }


    static async getBot(session: Session): Promise<Promise<ChatBot>> {
        const { guildId, platform } = session
        // 尝试从内存缓存获取
        const cachedBot = chatBots.get(guildId)
        if (cachedBot) return cachedBot

        // 尝试从数据库恢复
        const restoredBot = await ChatBot.tryRestoreFromDB(guildId, platform)
        if (restoredBot) {
            chatBots.set(guildId, restoredBot)
            return restoredBot
        }

        // 创建新实例
        return ChatBot.createNewBot(guildId, platform)
    }

    static async tryRestoreFromDB(guildId: string, platform: string): Promise<ChatBot | null> {
        try {
            // 寻找匹配的记录
            const [guildIdFind] = await data.ctx.database.get('channel', {
                id: guildId,
                platform: platform,
            })

            if (!guildIdFind?.chatbot?.history) return null

            const { history } = guildIdFind.chatbot
            const bot = await ChatBot.createBotInstance()

            if (history?.length > 1)
                bot.history = history
            ChatBot.configureSystemPrompt(bot, guildId)

            return bot
        } catch (error) {
            data.ctx.logger.warn(`数据库查询失败: ${error.message}`)
            return null
        }
    }

    static async createNewBot(guildId: string, platform: string): Promise<ChatBot> {
        const bot = await ChatBot.createBotInstance()
        ChatBot.configureSystemPrompt(bot, guildId)
        ChatBot.persistBotToDB(bot, guildId, platform)
        chatBots.set(guildId, bot)
        return bot
    }

    /**
     * 更新实例中的系统提示词
     * 优先级:
     * 1. 配置表
     * 2. 历史记录中第一个消息
     * 3. 默认值
     * @param bot 
     * @param guildId 
     */
    static async configureSystemPrompt(bot: ChatBot, guildId: string) {
        const config = data.config
        const perGuildPrompt = config.perGuildConfig.find(item => item?.guildId === guildId)?.systemPrompt
        const botGuildPrompt = bot.getSystemPrompt()
        const globalPrompt = ConfigService.getSystemPrompt()
        const systemPrompt = perGuildPrompt || botGuildPrompt || globalPrompt

        bot.setSystemPrompt(
            ChatBot.replaceSystemPrompt(systemPrompt, guildId)
        )
    }

    static replaceSystemPrompt(template: string, guildId: string) {
        return template.replace('【guildId】', `[${guildId}]`)
    }

    static async createBotInstance(): Promise<ChatBot> {
        return new ChatBot(
            ConfigService.getApiEndpoint(),
            ConfigService.getApiKey(),
            ConfigService.getModelId(),
            data.ctx.logger
        )
    }

    static async persistBotToDB(bot: ChatBot, guildId: string, platform: string) {
        try {
            await data.ctx.database.set('channel',
                { id: guildId, platform },
                {
                    chatbot: {
                        guildId: guildId,
                        history: bot.history,
                    }
                }
            )
            data.ctx.logger.info(`成功持久化 ${guildId} 的对话机器人`)
        } catch (error) {
            data.ctx.logger.warn(`数据库写入失败: ${error.message}`)
        }
    }
}

export const chatBots: Map<string, ChatBot> = new Map<string, ChatBot>()
