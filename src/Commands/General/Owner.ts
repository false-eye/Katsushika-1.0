import { BaseCommand, Message, Command } from '../../Structures'

@Command('owner', {
    description: 'sends bot owner number',
    category: 'general',
    aliases: ['creator'],
    usage: 'owner',
    dm: true,
    cooldown: 5,
    exp: 50
})
export default class extends BaseCommand {
    public override execute = async ({ from, sender, message }: Message): Promise<void> => {
    const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 'FN: Mythic İssa🏴‍☠️\n' + 'ORG: Sapphire INC.;\n' + 'TEL;type=CELL;type=VOICE;waid=254115175696:+254 115 175 696\n' + 'END:VCARD'
    return void (await this.client.sendMessage(
        from,
        {
            contacts: {
                displayName: 'Mythic İssa🏴‍☠️',
                contacts: [{ vcard }],
            },
            mentions: [sender.jid],
        },
        { quoted: message }
            ))}
        }
