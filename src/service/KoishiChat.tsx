import { Context, Session } from "koishi";
import { TokenService } from "./TokenService";
import { ConfigService } from "./ConfigService";
import { ChatBot } from "../siliconFlow/chatBot";
import { } from "@koishijs/plugin-adapter-satori"
import { OneBot } from "koishi-plugin-adapter-onebot"
import { FavorableSystem } from "./FavorableSystem";
import { Config, data } from "..";

declare module 'koishi' {
    interface Events {
        notice(session: Session): void
    }
    interface Session {
        targetId: string;
    }
}

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
                                    {/* 截取前 100 字符，并确保类型为字符串 */}
                                    {response.jsonResponse.length > 100
                                        ? `${response.jsonResponse.slice(0, 100)}...`
                                        : response.jsonResponse
                                    }
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
            // region command Chat-NH
            ctx.command(`${this.COMMAND_CHAT_NOHISTORY} <message:text>`, '与AI对话_nh--NoHistory无历史记录单聊')
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
                            {response.jsonResponse && (
                                <message>
                                    <author id={v.session.bot.user.id} name={v.session.bot.user.name} />
                                    {/* 截取前 100 字符，并确保类型为字符串 */}
                                    {response.jsonResponse.length > 100
                                        ? `${response.jsonResponse.slice(0, 100)}...`
                                        : response.jsonResponse
                                    }
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
        const logger = ctx.logger
        // region onPoke
        ctx.inject([FavorableSystem.SERVICE_NAME], (ctx_) => {
            ctx_.on(`notice`, async (session) => {
                if (session.subtype !== `poke`) {
                    return
                }
                if (session.targetId !== session.bot.userId) {
                    return
                }
                if (session.isDirect) {
                    return
                }
                // 尝试反戳回去
                const param = { user_id: session.userId, group_id: session.guildId }
                await (session.bot.internal as OneBot.Internal)._request(`group_poke`, param)
                // 获取用户等级并确保非负
                let level = await ctx_.qz_filiconflow_favorable_system.getLevel(session.userId)
                if (level < 0) level = 0;
                // 获取配置中的等级并正确排序
                const config = ctx.config as Config
                const allLevel = config.pokeFavorable.levels
                    .map(l => l.level)
                    .sort((a, b) => a - b) // 升序
                // 找到匹配的最大等级
                let matchedLevel = 0
                for (const current of allLevel) {
                    if (current > level) break // 已排序，后续元素更大，无需继续
                    matchedLevel = current
                }
                // 更新最终等级
                level = matchedLevel;
                const prompt = config.pokeFavorable.levels.find(l => l.level === level)?.prompt
                const aiBot = ctx_.qz_filiconflow_favorable_system.aiBot
                const response = await aiBot.sendMessage(FavorableSystem.replacePrompt(prompt, session))
                const { commonResponse, useInfo, jsonResponse } = response
                await session.send(jsonResponse)
                // await session.send(`${session.username} 戳了戳我`)
            })
        })
        // endregion
    }

    static collectMessage(ctx: Context) {
        // region collectMessage
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

// region tools
function searchStringInObject(obj, target, options: any = {}) {
    const visited = new WeakSet(); // 避免循环引用
    const { caseSensitive = false } = options;

    function _search(current) {
        if (typeof current === 'string') {
            const str = caseSensitive ? current : current.toLowerCase();
            const targetStr = caseSensitive ? target : target.toLowerCase();
            return str.includes(targetStr);
        }

        if (typeof current !== 'object' || current === null) {
            return false;
        }

        // 防止循环引用
        if (visited.has(current)) {
            return false;
        }
        visited.add(current);

        // 遍历数组或对象
        if (Array.isArray(current)) {
            for (const item of current) {
                if (_search(item)) return true;
            }
        } else {
            for (const key of Object.keys(current)) {
                if (_search(current[key])) return true;
            }
        }

        return false;
    }

    return _search(obj);
}