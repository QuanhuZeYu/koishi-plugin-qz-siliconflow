import { Context, Session } from "koishi"
import { ChatBot, chatBots } from "./chatBot"
import { data, Config } from ".."
import { ConfigService } from "../service/ConfigService"


export class ChatBotUtils {
    static async getBot(session: Session): Promise<ChatBot> {
        const { guildId, platform } = session
        // 尝试从内存缓存获取
        const cachedBot = chatBots.get(guildId)
        if (cachedBot) return cachedBot

        // 尝试从数据库恢复
        const restoredBot = await ChatBotUtils.tryRestoreFromDB(guildId, platform)
        if (restoredBot) {
            chatBots.set(guildId, restoredBot)
            return restoredBot
        }

        // 创建新实例
        return ChatBotUtils.createNewBot(guildId, platform)
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
            const bot = ChatBotUtils.createBotInstance()

            if (history?.length > 1)
                bot.history = history
            ChatBotUtils.configureSystemPrompt(bot, guildId)

            return bot
        } catch (error) {
            data.ctx.logger.warn(`数据库查询失败: ${error.message}`)
            return null
        }
    }

    static createNewBot(guildId: string, platform: string): ChatBot {
        const bot = ChatBotUtils.createBotInstance()
        ChatBotUtils.configureSystemPrompt(bot, guildId)
        ChatBotUtils.persistBotToDB(bot, guildId, platform)
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
    static configureSystemPrompt(bot: ChatBot, guildId: string) {
        const config = data.config
        const perGuildPrompt = config.perGuildConfig.find(item => item?.guildId === guildId)?.systemPrompt
        const botGuildPrompt = bot.getSystemPrompt()
        const globalPrompt = ConfigService.getSystemPrompt()
        const systemPrompt = perGuildPrompt || botGuildPrompt || globalPrompt

        bot.setSystemPrompt(
            ChatBotUtils.replaceSystemPrompt(systemPrompt, guildId)
        )
    }

    static replaceSystemPrompt(template: string, guildId: string) {
        return template.replace('【guildId】', `[${guildId}]`)
    }

    static createBotInstance(): ChatBot {
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