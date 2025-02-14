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
                const {
                    modelId = '',
                    apiEndpoint = '',
                    apiKey = '',
                    platform = ''
                } = value || {};
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
        return prompt.replaceAll('$guildId', guildId);
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
        const logger = ctx.logger
        const apikey = ConfigService.getApiKey()

        // 记录方法开始执行
        logger.debug('开始获取模型列表')

        try {
            const apiEndpoint = ConfigService.getApiEndpoint()
            // 脱敏处理API密钥，只显示前5位
            logger.debug(`准备请求接口: ${apiEndpoint}/models，使用API密钥: ${apikey.slice(0, 5)}***`)

            const response = await fetch(`${apiEndpoint}/models`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apikey}`
                }
            })

            // 记录响应状态
            logger.debug(`收到API响应，状态码: ${response.status} ${response.statusText}`)

            if (!response.ok) {
                const errorData = await response.json();
                // 记录HTTP错误详情
                logger.debug(`API请求失败详情: [${response.status}] ${errorData.error?.message || '无错误详情'}`)
                throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorData.error?.message}`);
            }

            const data = await response.json() as ModelResponse
            // 记录获取到的模型数量
            logger.debug(`成功获取模型列表，共${data.data?.length || 0}个模型`)

            return data.data;
        } catch (error) {
            // 记录完整错误信息（包含堆栈）
            logger.debug('获取模型列表异常详情:', error)

            if (error instanceof Error) {
                throw new Error(`获取模型列表失败: ${error.message}`);
            }
            throw new Error('发生未知错误');
        }
    }

}