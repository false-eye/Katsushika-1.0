import axios from 'axios'
import { tmpdir } from 'os'
import { promisify } from 'util'
import { exec } from 'child_process'
import { readFile, unlink, writeFile } from 'fs-extra'
import regex from 'emoji-regex'
import getUrls from 'get-urls'
import { Canvacord } from 'canvacord'
import { MoveClient } from 'pokenode-ts'
import Canvas from 'canvas'
import { join } from 'path'
import { load } from 'cheerio'
import { IPokemonAPIResponse, IPokemonChainResponse, TCardsTier } from '../Types'
import { Pokemon, PokemonMove } from '../Database'
import { MessageHandler } from '../Handlers'
import { Client } from '../Structures'

export class Utils {
    public verifyWin = (board: string[], player1: string, player2: string): string => {
        const winningCombos = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ]
        const hasWon = (board: string[], symbol: 'X' | 'O') => {
            let winner = false
            winningCombos.map((combo) => {
                if (board[combo[0]] === symbol && board[combo[1]] === symbol && board[combo[2]] === symbol) {
                    winner = true
                }
            })
            return winner
        }
        const player1Symbol = 'X'
        const player2Symbol = 'O'
        if (hasWon(board, player1Symbol)) return player1
        if (hasWon(board, player2Symbol)) return player2
        return 'draw'
    }

    public getPokemonStats = async (
        pokemon: string | number,
        level: number
    ): Promise<{ hp: number; attack: number; defense: number; speed: number }> => {
        pokemon = typeof pokemon === 'string' ? pokemon.toLowerCase() : pokemon.toString().trim()
        const pokemonData = await this.fetch<IPokemonAPIResponse>(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
        const wantedStatsNames = ['hp', 'attack', 'defense', 'speed']
        const wantedStats = pokemonData.stats.filter((stat) => wantedStatsNames.includes(stat.stat.name))
        const pokemonStats: { [T in 'hp' | 'attack' | 'defense' | 'speed']: number } = {
            hp: 0,
            attack: 0,
            defense: 0,
            speed: 0
        }
        wantedStats.forEach(
            (stat) =>
                (pokemonStats[stat.stat.name as 'hp'] = Math.floor(stat.base_stat + level * (stat.base_stat / 50)))
        )
        return pokemonStats
    }

    public displayBoard = async (Board: string[]): Promise<Buffer> => {
        const board = Board as ('X' | 'O')[]
        const data = {
            a1: board[0],
            b1: board[1],
            c1: board[2],
            a2: board[3],
            b2: board[4],
            c2: board[5],
            a3: board[6],
            b3: board[7],
            c3: board[8]
        }
        return await Canvacord.tictactoe(data, {
            bg: 'black',
            bar: 'blue',
            x: 'red',
            o: 'white'
        })
    }

    public validateCard = (data: string): boolean => {
        const $ = load(data)
        const image = $(
            '#root > div > div.yield.cont > div.uber.relative > div:nth-child(10) > div > div > div:nth-child(1) > div > div > div > div.cardData > img'
        ).attr('src')
        if (!image) return false
        return true
    }

    public scrapCardData = (data: string): { name: string; tier: TCardsTier; description: string; image: string } => {
        const $ = load(data)
        const image = $(
            '#root > div > div.yield.cont > div.uber.relative > div:nth-child(10) > div > div > div:nth-child(1) > div > div > div > div.cardData > img'
        ).attr('src') as string
        const name = $(
            '#root > div > div.yield.cont > div.uber.relative > div:nth-child(9) > ol > li:nth-child(5) > a > span'
        ).text()
        const source = $(
            '#root > div > div.yield.cont > div.uber.relative > div:nth-child(9) > ol > li:nth-child(4) > span'
        ).text()
        const tier = $(
            '#root > div > div.yield.cont > div.uber.relative > div:nth-child(9) > ol > li:nth-child(3) > a > span'
        )
            .text()
            .split('Tier')[1]
            .trim() as TCardsTier
        const description = `${name} from ${source}.`
        return {
            name,
            tier,
            description,
            image
        }
    }

    public drawPokemonBattle = async (data: {
        player1: { activePokemon: Pokemon; party: Pokemon[] }
        player2: { activePokemon: Pokemon; party: Pokemon[] }
    }): Promise<Buffer> => {
        const background = await Canvas.loadImage(
            await readFile(join(__dirname, '..', '..', 'assets', 'images', 'battle.png'))
        )
        const pokeball = await Canvas.loadImage(
            await readFile(join(__dirname, '..', '..', 'assets', 'images', 'pokeball.png'))
        )
        const greyPokeball = await Canvas.loadImage(
            await readFile(join(__dirname, '..', '..', 'assets', 'images', 'greyPokeball.png'))
        )
        const canvas = Canvas.createCanvas(background.width, background.height)
        const ctx = canvas.getContext('2d')
        ctx.drawImage(background, 0, 0)
        const pokemonSize = 128
        const pokemonStyles = this.getPokemonStyles(pokemonSize)
        const boxPadding = 12
        for (let i = 0; i < 2; i++) {
            const style = pokemonStyles[`player${i + 1}` as 'player1']
            const player = data[`player${i + 1}` as 'player1']
            const pokemonPos = {
                x: 1,
                y: 1
            }
            const pokemonImage = await Canvas.loadImage(
                i === 1
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${
                          data[`player${i + 1}` as 'player1'].activePokemon.id
                      }.png`
                    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${
                          data[`player${i + 1}` as 'player2'].activePokemon.id
                      }.png`
            )
            const clipY = style.pokemon.clipY
            const size = style.pokemon.size
            if (player.activePokemon.hp > 0)
                ctx.drawImage(
                    pokemonImage,
                    pokemonPos.x,
                    pokemonPos.y,
                    96,
                    96 - clipY,
                    style.pokemon.x,
                    style.pokemon.y,
                    size,
                    size - clipY
                )
            const boxCanvas = Canvas.createCanvas(150, 60)
            const boxCtx = boxCanvas.getContext('2d')
            boxCtx.fillStyle = 'rgb(24,24,24)'
            boxCtx.strokeStyle = 'rgb(36,36,36)'
            this.roundRect(boxCtx, 0, 0, boxCanvas.width, boxCanvas.height, 16)
            boxCtx.font = 'bold 12px Sans-Serif'
            boxCtx.fillStyle = '#ffffff'
            const namePos = {
                x: boxPadding,
                y: boxCanvas.height - boxPadding
            }
            boxCtx.textAlign = 'left'
            boxCtx.fillText(
                `${this.capitalize(player.activePokemon.name)}${
                    player.activePokemon.name.length <= 6 ? '\t\t' : '\t'
                }Lv. ${player.activePokemon.level}`,
                namePos.x,
                namePos.y
            )
            const hpPos = {
                x: boxCanvas.width - boxPadding,
                y: boxPadding * 2
            }
            boxCtx.textAlign = 'right'
            boxCtx.fillText(`HP: ${player.activePokemon.hp} / ${player.activePokemon.maxHp}`, hpPos.x, hpPos.y)
            const pokeballGap = 2
            const pokeballSize = 7
            const pokeballPos = {
                x: boxPadding,
                y: boxPadding
            }
            const length = player.party.length <= 6 ? player.party.length : 6
            for (let i = 0; i < length; i++) {
                const pokeballX = pokeballPos.x + (pokeballSize + pokeballGap) * i
                boxCtx.drawImage(
                    player.party[i].hp > 0 ? pokeball : greyPokeball,
                    pokeballX,
                    pokeballPos.y,
                    pokeballSize,
                    pokeballSize
                )
            }
            ctx.drawImage(boxCanvas, style.box.x, style.box.y)
        }
        return canvas.toBuffer()
    }

    private getPokemonStyles = (pokemonSize: number) => ({
        player1: {
            pokemon: {
                x: 100 - pokemonSize / 2,
                y: 138,
                size: 128,
                showBack: true,
                clipY: 45
            },
            box: {
                x: 25,
                y: 60
            },
            moves: {
                x: 0,
                y: 225
            }
        },
        player2: {
            pokemon: {
                x: 300 - pokemonSize / 2,
                y: 60,
                size: 100,
                showBack: false,
                clipY: 0
            },
            box: {
                x: 230,
                y: 150
            },
            moves: {
                x: 0,
                y: 5
            }
        }
    })

    private roundRect = (
        ctx: Canvas.CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number = 5
    ) => {
        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + width - radius, y)
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
        ctx.lineTo(x + width, y + height - radius)
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        ctx.lineTo(x + radius, y + height)
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
    }

    public getPokemonEvolutionChain = async (pokemon: string | number): Promise<string[]> => {
        const data = await this.fetch<{ evolution_chain: { url: string } }>(
            `https://pokeapi.co/api/v2/pokemon-species/${pokemon}`
        )
        const res = await this.fetch<{ chain: IPokemonChainResponse }>(data.evolution_chain.url)
        const { chain } = res
        const line: string[] = []
        const evolutions: string[] = []
        line.push(chain.species.name)
        if (chain.evolves_to.length) {
            const second: string[] | string = []
            chain.evolves_to.forEach((pkm) => second.push(pkm.species.name))
            if (second.length === 1) line.push(second[0])
            else line.push(second as unknown as string)
            if (chain.evolves_to[0].evolves_to.length) {
                const third: string[] | string = []
                chain.evolves_to[0].evolves_to.forEach((pkm) => third.push(pkm.species.name))
                if (third.length === 1) line.push(third[0])
                else line.push(third as unknown as string)
            }
        }
        for (const pokemon of line) {
            if (Array.isArray(pokemon)) {
                pokemon.forEach((x) => evolutions.push(x))
                continue
            }
            evolutions.push(pokemon)
        }
        return evolutions
    }

    public generateRandomHex = (): string => `#${(~~(Math.random() * (1 << 24))).toString(16)}`

    public capitalize = (content: string): string => `${content[0].toUpperCase()}${content.substring(1).toLowerCase()}`

    public generateRandomUniqueTag = (n: number = 4): string => {
        let max = 11
        if (n > max) return `${this.generateRandomUniqueTag(max)}${this.generateRandomUniqueTag(n - max)}`
        max = Math.pow(10, n + 1)
        const min = max / 10
        return (Math.floor(Math.random() * (max - min + 1)) + min).toString().substring(1)
    }

    public getStarterPokemonMoves = async (pokemon: string | number): Promise<PokemonMove[]> => {
        const moves = (
            await this.fetch<IPokemonAPIResponse>(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
        ).moves.filter(
            (move) =>
                move.version_group_details[0].move_learn_method.name === 'level-up' &&
                move.version_group_details[0].level_learned_at <= 5
        )
        const result: PokemonMove[] = []
        const client = new MoveClient()
        for (const move of moves) {
            if (result.length >= 2) break
            const data = await client.getMoveByName(move.move.name)
            const stat_change = []
            for (const { change, stat } of data.stat_changes) stat_change.push({ target: stat.name, change })
            const effect = data.meta && data.meta.ailment ? data.meta.ailment.name : ''
            const descriptions = data.flavor_text_entries.filter((x) => x.language.name === 'en')
            result.push({
                name: data.name,
                accuracy: data.accuracy || 0,
                pp: data.pp || 5,
                maxPp: data.pp || 5,
                id: data.id,
                power: data.power || 0,
                priority: data.priority,
                type: data.type.name,
                stat_change,
                effect,
                drain: data.meta ? data.meta.drain : 0,
                healing: data.meta ? data.meta.healing : 0,
                description: descriptions[0].flavor_text
            })
        }
        return result
    }

    public getPokemonWeaknessAndStrongTypes = async (
        types: string[]
    ): Promise<{ weakness: string[]; strong: string[] }> => {
        if (!types.length)
            return {
                weakness: [],
                strong: []
            }
        const strong: string[] = []
        const weakness: string[] = []
        for (const type of types) {
            const data = await this.fetch<{ type: string; weakness: string[]; strong: string[] }>(
                `https://shooting-star-unique-api.vercel.app/api/mwl/type?type=${type}`
            )
            data.weakness.forEach((x) => weakness.push(x))
            data.strong.forEach((x) => strong.push(x))
        }
        return {
            weakness,
            strong
        }
    }

    public getPokemonLearnableMove = async (
        pokemon: string | number,
        level: number,
        learntMoves: PokemonMove[],
        rejectedMoves: string[] = []
    ): Promise<PokemonMove | null> => {
        const shouldDenyMoves = learntMoves.map((move) => move.name)
        const moves = (
            await this.fetch<IPokemonAPIResponse>(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
        ).moves.filter(
            (move) =>
                move.version_group_details[0].move_learn_method.name === 'level-up' &&
                move.version_group_details[0].level_learned_at <= level &&
                !rejectedMoves.includes(move.move.name) &&
                !shouldDenyMoves.includes(move.move.name)
        )
        if (!moves.length) return null
        const client = new MoveClient()
        const data = await client.getMoveByName(moves[0].move.name)
        const stat_change = []
        const effect = data.meta && data.meta.ailment ? data.meta.ailment.name : ''
        const descriptions = data.flavor_text_entries.filter((x) => x.language.name === 'en')
        for (const change of data.stat_changes) stat_change.push({ target: change.stat.name, change: change.change })
        return {
            name: data.name,
            accuracy: data.accuracy || 0,
            pp: data.pp || 5,
            maxPp: data.pp || 5,
            id: data.id,
            power: data.power || 0,
            priority: data.priority,
            type: data.type.name,
            stat_change,
            effect,
            drain: data.meta ? data.meta.drain : 0,
            healing: data.meta ? data.meta.healing : 0,
            description: descriptions[0].flavor_text
        }
    }

    public PokemonMoveIsLearnable = async (pokemon: string | number, move: string | number): Promise<boolean> => {
        const client = new MoveClient()
        const { name } = await this.fetch<IPokemonAPIResponse>(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
        return await client[typeof move === 'string' ? 'getMoveByName' : 'getMoveById'](move as never)
            .then((res) => {
                const pokemons = res.learned_by_pokemon.map((pokemon) => pokemon.name)
                return pokemons.includes(name)
            })
            .catch(() => false)
    }

    public extractNumbers = (content: string): number[] => {
        const search = content.match(/(-\d+|\d+)/g)
        if (search !== null) {
            const result = search.map((string) => parseInt(string))
            for (let i = 0; i < result.length; i++) {
                if (result[i] > 0) continue
                result[i] = 0
            }
            return result
        }
        return []
    }

    public shuffleArray = <T>(array: any[]): T => {
        let counter = array.length
        while (counter > 0) {
            const index = Math.floor(Math.random() * counter)
            counter--
            const temp = array[counter]
            array[counter] = array[index]
            array[index] = temp
        }
        return array as unknown as T
    }

    public assignPokemonMoves = async (
        pokemon: string | number,
        level: number
    ): Promise<{ moves: PokemonMove[]; rejectedMoves: string[] }> => {
        let moves = this.shuffleArray<IPokemonAPIResponse['moves']>(
            (await this.fetch<IPokemonAPIResponse>(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)).moves.filter(
                (move) =>
                    move.version_group_details[0].move_learn_method.name === 'level-up' &&
                    move.version_group_details[0].level_learned_at <= level
            )
        )
        const client = new MoveClient()
        const result: PokemonMove[] = []
        const rejectedMoves: string[] = []
        for (const { move } of moves) {
            if (result.length >= 4) {
                rejectedMoves.push(move.name)
                continue
            }
            const data = await client.getMoveByName(move.name)
            const effect = data.meta && data.meta.ailment ? data.meta.ailment.name : ''
            const stat_change = []
            const descriptions = data.flavor_text_entries.filter((x) => x.language.name === 'en')
            for (const change of data.stat_changes)
                stat_change.push({ target: change.stat.name, change: change.change })
            result.push({
                name: data.name,
                accuracy: data.accuracy || 0,
                pp: data.pp || 5,
                maxPp: data.pp || 5,
                id: data.id,
                power: data.power || 0,
                priority: data.priority,
                type: data.type.name,
                stat_change,
                effect,
                drain: data.meta ? data.meta.drain : 0,
                healing: data.meta ? data.meta.healing : 0,
                description: descriptions[0].flavor_text
            })
        }
        return {
            moves: result,
            rejectedMoves
        }
    }

    public extractUrls = (content: string): string[] => Array.from(getUrls(content))

    public extractEmojis = (content: string): string[] => content.match(regex()) || []

    public formatSeconds = (seconds: number): string => new Date(seconds * 1000).toISOString().substr(11, 8)

    public convertMs = (ms: number, to: 'seconds' | 'minutes' | 'hours' = 'seconds'): number => {
        const seconds = parseInt((ms / 1000).toString().split('.')[0])
        const minutes = parseInt((seconds / 60).toString().split('.')[0])
        const hours = parseInt((minutes / 60).toString().split('.')[0])
        if (to === 'hours') return hours
        if (to === 'minutes') return minutes
        return seconds
    }

    public webpToImage = async (webp: Buffer): Promise<Buffer> => {
        const filename = `${tmpdir()}/${Math.random().toString(36)}`
        await writeFile(`${filename}.webp`, webp)
        await this.exec(`dwebp "${filename}.webp" -o "${filename}.png"`)
        const buffer = await readFile(`${filename}.png`)
        Promise.all([unlink(`${filename}.png`), unlink(`${filename}.webp`)])
        return buffer
    }

    public mp3ToOpus = async (mp3: Buffer): Promise<Buffer> => {
        const filename = `${tmpdir()}/${Math.random().toString(36)}`
        await writeFile(`${filename}.mp3`, mp3)
        await this.exec(`ffmpeg -i ${filename}.mp3 -c:a libopus ${filename}.opus`)
        const buffer = await readFile(`${filename}.opus`)
        Promise.all([unlink(`${filename}.mp3`), unlink(`${filename}.opus`)])
        return buffer
    }

    public gifToMp4 = async (gif: Buffer): Promise<Buffer> => {
        const filename = `${tmpdir()}/${Math.random().toString(36)}`
        await writeFile(`${filename}.gif`, gif)
        await this.exec(
            `ffmpeg -f gif -i ${filename}.gif -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${filename}.mp4`
        )
        const buffer = await readFile(`${filename}.mp4`)
        Promise.all([unlink(`${filename}.gif`), unlink(`${filename}.mp4`)])
        return buffer
    }

    public fetch = async <T>(url: string): Promise<T> => (await axios.get(url)).data

    public getBuffer = async (url: string): Promise<Buffer> =>
        (
            await axios.get<Buffer>(url, {
                responseType: 'arraybuffer'
            })
        ).data

    public exec = promisify(exec)

    public chunk = <T>(arr: T[], length: number): T[][] => {
        const result = []
        for (let i = 0; i < arr.length / length; i++) result.push(arr.slice(i * length, i * length + length))
        return result
    }

    public parseChessBoard = (board: string[]): string[][] =>
        this.chunk(
            board.map((tile) => {
                if (tile === 'bK') return 'k'
                if (tile === 'wK') return 'K'
                if (tile === 'wk') return 'N'
                if (tile === 'bk') return 'n'
                if (tile[0] === 'w') return tile[1].toUpperCase()
                return tile[1].toLowerCase()
            }),
            8
        ).reverse()

    public endChess = async (
        handler: MessageHandler,
        client: Client,
        jid: string,
        winner?: 'Black' | 'White' | string
    ): Promise<void> => {
        const game = handler.chess.games.get(jid)
        const challenge = handler.chess.challenges.get(jid)
        if (!game || !challenge) return void null
        const w = winner?.endsWith('.net')
            ? winner
            : winner === 'White'
            ? challenge.challenger
            : winner === 'Black'
            ? challenge.challengee
            : null
        handler.chess.challenges.set(jid, undefined)
        handler.chess.games.set(jid, undefined)
        handler.chess.ongoing.delete(jid)
        if (!w)
            return void (await client.sendMessage(jid, {
                text: 'Match ended in a Draw!'
            }))
        await client.DB.setExp(w, 1500)
        if (w)
            return void (await client.sendMessage(jid, {
                text: `@${w.split('@')[0]} Won`,
                mentions: [w]
            }))
    }
}
