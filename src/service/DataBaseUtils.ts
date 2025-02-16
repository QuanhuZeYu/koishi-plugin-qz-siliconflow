import { data } from "..";

export class DataBaseUtils {


    static async getUser(userId: string): Promise<qz_siliconflow> {
        const ctx = data.ctx;
        // 检查数据库中是否存在该用户
        let user = await ctx.database.get(`qz_siliconflow`, { userId });

        if (user.length > 0) {
            let userTake = user[0];
            // 补全缺失字段并设置默认值
            if (userTake.useToken === undefined) userTake.useToken = 0;
            if (userTake.level === undefined) userTake.level = 0;

            // Token 相关字段初始化 老用户缺失
            if (userTake.maxToken === undefined || userTake.maxToken === 0) {
                userTake.maxToken = 10_000;
                if (userTake.remain === undefined || userTake.remain === 0) {
                    userTake.remain = 10_000;
                }
            }

            // 更新可能存在缺失字段的记录
            await ctx.database.upsert(`qz_siliconflow`, [userTake]);
            return userTake;
        } else {
            // 创建包含全部字段的新用户
            const newUser = {
                userId,
                useToken: 0,
                maxToken: 10_000,
                remain: 10_000,
                level: 0
            };
            await ctx.database.upsert(`qz_siliconflow`, [newUser]);
            return newUser;
        }
    }
}