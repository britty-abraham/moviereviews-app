import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Moviereview"] || {});

const ddbDocClient = createDDbDocClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
    try {
        // Print Event
        console.log("Event: ", event);
        const body = event.body ? JSON.parse(event.body) : undefined;
        const parameters  = event?.pathParameters;
        const MovieId = parameters?.movieId ? parseInt(parameters.movieId) : undefined;
        const ReviewerName = parameters?.ReviewerName ? parameters.ReviewerName : undefined;  console.log("ReviewerName: ", ReviewerName);
        if (!body) {
            return {
                statusCode: 400,
                headers: {
                "content-type": "application/json",
                },
                body: JSON.stringify({ message: "Missing request body" }),
            };
        }

        if (!isValidBodyParams(body)) {
            return {
                statusCode: 400,
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    message: `Incorrect type. Must match Moviereview schema`,
                    schema: schema.definitions["Moviereview"],
                }),
            };
        }

        const id = body.MovieId; // Assuming id is present in the request body
        if (!id) {
            return {
            statusCode: 400,
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({ message: "Missing MovieId in the request body" }),
            };
        }

        const updatedReview = {
            MovieId,
            ReviewerName,
            ...body, // Update the review text here
          };
      
          const commandOutput = await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.TABLE_NAME,
              Item: updatedReview,
            })
          );

        return {
        statusCode: 200,
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ message: "Moviereview updated" }),
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