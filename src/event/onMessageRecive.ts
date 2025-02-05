import { Next, Session } from "koishi";
import { data } from "..";
import { chatBots } from "../siliconFlow/chatBot";
import { ChatBotUtils } from "../siliconFlow/utils";

export async function onMessageRecive(session: Session, next: Next) {
    if (session.userId === session.bot.userId) return next() // 跳过机器人消息

    const bot = await ChatBotUtils.getBot(session)
    const nickname = session.username
    bot.addUserPrompt(`{ "userName": "${nickname}","userContent": "${session.content}" }`)
    return next()
}