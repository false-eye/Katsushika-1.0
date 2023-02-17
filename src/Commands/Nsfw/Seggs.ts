import { BaseCommand, Command, Message } from '../../Structures'

@Command('seggs', {
    description: 'Sends a random seggs image',
    category: 'nsfw',
    usage: 'seggs [tag user]',
    exp: 20,
    cooldown: 5
})
export default class extends BaseCommand {
    public override execute = async (M: Message): Promise<void> => {
        let users = M.mentioned
        if (M.quoted && !users.includes(M.quoted.sender.jid)) users.push(M.quoted.sender.jid)
        while (users.length < 2) users.push(M.sender.jid)
        if (users.includes(M.sender.jid)) users = users.reverse()
        const image = this.client.utils.getRandomFile('./assets/hentai')
        const buffer = (await this.client.assets.get(image)) as Buffer
        const percentage = Math.floor(Math.random() * 101)
        let text = ''
        if (percentage >= 0 && percentage < 10) text = 'Go home little kid'
        else if (percentage >= 10 && percentage < 25)
            text = "You're just horny not fated to be together. The partner Fainted"
        else if (percentage >= 25 && percentage < 40) text = "I't appears that you are still a noob about this subject"
        else if (percentage >= 40 && percentage < 50) text = 'Not bad try harder'
        else if (percentage >= 50 && percentage < 75) text = 'Woah I also learned something from that'
        else if (percentage >= 75 && percentage < 90) text = 'The baby is waiting to see the world for sure'
        else if (percentage >= 90) text = "UwU, You're my Soulmates, you're the best"
        let caption = `\t🥵 *KWAII SEGGS?* 🥵 \n`
        caption += `\t\t---------------------------------\n`
        caption += `@${users[0].split('@')[0]}  &  @${users[1].split('@')[0]}\n`
        caption += `\t\t---------------------------------\n`
        caption += `\t\t\t\t\t${percentage < 40 ? '😌' : percentage < 75 ? '😳' : '🥵'} *Percentage: ${percentage}%*\n`
        caption += text
        return void (await M.reply(await this.client.utils.gifToMp4(buffer), 'video', true, undefined, caption, [
            users[0],
            users[1]
        ]))
    }
}
