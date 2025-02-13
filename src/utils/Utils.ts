import { Session } from "koishi";

export class Utils {
    static async getGroupUserNickName(session: Session) {
        let userNick: string = ''
        if (session?.onebot) {
            userNick = (await session.onebot.getGroupMemberInfo(session.guildId, session.userId)).nickname
        }
        userNick = userNick ?? (await session.getUser())?.name ?? session?.event?.user?.nick ?? session.username
        return userNick
    }
}