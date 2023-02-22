import { Contact } from '@adiwajshing/baileys'
import {
    userSchema,
    groupSchema,
    contactSchema,
    sessionSchema,
    disabledCommandsSchema,
    TCommandModel,
    TGroupModel,
    TSessionModel,
    TUserModel,
    User,
    Group
} from '../Database'
import { Utils } from '../lib'
import moment from 'moment-timezone'

export class Database {
    public getUser = async (jid: string): Promise<TUserModel> =>
        (await this.user.findOne({ jid })) ||
        (await new this.user({ jid, tag: this.utils.generateRandomUniqueTag() }).save())

    public setExp = async (jid: string, experience: number): Promise<void> => {
        experience = experience + Math.floor(Math.random() * 25)
        await this.updateUser(jid, 'experience', 'inc', experience)
    }

    public updateBanStatus = async (jid: string, action: 'ban' | 'unban' = 'ban'): Promise<void> => {
        await this.updateUser(jid, 'banned', 'set', action === 'ban')
    }

    public updateUser = async (
        jid: string,
        field: keyof User,
        method: 'inc' | 'set',
        update: User[typeof field]
    ): Promise<void> => {
        await this.getUser(jid)
        await this.user.updateOne({ jid }, { [`$${method}`]: { [field]: update } })
    }

    public banUser = async (jid: string, bannedBy: string, bannedIn: string, reason: string) => {
        await this.getUser(jid)
        const time = moment.tz('Etc/GMT').format('MMM D, YYYY HH:mm:ss')
        await this.user.updateOne(
            { jid },
            {
                $set: {
                    'ban.banned': true,
                    'ban.bannedBy': bannedBy,
                    'ban.bannedIn': bannedIn,
                    'ban.time': time,
                    'ban.reason': reason
                }
            }
        )
    }

    public getGroup = async (jid: string): Promise<TGroupModel> =>
        (await this.group.findOne({ jid })) || (await new this.group({ jid }).save())

    public updateGroup = async (jid: string, field: keyof Group, update: boolean): Promise<void> => {
        await this.getGroup(jid)
        await this.group.updateOne({ jid }, { $set: { [field]: update } })
    }
    
    public removeUser = async (jid: string): Promise<void> => {
        await this.user.deleteOne({ jid })
    }

    public getSession = async (sessionId: string): Promise<TSessionModel | null> =>
        await this.session.findOne({ sessionId })

    public saveNewSession = async (sessionId: string): Promise<void> => {
        await new this.session({ sessionId }).save()
    }

    public updateSession = async (sessionId: string, session: string): Promise<void> => {
        await this.session.updateOne({ sessionId }, { $set: { session } })
    }

    public removeSession = async (sessionId: string): Promise<void> => {
        await this.session.deleteOne({ sessionId })
    }

    public getContacts = async (): Promise<Contact[]> => {
        let result = await this.contact.findOne({ ID: 'contacts' })
        if (!result) result = await new this.contact({ ID: 'contacts' }).save()
        return result.data
    }

    public getDisabledCommands = async (): Promise<TCommandModel['disabledCommands']> => {
        let result = await this.disabledCommands.findOne({ title: 'commands' })
        if (!result) result = await new this.disabledCommands({ title: 'commands' }).save()
        return result.disabledCommands
    }

    public updateDisabledCommands = async (update: TCommandModel['disabledCommands']): Promise<void> => {
        await this.getDisabledCommands()
        await this.disabledCommands.updateOne({ title: 'commands' }, { $set: { disabledCommands: update } })
    }

    private utils = new Utils()

    public user = userSchema

    public group = groupSchema

    public contact = contactSchema

    public session = sessionSchema

    public disabledCommands = disabledCommandsSchema
}

type valueof<T> = T[keyof T]
