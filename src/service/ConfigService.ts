import { Context, Schema, Service } from "koishi"
import { platform } from "os"
import { Config, data } from ".."
import { ChatBot, chatBots } from "../siliconFlow/chatBot"


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
        ctx.logger.info(`当前选择: { platform: `, select.platform, `, apiEndpoint: `, select.apiEndpoint, `, apiKey: `, Boolean(select.apiKey), `, modelId: `, select.modelId, ` }`)
    }

    static getPlatform() {
        const config: Config = data.ctx.config
        return config.select?.platform
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
    static getSystemPrompt(guildId?: string) {
        // 使用空值合并运算符(??)替代逻辑或(||)以保留空字符串值
        const getFallbackPrompt = () =>
            this.replaceMarket(data?.ctx?.config?.detail?.systemPrompt, guildId)
        // 安全访问对象属性
        const findGuildPrompt = () => {
            try {
                return this.replaceMarket(data?.config?.perGuildConfig
                    ?.find(item => item?.guildId === guildId)
                    ?.systemPrompt, guildId)
            } catch {
                return undefined;
            }
        };

        // 显式处理优先级逻辑
        if (guildId) {
            return findGuildPrompt() ?? getFallbackPrompt();
        }
        return getFallbackPrompt();
    }
    static replaceMarket(prompt: string, guildId?: string) {
        // 找到 $guilId 替换为 guildId
        return prompt.replace('$guildId', guildId);
    }

    static async onConfigChange() {
        // ConfigEvent.debugprint()
        const logger = data.ctx.logger;
        data.config = data.ctx.config;

        // 更新对话实例（异步并行版本）
        await Promise.all(Array.from(chatBots.entries()).map(async ([guildId, bot]) => {
            // 同步操作
            bot.api$chat = ConfigService.getApiEndpoint() + `/chat/completions`;
            bot.apiKey = ConfigService.getApiKey();
            bot.model = ConfigService.getModelId();
            bot.maxtokens = ConfigService.getMaxToken();
            bot.temperature = ConfigService.getTemperature();

            // 并行执行异步操作（如果配置方法中有异步操作）
            await Promise.all([
                bot.setSystemPrompt(ConfigService.getSystemPrompt(guildId)),
            ])
        }))

        logger.info(`缓存对话实例已更新完毕`);
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