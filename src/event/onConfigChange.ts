import { Schema } from "koishi";
import { chatBots } from "../siliconFlow/chatBot";
import { data } from "..";
import { ConfigService } from "../service/ConfigService";

export class ConfigEvent {
    static async onConfigChange() {
        // ConfigEvent.debugprint()
        const logger = data.ctx.logger;
        data.config = data.ctx.config;

        // 更新对话实例
        chatBots.forEach((bot, channelId) => {
            const config = data.config;
            bot.api$chat = ConfigService.getApiEndpoint() + `/chat/completions`
            bot.apiKey = ConfigService.getApiKey()
            bot.model = ConfigService.getModelId()
            ConfigService.getSystemPrompt()
            bot.maxtokens = ConfigService.getMaxToken()
            bot.temperature = ConfigService.getTemperature()
        });

        logger.info(`缓存对话实例已更新完毕`);
    }

    static async updateConfigSystemPrompt() {
        chatBots.forEach((bot, channelId) => {
            const logger = data.ctx.logger
            const config = data.config
            // 获取系统提示，优先使用 bot.history 中的内容
            const botSystemPrompt = bot.history?.[0]?.content ?? ConfigService.getSystemPrompt()

            // 确保 guildId 存在
            if (!config.perGuildConfig[channelId]) {
                config.perGuildConfig[channelId] = {};
            }

            logger.info(`${channelId} 的系统提示已更新为：${botSystemPrompt}`)

            // 更新系统提示
            config.perGuildConfig[channelId].systemPrompt = botSystemPrompt;
        });
    }

    static debugprint() {
        console.log(data.config);
    }
}
