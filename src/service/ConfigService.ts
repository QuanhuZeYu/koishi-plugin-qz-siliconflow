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

    constructor(ctx: Context) {
        super(ctx, ConfigService.SERVICE_NAME)
        this.ctx = ctx
        ctx.model.extend('channel', {
            chatbot: 'json',
        })
        this.dynamicConfig()
    }

    dynamicConfig() {
        const ctx = data.ctx
        const config: Config = data.ctx.config
        const select = config.select
        const unionSchema = Schema.union(
            Object.entries(config.baseConfig).map(([key, value]) => {
                const { modelId, apiEndpoint, apiKey, platform } = value
                const schema = Schema.object({
                    platform: Schema.const(platform).default(platform).description('平台').required(),
                    apiEndpoint: Schema.const(apiEndpoint).default(apiEndpoint).description('API地址').required(),
                    apiKey: Schema.const(apiKey).default(apiKey).role('secret').description('API密钥').required(),
                    modelId: Schema.const(modelId).default(modelId).description('模型ID').required()
                }).default({
                    platform: platform,
                    apiEndpoint: apiEndpoint,
                    apiKey: apiKey,
                    modelId: modelId
                })
                    .description(`${platform}: ${modelId}`)
                return schema
            })
        )
        ctx.schema.set(`${ConfigService.SERVICE_NAME}`, unionSchema)
        ctx.logger.info(`当前选择: `, ctx.config.select)
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

    static async getModelList(ctx: Context) {
        const apikey = ConfigService.getApiKey()
        try {
            const response = await fetch(`${ConfigService.getApiEndpoint()}/models`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apikey}`
                }
            })
            // 处理HTTP错误状态
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorData.error?.message}`);
            }
            // 解析并断言响应类型
            const data = await response.json() as ModelResponse
            return data.data;
        } catch (error) {
            // 增强错误处理
            if (error instanceof Error) {
                throw new Error(`获取模型列表失败: ${error.message}`);
            }
            throw new Error('发生未知错误');
        }
    }
}