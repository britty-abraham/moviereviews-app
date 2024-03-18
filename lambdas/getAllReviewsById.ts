import { APIGatewayProxyHandlerV2 } from "aws-lambda"; 

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
} from "@aws-sdk/lib-dynamodb";


const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => { // CHANGED
  try {
    // Print Event
    console.log("Event: ", event);
    const parameters  = event?.pathParameters;
    const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    const queryParams = event.queryStringParameters;
    const minRating = queryParams?.minRating ? parseInt(queryParams.minRating) : undefined;

    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie Id" }),
      };
    }

    let commandInput: QueryCommandInput = {
      TableName: process.env.TABLE_NAME,
    };

    if (minRating !== undefined) {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "MovieId = :m",
        FilterExpression: "Rating >= :r",
        ExpressionAttributeValues: {
          ":m": movieId,
          ":r": minRating,
        },
      };
    }
    else {
      commandInput = {
        ...commandInput,
        KeyConditionExpression: "MovieId = :m ",
        ExpressionAttributeValues: {
          ":m": movieId,
        },
      };
    }
    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );


    // Return Response
    if (!commandOutput.Items || commandOutput.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "For the specified MovieId, no movie reviews were found." }),
      };
    }
    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ data: commandOutput.Items }),
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
