import { Context, Service, Session } from "koishi";
import { ChatBot } from "../siliconFlow/chatBot";
import { data } from "..";
import { Utils } from "../utils/Utils";

declare module "koishi" {
    interface Context {
        'qz_filiconflow_favorable_system': FavorableSystem
    }
}

export class FavorableSystem extends Service {
    static inject = ['database']
    static SERVICE_NAME = 'qz_filiconflow_favorable_system'

    aiBot: ChatBot
    constructor(ctx: Context) {
        super(ctx, FavorableSystem.SERVICE_NAME)
        this.databaseInit()
        this.createAiBot()
    }

    async databaseInit() {
        this.ctx.database.extend(`qz_siliconflow`, {
            userId: 'string',
            level: 'decimal'
        }, {
            primary: 'userId',
            autoInc: false,
        })
    }

    /**
     * 异步检查用户是否存在，如果不存在则插入新用户
     * 
     * 此函数首先查询数据库中是否存在给定userId的用户如果用户存在，则返回该用户的信息
     * 如果用户不存在，则创建一个新的用户记录并插入到数据库中，然后返回该新用户的信息
     * 
     * @param userId 用户的唯一标识符用于查询或插入用户记录
     * @returns 返回一个用户对象如果找到现有用户或新插入的用户
     */
    async getUser(userId: string) {
        // 检查数据库中是否存在该user
        let user = await this.ctx.database.get(`qz_siliconflow`, { userId })
        if (user.length > 0) {
            return user[0]
        } else {
            // 如果不存在，则插入一条记录
            user = [{ userId: userId, level: 0 }]
            await this.ctx.database.upsert(`qz_siliconflow`, user)
            return user[0]
        }
    }

    async getLevel(userId: string) {
        const user = await this.getUser(userId)
        return user.level
    }

    async setLevel(userId: string, level: number) {
        const user = await this.getUser(userId)
        user.level = level
        await this.ctx.database.upsert(`qz_siliconflow`, [user])
    }

    static async replacePrompt(prompt: string, session: Session) {
        const userId = session.userId
        let userNick: string = await Utils.getGroupUserNickName(session)
        const logger = session.bot.ctx.logger
        const level = (await session.bot.ctx.database.get(`qz_siliconflow`, { userId }))[0].level
        logger.debug(`[replacePrompt] level: ${level}`)
        // 需要将 `$guildId` 替换为 session.guildId `$userName` 替换为 session.username
        return prompt
            .replace('$guildId', session.guildId)
            .replace('$userName', userNick)
            .replace(`$favorable`, level.toString())
    }

    async createAiBot() {
        this.aiBot = await ChatBot.createBotInstance()
        // 为好感ai机器人设定选择的apiEndpoint和apiKey
        await this.configUpdate()
    }

    async configUpdate() {
        const config = data.config
        this.aiBot.api$chat = config.pokeFavorable?.select?.apiEndpoint + `/chat/completions`
        this.aiBot.apiKey = config.pokeFavorable?.select?.apiKey
        this.aiBot.model = config.pokeFavorable?.select?.modelId
        this.aiBot.setSystemPrompt(config.pokeFavorable?.systemPrompt)
    }
}