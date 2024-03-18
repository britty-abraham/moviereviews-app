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
    console.log("Event: ", event);
    const parameters  = event?.pathParameters;
    const movieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
    const nameoryear = parameters?.yearorname ? parameters.yearorname : undefined;   console.log("nameoryear: ", nameoryear);
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

    if (nameoryear) {
        if (isParameterAnInteger(nameoryear)) {
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "MovieId = :m",
                FilterExpression: "begins_with(ReviewDate, :year)",
                ExpressionAttributeValues: {
                  ":m": movieId,
                  ":year": nameoryear,
                },
              };
            
        } else {
            commandInput = {
                ...commandInput,
                KeyConditionExpression: "MovieId = :m and ReviewerName = :n",
                ExpressionAttributeValues: {
                  ":m": movieId,
                  ":n": nameoryear,
                },
              };
            
        }
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
          body: JSON.stringify({ Message: "No matching movie reviews were found." }),
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

function isParameterAnInteger(param: string): boolean {
    const parsedInt = parseInt(param, 10);
    return !isNaN(parsedInt) && Number.isInteger(parsedInt);
}


