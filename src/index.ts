import {SQSClient,ReceiveMessageCommand, DeleteMessageCommand} from "@aws-sdk/client-sqs"
import type {S3Event} from "aws-lambda"
import {ECSClient, RunTaskCommand} from "@aws-sdk/client-ecs"
const sqsClient = new SQSClient({
    region:"Your-Account-Region",
    credentials:{
        accessKeyId:"Your-Account-AccessKeyId",
        secretAccessKey:"Your-Account-SecretAccessKey"
    }
})

const ecsClient = new ECSClient({
    region:"Your-Account-Region",
    credentials:{
        accessKeyId:"Your-Account-AccessKeyId",
        secretAccessKey:"Your-Account-SecretAccessKey"
    }
})



async function init()
{
    const input ={
        QueueUrl:"SQS-Queue-Url",
        MaxNumberOfMessages:1,
        WaitTimeSeconds:20
    }

    while(true)
    {
        const command = new ReceiveMessageCommand(input)
        const {Messages} = await sqsClient.send(command)
        
        if(!Messages)
        {
            continue;
        }

       try {
            for(const message of Messages)
            {
                const {Body,MessageId} = message
                if(!Body)
                {
                    continue;
                }

                const event = JSON.parse(Body) as S3Event

                if("Service" in event && "Event" in event)
                {
                    if(event.Event === "s3:TestEvent")
                    {
                        await sqsClient.send(new DeleteMessageCommand({
                            QueueUrl:"SQS-Queue-Url",
                            ReceiptHandle:message.ReceiptHandle
                        }))
                        continue;
                    }
                }

               for(const record of event.Records)
               {
                    const {bucket,object:{key}} = record.s3;

                    console.log(bucket.name,key)

                    //Spin a docker here 
                    const command = new RunTaskCommand({
                        taskDefinition:"Task-Arn",
                        cluster:"Cluster-Arn",
                        networkConfiguration: { // NetworkConfiguration
                            awsvpcConfiguration: { // AwsVpcConfiguration
                              subnets: [ // StringList // required
                                "subnet-1",
                                "subnet-2",
                                "subnet-3"
                              ],
                              securityGroups: [
                                "sg-1",
                              ],
                              assignPublicIp: "ENABLED"
                            },
                          },
                          launchType:"FARGATE",
                          overrides:{
                            containerOverrides:[
                                {
                                    name:"Container-Name",
                                    environment:[
                                       { name:"BUCKET_NAME",value:bucket.name},
                                       {name:"KEY",value:key}

                                    ]
                                }
                            ]
                          }
                    })

                    await ecsClient.send(command)

                    await sqsClient.send(new DeleteMessageCommand({
                        QueueUrl:"SQS-Queue-URL",
                        ReceiptHandle:message.ReceiptHandle
                    }))


               }


            }
       } catch (error) {
            console.log(error)
       }


        
    }



    
}


init();