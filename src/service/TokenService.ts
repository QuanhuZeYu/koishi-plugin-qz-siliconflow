import { Context, Service } from "koishi";

declare module "koishi" {
    interface Context {
        qz_siliconflow_tokenservice: TokenService
    }
    interface Tables {
        qz_siliconflow: {
            userId: string
            useToken: number
            maxToken: number
        }
    }
}
export class TokenService extends Service {

    static inject = [`database`]
    static SERVICE_NAME = "qz_siliconflow_tokenservice"
    constructor(ctx: Context) {
        super(ctx, TokenService.SERVICE_NAME)
        this.ctx = ctx
        this.config = ctx.config
        this.databaseInit()
    }

    async databaseInit() {
        this.ctx.database.extend(`qz_siliconflow`, {
            userId: 'string',
            useToken: 'decimal',
            maxToken: 'decimal',
        }, {
            primary: 'userId',
            autoInc: false
        })
    }

    /**
     * 异步检查用户是否存在，如果不存在则插入新用户
     * 
     * 此函数首先查询数据库中是否存在给定userId的用户如果用户存在，则返回该用户的信息
     * 如果用户不存在，则创建一个新的用户记录并插入到数据库中，然后返回该新用户的信息
     * 
     * @param userId 用户的唯一标识符用于查询或插入用户记录
     * @returns 返回一个用户对象如果找到现有用户或新插入的用户
     */
    async getUser(userId: string) {
        // 检查数据库中是否存在该user
        let user = await this.ctx.database.get(`qz_siliconflow`, { userId })
        if (user.length > 0) {
            return user[0]
        } else {
            // 如果不存在，则插入一条记录
            user = [{ userId: userId, useToken: 0, maxToken: 10_000 }]
            await this.ctx.database.upsert(`qz_siliconflow`, user)
            return user[0]
        }
    }

    async updateUser(userId: string, useToken?: number, maxToken?: number) {
        let user = await this.getUser(userId)
        user = { userId: userId, useToken: useToken ?? user.useToken, maxToken: maxToken ?? user.maxToken }
        await this.ctx.database.upsert(`qz_siliconflow`, [user])
    }

    async checkUserToken(userId: string) {
        const user = await this.getUser(userId)
        const { useToken, maxToken } = user
        return useToken < maxToken
    }

    async addUserUseToken(userId: string, useToken: number) {
        const user = await this.getUser(userId)
        user.useToken += useToken
        await this.ctx.database.upsert(`qz_siliconflow`, [user])
    }
}