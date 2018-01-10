/**
 * @file Text2Audio
 * @author Kyle (ohyes@hk1229.cn)
 */

const AipSpeechClient = require("baidu-aip-sdk").speech
const getStdin = require('get-stdin')
const fs = require('fs')
const argv = require('yargs').argv

const tmpFilePrefix = '/tmp/text2audio_'

const defaultText2AudioApiOptions = {
    spd: 6,
    per: 0,
    vol: 10,
    pit: 4
}

const text2AudioApiOptions = Object.assign({}, defaultText2AudioApiOptions,
    Object.keys(defaultText2AudioApiOptions).reduce(function (prev, key) {
        if (argv[key] !== undefined) {
            prev[key] = argv[key]
        }
        return prev
    }, {}))

const { APP_ID, API_KEY, SECRET_KEY } = require('./config.json')

let client = new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY)

getStdin().then(text => {
    text = text.trim()
    if (!text) {
        throw new Error('no stdin')
    }
    return text
}).then(function (text) {
    return Promise.all(splitText(text).map(makeMp3))
}).then(function (files) {
    if (files.length === 0) {
        return Promise.reject(new Error('no files'))
    }
    let ffmpegConcatInputFileContent = files.map(function (file) {
        return `file '${file}'`
    }).join('\n')
    return writeFile(`${tmpFilePrefix}list_${randomName()}.txt`, ffmpegConcatInputFileContent)
}).then(function (filename) {
    let cmdline = `ffmpeg -f concat -safe 0 -i ${filename} -c copy ${Date.now()}.mp3`
    let horiline = '+' + '-'.repeat(cmdline.length + 4) + '+'
    console.log(horiline)
    console.log('|  ' + cmdline + '  |')
    console.log(horiline)
}).catch(function (err) {
    console.log(err.stack)
    process.exit(1)
})


function splitText(text, limit = 444) {
    let pieces = []
    let pos = 0
    while (pos < text.length) {
        pieces.push(text.substring(pos, pos + limit))
        pos += limit
    }
    return pieces
}

function makeMp3(text) {
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

function writeFile(filename, content) {
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
