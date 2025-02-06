import { Context, Schema, Service } from "koishi"
import { platform } from "os"
import { Config, data } from ".."
import { ChatBot, chatBots } from "../siliconFlow/chatBot"
import { ChatBotUtils } from "../siliconFlow/utils"


declare module 'koishi' {
    interface Context {
        "qz-siliconflow-configservice-v1": ConfigService
    }
}
export class ConfigService extends Service {
    static SERVICE_NAME = `qz-siliconflow-configservice-v1`

    constructor(ctx: any) {
        super(ctx, ConfigService.SERVICE_NAME)
        this.ctx = ctx
        ctx.model.extend('channel', {
            chatbot: 'json',
        })
    }

    dynamicConfig(ctx: Context) {
        const config: Config = ctx.config
        const unionSchema = Schema.union(config.baseConfig.map(item => {
            return Schema.object({
                platform: Schema.string().default(item.platform.name).description('平台'),
                apiEndpoint: Schema.string().default(item.platform.apiEndpoint).description('API地址'),
                apiKey: Schema.string().default(item.platform.apiKey).role(`secret`).description('API密钥'),
                modelId: Schema.string().default(item.modelId?.[0]).description('模型ID')
            }).collapse(true).role(`group`)
                .description(`${item?.platform.name}: ${item.modelId?.[0]}`)
        }))
        ctx.schema.set(`${ConfigService.SERVICE_NAME}`, unionSchema)
        config.select = {
            platform: config.baseConfig?.[0].platform.name,
            apiEndpoint: config.baseConfig?.[0].platform.apiEndpoint,
            apiKey: config.baseConfig?.[0].platform.apiKey,
            modelId: config.baseConfig?.[0].modelId?.[0]
        }
        ctx.logger.info(`当前选择: { platform: ${config.select.platform}, apiEndpoint: ${config.select.apiEndpoint}, apiKey: ${Boolean(config.select.apiKey)}, modelId: ${config.select.modelId} }`)
    }

    static getApiEndpoint() {
        const config: Config = data.ctx.config
        return config.select?.apiEndpoint
    }
    static getApiKey() {
        const config: Config = data.ctx.config
        return config.select?.apiKey
    }
    static getModelId() {
        const config: Config = data.ctx.config
        return config.select?.modelId
    }
    static getMaxToken() {
        const config: Config = data.ctx.config
        return config.detail?.maxToken
    }
    static getTemperature() {
        const config: Config = data.ctx.config
        return config.detail?.temperature
    }
    static getMaxHistory() {
        const config: Config = data.ctx.config
        return config.detail?.maxHistory
    }
    static getSystemPrompt() {
        const config: Config = data.ctx.config
        return config.detail?.systemPrompt
    }

    static async onConfigChange() {
        // ConfigEvent.debugprint()
        const logger = data.ctx.logger;
        data.config = data.ctx.config;

        // 更新对话实例
        chatBots.forEach((bot, channelId) => {
            bot.api$chat = ConfigService.getApiEndpoint() + `/chat/completions`;
            bot.apiKey = ConfigService.getApiKey();
            bot.model = ConfigService.getModelId();
            ChatBotUtils.configureSystemPrompt(bot, channelId);
            bot.maxtokens = data.config.detail.maxToken;
            bot.temperature = data.config.detail.temperature;
            this.updateConfigSystemPrompt(bot, channelId);
        });

        logger.info(`缓存对话实例已更新完毕`);
    }
    static async updateConfigSystemPrompt(bot: ChatBot, channelId: string) {
        const logger = data.ctx.logger;
        const config = data.config;
        // 获取系统提示，优先使用 bot.history 中的内容
        const botSystemPrompt = bot.history?.[0]?.content ?? ConfigService.getSystemPrompt();

        // 确保 guildId 存在
        if (!config.perGuildConfig[channelId]) {
            config.perGuildConfig[channelId] = {};
        }

        logger.info(`${channelId} 的系统提示已更新为：${botSystemPrompt}`);

        // 更新系统提示
        data.config.perGuildConfig[channelId].systemPrompt = botSystemPrompt;
    }
}