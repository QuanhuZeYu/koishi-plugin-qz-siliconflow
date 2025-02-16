import { Context, Service, Session } from "koishi";
import { ChatBot } from "../siliconFlow/chatBot";
import { data } from "..";
import { Utils } from "../utils/Utils";
import { DataBaseUtils } from "./DataBaseUtils";

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

    async getUser(userId: string) {
        return DataBaseUtils.getUser(userId)
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
            .replaceAll('$guildId', session.guildId)
            .replaceAll('$userName', userNick)
            .replaceAll(`$favorable`, level.toString())
    }

    async createAiBot() {
        this.aiBot = await ChatBot.createBotInstance(undefined)
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