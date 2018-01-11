#!/usr/bin/env node

const AipSpeechClient = require("baidu-aip-sdk").speech
const getStdin = require('get-stdin')
const fs = require('fs')
const argv = require('yargs').argv
const pLimit = require('p-limit')
const path = require('path')

const configFilename = '.bce-text2audio-cli-config.json'
const tmpFilePrefix = '/tmp/text2audio_'
const appConfKeys = ['APP_ID', 'API_KEY', 'SECRET_KEY']

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

if (argv.clean) {
    clean(argv.dryrun).catch(handleError)
}
else {
    convert().catch(handleError)
}


function handleError(err) {
    console.log(err.message)
    if (argv.debug) {
        console.log(err.stack)
    }
    process.exit(1)
}


async function convert() {
    const config = await getConf()
    if (appConfKeys.some(key => !config[key])) {
        throw new Error('Configure is invalid.')
    }

    let text = await getStdin()
    if (!text && argv.inputFile && await isFile(argv.inputFile)) {
        text = await readFile(argv.inputFile)
    }
    if (!text) {
        throw new Error('Empty input file')
    }
    // console.log(`Text length: ${text.length}`)

    let client = new AipSpeechClient(...appConfKeys.map(key => config[key]))

    let limit = pLimit(concurrency)
    let files = await Promise.all(splitText(text).map(function (text, index, files) {
        return limit(function () {
            console.log('Snippet (%d/%d): %s...',
                index + 1, files.length,
                text.substring(0, 40).replace(/\r?\n/mg, '').replace(/\s{2,}/g, ' ')
            )
            return makeMp3(client, text)
        })
    }))
    if (files.length === 0) {
        throw new Error('No files generated. Something went wrong.')
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

function makeMp3(client, text) {
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

function readFile(filename) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filename, 'utf8', function (err, result) {
            if (err) {
                reject(err)
            }
            else {
                resolve(result)
            }
        })
    })
}

function isFile(filename) {
    return new Promise(function (resolve, reject) {
        fs.stat(filename, function (err, stats) {
            if (err) {
                reject(err)
                return
            }
            resolve(stats.isFile())
        })
    }).catch(function (err) {
        // console.log(err)
        return Promise.resolve(false)
    })
}

function removeFile(filename) {
    return new Promise(function (resolve, reject) {
        fs.unlink(filename, function (err, result) {
            if (err) {
                reject(err)
            }
            else {
                resolve(result)
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

async function getConf() {
    let confPath = path.join(process.env.HOME, configFilename)
    if (!(await isFile(confPath))) {
        console.log('%s does not exist.', confPath)
        console.log('Please create it and fill it with appkey')
        console.log(await readFile(path.join(__dirname, 'config.sample.json')))
        process.exit(1)
    }

    let configContent = await readFile(confPath)
    let conf
    try {
        conf = JSON.parse(configContent)
    }
    catch (err) {
        console.log('Failed to parse configure file. Please check')
        process.exit(1)
    }

    return conf
}

function clean(dryrun = false) {
    const dir = path.dirname(tmpFilePrefix)
    return new Promise(function (resolve, reject) {
        fs.readdir(dir, function (err, files) {
            if (err) {
                reject(err)
            }
            else {
                resolve(files)
            }
        })
    }).then(function (files) {
        let filenamePrefix = path.basename(tmpFilePrefix)
        files = files.filter(file => file.indexOf(filenamePrefix) === 0)
                    .map(file => path.join(dir, file))
        console.log(files.map(file => `rm ${file}`).join('\n'))
        if (dryrun) {
            return Promise.resolve([])
        }
        return Promise.all(files.map(removeFile))
    })
}
