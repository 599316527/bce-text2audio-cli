/**
 * @file Text2Audio
 * @author Kyle (ohyes@hk1229.cn)
 */

const AipSpeechClient = require("baidu-aip-sdk").speech
const getStdin = require('get-stdin')
const fs = require('fs')
const argv = require('yargs').argv
const pLimit = require('p-limit')

const tmpFilePrefix = '/tmp/text2audio_'

const defaultText2AudioApiOptions = {
    spd: 5,
    per: 0,
    vol: 5,
    pit: 5
}

const text2AudioApiOptions = Object.assign({}, defaultText2AudioApiOptions,
    Object.keys(defaultText2AudioApiOptions).reduce(function (prev, key) {
        if (argv[key] !== undefined) {
            prev[key] = argv[key]
        }
        return prev
    }, {}))

let concurrency = 2
if (argv.concurrency) {
    let c = parseInt(argv.concurrency, 10)
    if (!isNaN(c) && c > 0) {
        concurrency = c
    }
}

const { APP_ID, API_KEY, SECRET_KEY } = require('./config.json')

let client = new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY)

main().catch(function (err) {
    console.log(err.stack)
    process.exit(1)
})


async function main() {
    let text = await getStdin()
    if (!text) {
        throw new Error('no stdin')
    }
    console.log(`文本长度：${text.length}`)

    let limit = pLimit(concurrency)
    let files = await Promise.all(splitText(text).map(text => limit(() => makeMp3(text))))
    if (files.length === 0) {
        throw new Error('no files')
    }

    let ffmpegConcatInputFilename = `${tmpFilePrefix}list_${randomName()}.txt`
    await writeFile(ffmpegConcatInputFilename, files.map(file => `file '${file}'`).join('\n'))

    let cmdline = `ffmpeg -f concat -safe 0 -i ${ffmpegConcatInputFilename} -c copy ${Date.now()}.mp3`
    printBox(cmdline)
}



function splitText(text, limit = 444) {
    let pieces = []
    let pos = 0
    while (pos < text.length) {
        pieces.push(text.substring(pos, pos + limit))
        pos += limit
    }
    return pieces
}

async function makeMp3(text) {
    console.log(`生成片段：${text.substring(0, 30).replace(/\r?\n/mg, '').replace(/\s{2,}/g, ' ')}...`)
    return new Promise(function (resolve, reject) {
        client.text2audio(text, text2AudioApiOptions).then(function(result) {
            if (result.data) {
                resolve(result)
            } else {
                reject(result)
            }
        }, function(err) {
            // 发生网络错误
            reject(err)
        })
    }).then(function (result) {
        let filename = randomName()
        filename = `${tmpFilePrefix}${filename}.mp3`
        return writeFile(filename, result.data)
    })
}

async function writeFile(filename, content) {
    return new Promise(function (resolve, reject) {
        fs.writeFile(filename, content, function (err, result) {
            if (err) {
                reject(err)
            }
            else {
                resolve(filename)
            }
        })
    })
}

function randomName() {
    return Math.floor(Math.random() * 1e8).toString(36)
}

function printBox(text) {
    let line = '+' + '-'.repeat(text.length + 4) + '+'
    console.log(line)
    console.log('|  ' + text + '  |')
    console.log(line)
}
