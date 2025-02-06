import { Context, Session } from "koishi"
import { ChatBot, chatBots } from "./chatBot"
import { data, Config } from ".."


export class ChatBotUtils {
    static async getBot(session: Session): Promise<ChatBot> {
        const { channelId, platform } = session
        // 尝试从内存缓存获取
        const cachedBot = chatBots.get(channelId)
        if (cachedBot) return cachedBot

        // 尝试从数据库恢复
        const restoredBot = await ChatBotUtils.tryRestoreFromDB(channelId, platform)
        if (restoredBot) {
            chatBots.set(channelId, restoredBot)
            return restoredBot
        }

        // 创建新实例
        return ChatBotUtils.createNewBot(channelId, platform)
    }

    static async tryRestoreFromDB(channelId: string, platform: string): Promise<ChatBot | null> {
        try {
            const [channel] = await data.ctx.database.get('channel', {
                id: channelId,
                platform: platform,
            })

            if (!channel?.chatbot?.history) return null

            const { history } = channel.chatbot
            const bot = ChatBotUtils.createBotInstance()

            if (history?.length > 1)
                bot.history = history
            ChatBotUtils.configureSystemPrompt(bot, channelId)

            return bot
        } catch (error) {
            data.ctx.logger.warn(`数据库查询失败: ${error.message}`)
            return null
        }
    }

    static createNewBot(channelId: string, platform: string): ChatBot {
        const bot = ChatBotUtils.createBotInstance()
        ChatBotUtils.configureSystemPrompt(bot, channelId)
        ChatBotUtils.persistBotToDB(bot, channelId, platform)
        chatBots.set(channelId, bot)
        return bot
    }

    /**
     * 更新实例中的系统提示词
     * 优先级:
     * 1. 配置表
     * 2. 历史记录中第一个消息
     * 3. 默认值
     * @param bot 
     * @param channelId 
     */
    static configureSystemPrompt(bot: ChatBot, channelId: string) {
        const logger = data.ctx.logger
        const config = data.config
        const systemPrompt =
            config.perGuildConfig[channelId]?.systemPrompt || // 优先级 1：从频道配置中获取
            (bot?.history?.[0]?.content || undefined) ||     // 优先级 2：从 bot 历史记录中获取
            ConfigService.getSystemPrompt()                // 优先级 3：从基础配置中获取

        bot.setSystemPrompt(
            ChatBotUtils.replaceSystemPrompt(systemPrompt, channelId)
        )
    }

    static replaceSystemPrompt(template: string, channelId: string) {
        return template.replace('【channelId】', `[${channelId}]`)
    }

    static createBotInstance(): ChatBot {
        return new ChatBot(
            ConfigService.getApiEndpoint(),
            ConfigService.getApiKey(),
            ConfigService.getModelId(),
            data.ctx.logger
        )
    }

    static async persistBotToDB(bot: ChatBot, channelId: string, platform: string) {
        try {
            await data.ctx.database.set('channel',
                { id: channelId, platform },
                {
                    chatbot: {
                        guildId: channelId,
                        history: bot.history,
                    }
                }
            )
            data.ctx.logger.info(`成功持久化 ${channelId} 的对话机器人`)
        } catch (error) {
            data.ctx.logger.warn(`数据库写入失败: ${error.message}`)
        }
    }
}