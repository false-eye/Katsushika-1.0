import { BaseCommand, Command, Message } from '../../Structures'

@Command('rape', {
    description: 'Sends a random rape gif',
    category: 'nsfw',
    usage: 'rape [tag user]',
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
        if (percentage >= 0 && percentage < 10) text = 'You looks like a horny kid'
        else if (percentage >= 10 && percentage < 25) text = 'Tomato, let me eat your pussy'
        else if (percentage >= 25 && percentage < 40) text = "It's your fault! You erotic kinder-gartner"
        else if (percentage >= 40 && percentage < 50) text = 'Yamete Kudasai, try harder'
        else if (percentage >= 50 && percentage < 75) text = "I'm gonna fuck you, so hard in ground and cum inside you"
        else if (percentage >= 75 && percentage < 90) text = "Lewd, you're turning me on so much!"
        else if (percentage >= 90) text = "Yamete, it's too much lewd more give me more."
        let caption = `\t🥵 *Yamete Raped?* 🥵 \n`
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
