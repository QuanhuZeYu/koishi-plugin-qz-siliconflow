import { Next, Session } from "koishi";
import { data } from "..";
import { ChatBot, chatBots } from "../siliconFlow/chatBot";

export async function onMessageRecive(session: Session, next: Next) {
    if (session.userId === session.bot.userId) return next() // 跳过机器人消息
    // 获取群聊实例的 chatbot
    const bot = await ChatBot.getBot(session)
    const nickname = session.username
    bot.addUserPrompt(`{ "userName": "${nickname}","userContent": "${session.content}" }`)
    return next()
}