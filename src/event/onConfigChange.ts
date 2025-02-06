import { Schema } from "koishi";
import { chatBots } from "../siliconFlow/chatBot";
import { ChatBotUtils } from "../siliconFlow/utils";
import { ConfigUtil } from "../utils";
import { data } from "..";

export class ConfigEvent {
    static async onConfigChange() {
        // ConfigEvent.debugprint()
        const logger = data.ctx.logger;
        data.mainConfig = data.ctx.config;

        // 更新对话实例
        chatBots.forEach((bot, channelId) => {
            const config = data.mainConfig;
            bot.api$chat = ConfigUtil.getEndPoint(config) + `/chat/completions`
            bot.apiKey = ConfigUtil.getApiKey(config)
            bot.model = ConfigUtil.getModel(config)
            ChatBotUtils.configureSystemPrompt(bot, channelId);
            bot.maxtokens = data.mainConfig.chatConfig.maxToken;
            bot.temperature = data.mainConfig.chatConfig.temperature;
        });

        logger.info(`缓存对话实例已更新完毕`);
    }

    static async updateConfigSystemPrompt() {
        chatBots.forEach((bot, channelId) => {
            const logger = data.ctx.logger
            const config = data.mainConfig.chatConfig
            // 获取系统提示，优先使用 bot.history 中的内容
            const botSystemPrompt = bot.history?.[0]?.content ?? config.systemPrompt;

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
        console.log(data.mainConfig);
    }
}
