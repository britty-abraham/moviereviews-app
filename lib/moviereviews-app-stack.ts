import * as cdk from 'aws-cdk-lib';
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { Construct } from 'constructs';
import * as apig from "aws-cdk-lib/aws-apigateway";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/moviereviews";



export class MoviereviewsAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Tables 
    const moviereviewsTable = new dynamodb.Table(this, "MoviereviewsTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "MovieId", type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Moviereviews",
    });

    // Create a secondary index on ReviewerName
    moviereviewsTable.addGlobalSecondaryIndex({
      indexName: 'ReviewerNameIndex',
      partitionKey: { name: 'ReviewerName', type: dynamodb.AttributeType.STRING },
    });

    new custom.AwsCustomResource(this, "moviereviewsddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [moviereviewsTable.tableName]: generateBatch(movieReviews),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviereviewsddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [moviereviewsTable.tableArn],  
      }),
    });

    // Functions
    const newReviewFn = new lambdanode.NodejsFunction(this, "AddReviewFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: `${__dirname}/../lambdas/addReview.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        TABLE_NAME: moviereviewsTable.tableName,
        REGION: "eu-west-1",
      },
    });

    const getAllReviewsByIdFn = new lambdanode.NodejsFunction(
      this,
      "GetAllReviewsByIdFn",
      {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_18_X,
        entry: `${__dirname}/../lambdas/getAllReviewsById.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviereviewsTable.tableName,
          REGION: 'eu-west-1',
        },
      }
    );

    const getAllReviewsByIdBynameoryearFn = new lambdanode.NodejsFunction(
      this,
      "GetAllReviewsByIdBynameoryearFn",
      {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/getAllReviewsByIdBynameoryear.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: moviereviewsTable.tableName,
            REGION: 'eu-west-1',
          },
      }
    );

    const updateReviewFn = new lambdanode.NodejsFunction(
      this,
      "UpdateReviewFn",
      {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/updateReview.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: moviereviewsTable.tableName,
            REGION: 'eu-west-1',
          },
      }
    );

    const getAllReviewsByNameFn = new lambdanode.NodejsFunction(
      this,
      "GetAllReviewsByNameFn",
      {
          architecture: lambda.Architecture.ARM_64,
          runtime: lambda.Runtime.NODEJS_18_X,
          entry: `${__dirname}/../lambdas/getAllReviewsByName.ts`,
          timeout: cdk.Duration.seconds(10),
          memorySize: 128,
          environment: {
            TABLE_NAME: moviereviewsTable.tableName,
            REGION: 'eu-west-1',
          },
      }
    );

    const api = new apig.RestApi(this, "RestAPI", {
      description: "MovieReview api",
      deployOptions: {
        stageName: "dev",
      },
      defaultCorsPreflightOptions: {
        allowHeaders: ["Content-Type", "X-Amz-Date"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "DELETE"],
        allowCredentials: true,
        allowOrigins: ["*"],
      },
    });

    const moviesEndpoint = api.root.addResource("movies");
    const addreviewsEndpoint = moviesEndpoint.addResource("reviews");

    const movieEndpoint = moviesEndpoint.addResource("{movieId}");
    const reviewsByMovieIdEndpoint = movieEndpoint.addResource("reviews");
    const reviewsnameoryearEndpoint = reviewsByMovieIdEndpoint.addResource("{yearorname}");
    const reviewsEndpoint = api.root.addResource("reviews");
    const byreviewernameEndpoint = reviewsEndpoint.addResource("{ReviewerName}");

    
    addreviewsEndpoint.addMethod(
      "POST",
      new apig.LambdaIntegration(newReviewFn, { proxy: true })
    );
    reviewsByMovieIdEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllReviewsByIdFn, { proxy: true })
    );
    reviewsnameoryearEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllReviewsByIdBynameoryearFn, { proxy: true })
    );
    reviewsnameoryearEndpoint.addMethod(
      "PUT",
      new apig.LambdaIntegration(updateReviewFn, { proxy: true })
    );
    byreviewernameEndpoint.addMethod(
      "GET",
      new apig.LambdaIntegration(getAllReviewsByNameFn, { proxy: true })
    );

    moviereviewsTable.grantReadWriteData(newReviewFn);
    moviereviewsTable.grantReadData(getAllReviewsByIdFn);
    moviereviewsTable.grantReadData(getAllReviewsByIdBynameoryearFn);
    moviereviewsTable.grantReadWriteData(updateReviewFn);
    moviereviewsTable.grantReadData(getAllReviewsByNameFn);
   

  }
}
