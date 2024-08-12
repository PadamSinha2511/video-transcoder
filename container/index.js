const {S3Client,GetObjectCommand, PutObjectCommand,DeleteObjectCommand} = require("@aws-sdk/client-s3")
const fs = require("node:fs/promises")
const fsOld = require("node:fs")
const path = require("node:path")
const ffmpeg = require('fluent-ffmpeg')
const s3Client  = new S3Client({
    region:"Your-Account-Region",
    credentials:{
        accessKeyId:"Your-Account-AccessKeyId",
        secretAccessKey:"Your-Account-SecretAccessKey"
    }
})

const resolutions = [
    { name: '360p', width: 480, height: 360 },
    { name: '480p', width: 858, height: 480 },
    { name: '720p', width: 1280, height: 720 },
];


const BUCKET_NAME=  process.env.BUCKET_NAME
const KEY = process.env.KEY

async function init()
{
    const input ={
        Bucket:BUCKET_NAME,
        Key:KEY
    }

    const command  = new GetObjectCommand(input)
    const response = await s3Client.send(command)

    const localFilePath = 'original-video.mp4'

    await fs.writeFile(localFilePath,response.Body)

    const originalVideoAbsolutePath = path.resolve(localFilePath)

    console.log(originalVideoAbsolutePath)
    
    const promises = resolutions.map(resolution=>{
        const output = `video-${resolution.name}.mp4`


      return new Promise((resolve)=>{
        ffmpeg(originalVideoAbsolutePath)
        .output(output)
        .withVideoCodec('libx264')
        .withAudioCodec('aac')
        .withSize(`${resolution.width}x${resolution.height}`)
        .on('start',()=>{
            console.log(`Transcoding started for ${resolution.name}`)
        })
        .on('end',async()=>{
            const putCommand = new PutObjectCommand({
                Bucket:'Production-Bucket-Name',
                Key:output,
                Body:fsOld.createReadStream(path.resolve(output))
            })

            await s3Client.send(putCommand)
            console.log('Video Uploaded')
            resolve()
        })
        .format('mp4')
        .run()

      })

    })
    
    const deleteCommand = new DeleteObjectCommand({
        Bucket:BUCKET_NAME,
        Key:KEY
    })

    await s3Client.send(deleteCommand)


}

init();