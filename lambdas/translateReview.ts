import { APIGatewayProxyHandler } from 'aws-lambda';
import * as AWS from 'aws-sdk';
import 'source-map-support/register';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
    
const ddbDocClient = createDDbDocClient();
const translate = new AWS.Translate();

export const handler: APIGatewayProxyHandler = async (event, context) => {
    try {
        console.log("Event: ", event);
        const parameters  = event?.pathParameters;
        const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const ReviewerName = parameters?.ReviewerName ? parameters.ReviewerName : undefined;
        const queryParams = event.queryStringParameters;
        const language = queryParams?.language ? queryParams.language : undefined;

        if (!movieId) {
            return {
              statusCode: 404,
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({ Message: "Missing movie Id" }),
            };
        }
        if (!ReviewerName) {
            return {
              statusCode: 404,
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({ Message: "Missing ReviewerName" }),
            };
        }

        if (!language) {
            return {
              statusCode: 404,
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({ Message: "Missing language from the body" }),
            };
        }

        const commandOutput = await ddbDocClient.send(
            new QueryCommand({
                TableName: process.env.TABLE_NAME, // Assuming you have set this environment variable
               // IndexName: 'ReviewerNameIndex', // Assuming you have a GSI on 'ReviewerName'
                KeyConditionExpression: 'ReviewerName = :ReviewerName AND MovieId = :MovieId',
                ExpressionAttributeValues: {
                    ':ReviewerName': ReviewerName,
                    ':MovieId': movieId

                },
            })
        );

        if (!commandOutput.Items || commandOutput.Items.length === 0) {
            return {
              statusCode: 404,
              headers: {
                "content-type": "application/json",
              },
              body: JSON.stringify({ Message: "For the specified MovieId, no movie reviews were found." }),
            };
        }
        const reviewText = commandOutput.Items[0].Content;
        

        const translateParams: AWS.Translate.Types.TranslateTextRequest = {
            Text: reviewText,
            SourceLanguageCode: 'en',
            TargetLanguageCode: language,
        };

        const translatedMessage = await translate.translateText(translateParams).promise();
        const translatedReview = translatedMessage.TranslatedText;

        return {
            statusCode: 200,
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ translatedReview }),
          };

    } catch (error: any) {
        console.log(JSON.stringify(error));
        return {
          statusCode: 500,
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ error }),
        };
      }
    };
    
    function createDDbDocClient() {
      const ddbClient = new DynamoDBClient({ region: process.env.REGION });
      const marshallOptions = {
        convertEmptyValues: true,
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      };
      const unmarshallOptions = {
        wrapNumbers: false,
      };
      const translateConfig = { marshallOptions, unmarshallOptions };
      return DynamoDBDocumentClient.from(ddbClient, translateConfig);
    }