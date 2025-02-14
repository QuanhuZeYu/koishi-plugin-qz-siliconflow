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
    logger: {
        info(...object: any)
        warn(...object: any)
        error(...object: any)
        debug(...object: any)
        log(...object: any)
    } = console

    constructor(apichat: string, apiKey: string, model: string, logger: any = console) {
        this.api$chat = apichat + `/chat/completions`
        this.apiKey = apiKey
        this.model = model
        this.logger = logger
        this.history[0] = { role: 'system', content: '' }
        // logger.info(`聊天机器人初始化完成`)
    }

    async setSystemPrompt(prompt: string) {
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
            this.logger.warn(`解析系统提示失败: ${error.message}`)
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

    async sendMessage(input: string, role?: "user" | "system") {
        // 一种不带历史记录的聊天方式
        this.logger.info(`用户输入：${input}`)
        const message: Message[] = [{
            role: role ?? "user",
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
        const logger = data.ctx.logger;
        const varResponse = apiResponse.response;

        logger.debug('[handleResponse] 开始处理API响应');
        logger.debug(`[handleResponse] 响应状态: ${varResponse.status} ${varResponse.statusText}`);

        // 处理非200状态码
        if (varResponse.status !== 200) {
            const errorText = await varResponse.text();
            logger.error(`[handleResponse] 请求失败 - 状态码异常`, {
                status: varResponse.status,
                statusText: varResponse.statusText,
                errorPreview: errorText.slice(0, 100) + (errorText.length > 100 ? '...' : '')
            });

            return {
                commonResponse: `抱歉，请求时出现异常（${varResponse.statusText || '未知错误'}）`
            };
        }

        // 处理非OK响应
        if (!varResponse.ok) {
            const errorText = await varResponse.text();
            logger.error('[handleResponse] 请求失败 - 响应状态异常', {
                ok: varResponse.ok,
                errorPreview: errorText.slice(0, 100) + (errorText.length > 100 ? '...' : '')
            });
            throw new Error(`API请求失败: ${varResponse.statusText}`);
        }

        try {
            // 解析JSON响应
            logger.debug('[handleResponse] 开始解析JSON响应');
            const chatResponse: ChatResponse = await varResponse.json();
            logger.debug('[handleResponse] JSON解析成功', {
                hasChoices: !!chatResponse.choices,
                choiceCount: chatResponse.choices?.length || 0
            });

            // 处理有效响应内容
            if (chatResponse.choices?.[0]?.message?.content) {
                const message = chatResponse.choices[0].message;
                logger.debug('[handleResponse] 发现有效消息内容', {
                    contentPreview: message.content.slice(0, 50) + (message.content.length > 50 ? '...' : ''),
                    hasReasoning: !!message.reasoning_content
                });

                const assistantThinking = message.reasoning_content;
                const assistantResponse = message.content;
                let assistantJsonResponse: any = undefined;

                // 处理JSON内容
                if (typeof assistantResponse === 'string') {
                    logger.debug('[handleResponse] 开始处理字符串响应内容');
                    try {
                        logger.debug('[handleResponse] 尝试解析JSON内容');
                        const parsed = JSON.parse(assistantResponse);
                        logger.debug('[handleResponse] JSON解析结果类型', typeof parsed);

                        // 校验JSON结构
                        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            logger.debug('[handleResponse] 验证为有效对象结构');
                            assistantJsonResponse = 'userContent' in parsed ? parsed.userContent : undefined;
                            logger.debug('[handleResponse] 提取的userContent', {
                                exists: !!assistantJsonResponse,
                                type: typeof assistantJsonResponse
                            });
                        } else {
                            logger.warn('[handleResponse] 解析结果不符合对象要求', {
                                isArray: Array.isArray(parsed),
                                type: typeof parsed
                            });
                            const parsedThink = await this.parseThink(assistantResponse);
                            // 业务逻辑决策
                            assistantJsonResponse = (assistantThinking?.trim().length > 1) // 至少1字符才视为有效
                                ? assistantResponse
                                : parsedThink.cleaned || '';
                        }
                    } catch (error) {
                        logger.error('[handleResponse] JSON解析失败', {
                            error: error.message,
                            contentPreview: assistantResponse.slice(0, 100) + (assistantResponse.length > 100 ? '...' : '')
                        });

                        // 回退处理逻辑
                        const parsedThink = await this.parseThink(assistantResponse);
                        assistantJsonResponse = assistantThinking?.length > 0 ? assistantResponse : parsedThink.cleaned;
                        logger.debug('[handleResponse] 回退处理结果', {
                            method: assistantThinking ? '直接使用响应' : '使用parseThink',
                            cleanedPreview: parsedThink.cleaned.slice(0, 50) + (parsedThink.cleaned.length > 50 ? '...' : '')
                        });
                    }
                }

                // 计算用量
                let totalUsage = 0;
                if (chatResponse.usage) {
                    totalUsage = chatResponse.usage.prompt_tokens + chatResponse.usage.completion_tokens;
                    logger.debug('[handleResponse] 用量统计', {
                        promptTokens: chatResponse.usage.prompt_tokens,
                        completionTokens: chatResponse.usage.completion_tokens,
                        totalUsage,
                        duration: apiResponse.duration
                    });
                }

                // 构建响应消息
                const response = [
                    `助手思考: [${assistantThinking}]`,
                    `----------`,
                    `${assistantResponse}`,
                    `问题用量: ${chatResponse.usage?.prompt_tokens || 'N/A'} | ` +
                    `回复用量: ${chatResponse.usage?.completion_tokens || 'N/A'} | ` +
                    `总用量: ${totalUsage || 'N/A'} | ` +
                    `耗时: ${apiResponse.duration}ms`
                ].join('\n\n');

                logger.debug('[handleResponse] 最终响应结构', {
                    commonLength: response.length,
                    hasJsonResponse: !!assistantJsonResponse,
                    jsonType: typeof assistantJsonResponse
                });

                return {
                    commonResponse: response,
                    jsonResponse: assistantJsonResponse,
                    useInfo: {
                        promptTokens: chatResponse.usage?.prompt_tokens || 0,
                        completionTokens: chatResponse.usage?.completion_tokens || 0,
                        totalTokens: totalUsage
                    }
                };
            }

            logger.warn('[handleResponse] 未找到有效消息内容');
            return { commonResponse: '未获取到有效响应内容' };
        } catch (error) {
            logger.error('[handleResponse] 处理响应时发生异常', {
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 3).join(' | ')
            });
            throw error;
        }
    }

    private async parseThink(content: string): Promise<{ cleaned: string; thoughts: string[] }> {
        const logger = data.ctx.logger;
        const THINK_REGEX = /<think>([\s\S]*?)<\/think>/gi;
        const thoughts: string[] = [];

        logger.debug('[parseThink] 开始解析内容');
        logger.debug(`[parseThink] 原始输入内容 (${content.length} 字符): ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`);

        // 提取所有 think 内容
        let match: RegExpExecArray | null;
        let matchCount = 0;
        while ((match = THINK_REGEX.exec(content)) !== null) {
            const rawContent = match[1];
            const trimmedContent = rawContent.trim();
            thoughts.push(trimmedContent);

            logger.debug(`[parseThink] 发现第 ${++matchCount} 个 think 标签`);
            logger.debug(`[parseThink] 原始内容位置: ${match.index}-${match.index + match[0].length}`);
            logger.debug(`[parseThink] 提取内容 (${trimmedContent.length} 字符): ${trimmedContent.slice(0, 40)}${trimmedContent.length > 40 ? '...' : ''}`);
        }

        if (matchCount === 0) {
            logger.debug('[parseThink] 未找到任何 think 标签');
        }

        // 移除所有 think 标签
        const preCleaned = content.replace(THINK_REGEX, '');
        logger.debug(`[parseThink] 移除标签后预处理内容 (${preCleaned.length} 字符): ${preCleaned.slice(0, 50)}${preCleaned.length > 50 ? '...' : ''}`);

        const cleaned = preCleaned.replace(/\s+/g, ' ').trim();
        logger.debug(`[parseThink] 最终清理后内容 (${cleaned.length} 字符): ${cleaned.slice(0, 50)}${cleaned.length > 50 ? '...' : ''}`);
        logger.debug(`[parseThink] 共提取 ${thoughts.length} 条思考内容`);

        return {
            cleaned,
            thoughts
        };
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

    static async createNewBot(guildId: string, platform: string): Promise<ChatBot> {
        const bot = await ChatBot.createBotInstance()
        bot.setSystemPrompt(ConfigService.getSystemPrompt(guildId))
        ChatBot.persistBotToDB(bot, guildId, platform)
        chatBots.set(guildId, bot)
        return bot
    }

    // static replaceSystemPrompt(template: string, guildId: string) {
    //     return template.replace('【guildId】', `[${guildId}]`)
    // }

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

    /**
     * 尝试从数据库中恢复聊天机器人实例
     * 
     * 此函数异步地尝试根据给定的 guildId 和 platform 从数据库中查找并恢复一个聊天机器人实例
     * 它首先查询数据库以找到匹配的记录，如果记录存在且包含聊天机器人的历史记录，则创建一个新的聊天机器人实例
     * 并用这些历史记录进行初始化如果没有找到合适的记录，或者出现错误，函数将返回 null
     * 
     * @param guildId {string} - 服务器/群组的唯一标识符
     * @param platform {string} - 聊天平台的类型
     * @returns {Promise<ChatBot | null>} - 返回一个 Promise，解析为 ChatBot 实例或 null
     */
    static async tryRestoreFromDB(guildId: string, platform: string): Promise<ChatBot | null> {
        try {
            // 寻找匹配的记录
            const [guildIdFind] = await data.ctx.database.get('channel', {
                id: guildId,
                platform: platform,
            })

            // 如果找不到有效的记录或记录中没有聊天机器人的历史，返回 null
            if (!guildIdFind?.chatbot?.history) return null

            // 提取历史记录并创建聊天机器人实例
            const { history } = guildIdFind.chatbot
            const bot = await ChatBot.createBotInstance()

            // 如果历史记录长度大于 1，将其赋值给新创建的聊天机器人实例
            if (history?.length > 1)
                bot.history = history
            // 配置聊天机器人的系统提示
            bot.setSystemPrompt(ConfigService.getSystemPrompt(guildId))

            // 返回初始化完毕的聊天机器人实例
            return bot
        } catch (error) {
            // 如果发生错误，记录警告并返回 null
            data.ctx.logger.warn(`数据库查询失败: ${error.message}`)
            return null
        }
    }
}

export const chatBots: Map<string, ChatBot> = new Map<string, ChatBot>()
