import { Context } from "koishi";
import { TokenService } from "./TokenService";
import { ConfigService } from "./ConfigService";
import { ChatBot } from "../siliconFlow/chatBot";

export class KoishiChat {

    static COMMAND_CHAT = 'chat'
    static COMMAND_CHAT_NOHISTORY = 'chatnh'
    static COMMAND_CHAT_CLEAR = 'chat-clear'

    static commandChat(ctx: Context) {
        ctx.inject([TokenService.SERVICE_NAME, ConfigService.SERVICE_NAME], ctx => {
            // region command Chat
            ctx.command(`${this.COMMAND_CHAT} <message:text>`, '与AI对话')
                .action(async (v, message) => {
                    const chatbot = await ChatBot.getBot(v.session)
                    const userid = v.session.userId
                    const nickname = v.session.username
                    const messageSend = `{"userName":"${nickname}", "userContent":"${message}"}`
                    if (await ctx.qz_siliconflow_tokenservice.checkUserToken(userid) === false) {
                        // const remainToken = userInfo?.maxToken - userInfo?.useToken
                        return await v.session.send(`{${nickname}}: token用量达到上限`)
                    }
                    const response = await chatbot.sendMessageWithHistory(messageSend)
                    // 更新用量
                    const useInfo = response.useInfo
                    const totalUse = useInfo?.totalTokens
                    const user = await ctx.qz_siliconflow_tokenservice.getUser(v.session.userId)
                    if (totalUse) {
                        ctx.qz_siliconflow_tokenservice.addUserUseToken(v.session.userId, totalUse)
                    }
                    const forwardMessage = (
                        <message forward >
                            <message>
                                <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                {`剩余额度: ${user.remain - totalUse}`}
                            </message>
                            <message>
                                <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                {response.commonResponse}
                            </message>
                            {/* 如果response.jsonResponse不为空，则发送jsonResponse */}
                            {response.jsonResponse && (
                                <message>
                                    <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                    {response.jsonResponse}
                                </message>
                            )}
                        </message>
                    )
                    await v.session.send(forwardMessage)
                    if (response.jsonResponse) {
                        await v.session.send(response.jsonResponse)
                    }

                })
            // endregion
        })
    }

    static commandChatNH(ctx: Context) {
        ctx.inject([TokenService.SERVICE_NAME, ConfigService.SERVICE_NAME], ctx => {
            // region command Chat-clear
            ctx.command(`${this.COMMAND_CHAT_NOHISTORY} <message:text>`, '与AI对话_nh--NoHistory无历史记录单聊')
                .alias('qz-sf-nh')
                .action(async (v, message) => {
                    const chatbot = await ChatBot.getBot(v.session)
                    const userid = v.session.userId
                    const nickname = v.session.username
                    const messageSend = `{"userName":"${nickname}", "userContent":"${message}"}`
                    if (!ctx.qz_siliconflow_tokenservice.checkUserToken(userid)) {
                        // const remainToken = userInfo?.maxToken - userInfo?.useToken
                        return await v.session.send(`${nickname}: token用量达到上限`)
                    }
                    const response = await chatbot.sendMessage(messageSend)
                    // 更新用量
                    const useInfo = response.useInfo
                    const totalUse = useInfo?.totalTokens
                    const user = await ctx.qz_siliconflow_tokenservice.getUser(v.session.userId)
                    if (totalUse) {
                        ctx.qz_siliconflow_tokenservice.addUserUseToken(v.session.userId, totalUse)
                    }
                    const forwardMessage = (
                        <message forward >
                            <message>
                                <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                {`额度: ${user?.maxToken - user?.useToken}, 当前使用额度: ${user?.useToken + totalUse}, 剩余: ${user?.maxToken - user?.useToken - totalUse}`}
                            </message>
                            <message>
                                <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                {response.commonResponse}
                            </message>
                            {/* 如果response.jsonResponse不为空，则发送jsonResponse */}
                            {
                                response.jsonResponse && (
                                    <message>
                                        <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                        {response.jsonResponse}
                                    </message>
                                )
                            }
                        </message>
                    )
                    await v.session.send(forwardMessage)
                    if (response.jsonResponse) {
                        await v.session.send(response.jsonResponse)
                    }

                })
            // endregion
        })
    }

    static commandChatModelList(ctx: Context) {
        // region command Chat-models
        ctx.command('chat-models', '获取可用模型列表')
            .alias('qz-sf-models')
            .action(async (v, message) => {
                const models = await ConfigService.getModelList(ctx)
                let stringBuilder: string = ''
                models.forEach(element => {
                    stringBuilder += element.id + '\n'
                    ctx.logger.info(`模型名称: ${element.id}`)
                })
                const response = (
                    <message forward>
                        <message>
                            <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                            {stringBuilder}
                        </message>
                    </message>
                )
                await v.session.send(response)
            })
        // endregion
    }

    static commandChatClear(ctx: Context) {
        // region command Chat-clear
        ctx.command(`${this.COMMAND_CHAT_CLEAR}`, '清除聊天记录')
            .alias('qz-sf-clear')
            .action(async (v, message) => {
                const bot = await ChatBot.getBot(v.session)
                const originLength = bot.history.length
                bot.clearHistory()
                await v.session.send(`清除了${originLength - 1}条聊天记录`)
            })
        // endregion
    }

    static onPoke(ctx: Context) {
        ctx.on(`internal/listener`, (name, listener, prepend) => {

        })
    }

    static collectMessage(ctx: Context) {
        ctx.middleware(async (session, next) => {
            if (session.userId === session.bot.userId) return next() // 跳过机器人消息
            // 获取群聊实例的 chatbot
            const bot = await ChatBot.getBot(session)
            const nickname = session.username
            bot.addUserPrompt(`{ "userName": "${nickname}","userContent": "${session.content}" }`)
            return next()
        })
    }
}
