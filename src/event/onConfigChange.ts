import { data } from "..";
import { chatBots } from "../siliconFlow/chatBot";
import { ChatBotUtils } from "../siliconFlow/utils";

export class ConfigEvent {
    static async onConfigChange() {
        // ConfigEvent.debugprint()
        const logger = data.ctx.logger;
        data.config = data.ctx.config;

        // 更新对话实例
        chatBots.forEach((bot, channelId) => {
            bot.api$chat = data.config.baseConfig.apiEndpoint[0] + `/chat/completions`;
            bot.apiKey = data.config.baseConfig.apiKey[0].key;
            bot.model = data.config.baseConfig.model[0].id;
            ChatBotUtils.configureSystemPrompt(bot, channelId);
            bot.maxtokens = data.config.detail.maxToken;
            bot.temperature = data.config.detail.temperature;
        });

        logger.info(`缓存对话实例已更新完毕`);
    }

    static async updateConfigSystemPrompt() {
        chatBots.forEach((bot, channelId) => {
            const logger = data.ctx.logger
            const config = data.config
            // 获取系统提示，优先使用 bot.history 中的内容
            const botSystemPrompt = bot.history?.[0]?.content ?? data.config.baseConfig.systemPrompt;

            // 确保 guildId 存在
            if (!config.perGuildConfig[channelId]) {
                config.perGuildConfig[channelId] = {};
            }

            logger.info(`${channelId} 的系统提示已更新为：${botSystemPrompt}`)

            // 更新系统提示
            data.config.perGuildConfig[channelId].systemPrompt = botSystemPrompt;
        });
    }

    static debugprint() {
        console.log(data.config);
    }
}
