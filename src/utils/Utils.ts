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

    static async getGroupName(session: Session) {
        let groupName: string = ''
        if (session?.onebot) {
            groupName = (await session.onebot.getGroupInfo(session.guildId)).group_name
        }
        groupName = groupName ?? session?.event?.guild?.name ?? (await session?.bot?.getGuild(session.guildId))?.name ?? session.guildId
        return groupName
    }
}