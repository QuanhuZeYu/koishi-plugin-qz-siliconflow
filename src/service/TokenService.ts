import { Context, Service } from "koishi";
import { DataBaseUtils } from "./DataBaseUtils";

declare module "koishi" {
    interface Context {
        qz_siliconflow_tokenservice: TokenService
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
            remain: 'decimal'
        }, {
            primary: 'userId',
            autoInc: false
        })
    }

    async getUser(userId: string) {
        return DataBaseUtils.getUser(userId)
    }

    async updateUser(userId: string, useToken?: number, maxToken?: number) {
        let user = await this.getUser(userId)
        const oldUse = user.useToken
        const oldMax = user.maxToken
        const oldRem = user.remain
        const newUse = useToken ?? oldUse
        const newMax = maxToken ?? oldMax
        const newRem = newMax - newUse
        user = { userId: userId, useToken: newUse, maxToken: newMax, remain: newRem }
        await this.ctx.database.upsert(`qz_siliconflow`, [user])
    }

    async checkUserToken(userId: string) {
        const user = await this.getUser(userId)
        const { remain } = user
        return remain > 0
    }

    async addUserUseToken(userId: string, useToken: number) {
        const user = await this.getUser(userId)
        user.useToken += useToken
        user.remain -= useToken
        await this.ctx.database.upsert(`qz_siliconflow`, [user])
    }
}