import { Context, Session } from "koishi";
import { TokenService } from "./TokenService";
import { ConfigService } from "./ConfigService";
import { ChatBot } from "../siliconFlow/chatBot";
import { } from "@koishijs/plugin-adapter-satori"
import { OneBot } from "koishi-plugin-adapter-onebot"
import { FavorableSystem } from "./FavorableSystem";
import { Config, data } from "..";
import { randomInt } from "crypto";
import { Utils } from "../utils/Utils";

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
                    const nickname = await Utils.getGroupUserNickName(v.session)
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
                    const nickname = await Utils.getGroupUserNickName(v.session)
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
        const config = ctx.config as Config
        logger.debug('[onPoke] 注册戳一戳事件处理器')

        // region onPoke
        ctx.inject([FavorableSystem.SERVICE_NAME], async ctx_ => {
            logger.debug('[onPoke] 依赖注入完成，注册notice监听')

            ctx_.on('notice', async (session) => {
                logger.debug(`[onPoke] 接收到notice事件，类型: ${session.subtype}，用户: ${session.userId}，群组: ${session.guildId}`)

                // 事件类型过滤
                if (session.subtype !== 'poke') {
                    logger.debug('[onPoke] 忽略非poke类型notice事件')
                    return
                }

                // 目标检查
                if (session.targetId !== session.bot.userId) {
                    logger.debug(`[onPoke] 忽略非指向机器人的poke事件，目标ID: ${session.targetId}`)
                    return
                }

                // 私聊过滤
                if (session.isDirect) {
                    logger.debug('[onPoke] 忽略私聊poke事件')
                    return
                }

                try {
                    // 反戳逻辑
                    const param = {
                        user_id: session.userId,
                        group_id: session.guildId
                    }
                    logger.debug(`[onPoke] 尝试反戳用户，参数: ${JSON.stringify(param)}`)

                    await (session.bot.internal as OneBot.Internal)._request('group_poke', param)
                    logger.debug('[onPoke] 反戳操作成功完成')

                    // 增加好感逻辑
                    const maxLevel = config.pokeFavorable?.maxFavorable ?? 200
                    let levelP = await ctx_.qz_filiconflow_favorable_system.getLevel(session.userId)
                    levelP = Math.min(levelP + (randomInt(1, 10) * 0.1), maxLevel) // 确保不超过最大值
                    await ctx_.qz_filiconflow_favorable_system.setLevel(session.userId, levelP)

                    // 等级获取逻辑
                    let level: number
                    try {
                        level = await ctx_.qz_filiconflow_favorable_system.getLevel(session.userId)
                        logger.debug(`[onPoke] 原始用户等级获取成功，用户ID: ${session.userId}，等级: ${level}`)
                    } catch (error) {
                        logger.error(`[onPoke] 获取用户等级失败，用户ID: ${session.userId}，错误: ${error.message}`)
                        throw error
                    }

                    // 等级修正
                    if (level < 0) {
                        logger.debug(`[onPoke] 等级修正（负数调整为0），原等级: ${level}`)
                        level = 0
                    }

                    // 配置处理
                    logger.debug(`[onPoke] 获取配置: ${JSON.stringify(config.pokeFavorable)}`)

                    const rawLevels = config.pokeFavorable.levels.map(l => l.level)
                    logger.debug(`[onPoke] 原始等级列表: ${rawLevels.join(', ')}`)

                    const allLevel = rawLevels.sort((a, b) => a - b)
                    logger.debug(`[onPoke] 排序后等级列表: ${allLevel.join(', ')}`)

                    // 等级匹配逻辑
                    let matchedLevel = 0
                    logger.debug(`[onPoke] 开始等级匹配，当前等级: ${level}`)

                    for (const current of allLevel) {
                        logger.debug(`[onPoke] 检查等级 ${current}`)
                        if (current > level) {
                            logger.debug(`[onPoke] 当前等级 ${current} 超过用户等级 ${level}，终止匹配`)
                            break
                        }
                        matchedLevel = current
                        logger.debug(`[onPoke] 暂时匹配等级更新为 ${matchedLevel}`)
                    }
                    logger.debug(`[onPoke] 最终匹配等级: ${matchedLevel}`)
                    level = matchedLevel

                    // 提示语获取
                    const prompt = config.pokeFavorable.levels.find(l => l.level === level)?.prompt
                    logger.debug(`[onPoke] 匹配到等级${level}的提示语: ${prompt || '未找到对应提示语'}`)

                    // AI消息处理
                    const aiBot = ctx_.qz_filiconflow_favorable_system.aiBot
                    logger.debug('[onPoke] 准备发送AI消息')

                    const processedPrompt = await FavorableSystem.replacePrompt(prompt, session)
                    logger.debug(`[onPoke] 处理后的提示语: ${processedPrompt}`)

                    const response = await aiBot.sendMessage(processedPrompt)
                    logger.debug(`[onPoke] AI响应数据: ${JSON.stringify({
                        common: response.commonResponse,
                        useInfo: response.useInfo,
                        json: response.jsonResponse
                    })}`)

                    // 消息发送
                    const { jsonResponse } = response
                    logger.debug(`[onPoke] 准备发送消息，内容长度: ${jsonResponse?.length}`)

                    const qqresponse =
                        <message>
                            <message>
                                <author id={session.bot.user.id} name={session.bot.user.name} />
                                <quote id={session.messageId} />
                                <at id={session.userId} />
                                {' ' + jsonResponse}
                            </message>
                        </message>
                    await session.send(qqresponse)
                    logger.debug('[onPoke] 消息发送成功完成')

                } catch (error) {
                    logger.error(`[onPoke] 处理过程中发生错误: ${error.message}`)
                    logger.error(error.stack)
                    // 可选：发送错误提示
                    // await session.send('处理请求时发生错误，请联系管理员')
                }
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
            const nickname = await Utils.getGroupUserNickName(session)
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
