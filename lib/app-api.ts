import { Aws } from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apig from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import { generateBatch } from "../shared/util";
import { movieReviews } from "../seed/moviereviews";

type AppApiProps = {
  userPoolId: string;
  userPoolClientId: string;
};

export class AppApi extends Construct {
  constructor(scope: Construct, id: string, props: AppApiProps) {
    super(scope, id);

    const appApi = new apig.RestApi(this, "AppApi", {
      description: "App RestApi",
      endpointTypes: [apig.EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowOrigins: apig.Cors.ALL_ORIGINS,
      },
    });

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

    const appCommonFnProps = {
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      runtime: lambda.Runtime.NODEJS_16_X,
      handler: "handler",
      environment: {
        USER_POOL_ID: props.userPoolId,
        CLIENT_ID: props.userPoolClientId,
        REGION: cdk.Aws.REGION,
      },
    };

    // Functions
    const newReviewFn = new lambdanode.NodejsFunction(this, "AddReviewFn", {
        architecture: lambda.Architecture.ARM_64,
        runtime: lambda.Runtime.NODEJS_16_X,
        entry: `${__dirname}/../lambdas/addReview.ts`,
        timeout: cdk.Duration.seconds(10),
        memorySize: 128,
        environment: {
          TABLE_NAME: moviereviewsTable.tableName,
          USER_POOL_ID: props.userPoolId,
          CLIENT_ID: props.userPoolClientId,
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
            USER_POOL_ID: props.userPoolId,
            CLIENT_ID: props.userPoolClientId,
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
              USER_POOL_ID: props.userPoolId,
              CLIENT_ID: props.userPoolClientId,
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
              USER_POOL_ID: props.userPoolId,
              CLIENT_ID: props.userPoolClientId,
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
              USER_POOL_ID: props.userPoolId,
              CLIENT_ID: props.userPoolClientId,
              REGION: 'eu-west-1',
            },
        }
      );

      const moviesEndpoint = appApi.root.addResource("movies");
      const addreviewsEndpoint = moviesEndpoint.addResource("reviews");
  
      const movieEndpoint = moviesEndpoint.addResource("{movieId}");
      const reviewsByMovieIdEndpoint = movieEndpoint.addResource("reviews");
      const reviewsnameoryearEndpoint = reviewsByMovieIdEndpoint.addResource("{yearorname}");
      const updatereviewEndpoint = reviewsByMovieIdEndpoint.addResource("{ReviewerName}");
      const reviewsEndpoint = appApi.root.addResource("reviews");
      const byreviewernameEndpoint = reviewsEndpoint.addResource("{ReviewerName}");


    const authorizerFn = new lambdanode.NodejsFunction(this, "AuthorizerFn", {
      ...appCommonFnProps,
      entry: "./lambdas/auth/authorizer.ts",
    });

    const requestAuthorizer = new apig.RequestAuthorizer(
      this,
      "RequestAuthorizer",
      {
        identitySources: [apig.IdentitySource.header("cookie")],
        handler: authorizerFn,
        resultsCacheTtl: cdk.Duration.minutes(0),
      }
    );


    addreviewsEndpoint.addMethod(
        "POST",
        new apig.LambdaIntegration(newReviewFn, { proxy: true }),
        {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        }
    );
    reviewsByMovieIdEndpoint.addMethod(
        "GET",
        new apig.LambdaIntegration(getAllReviewsByIdFn, { proxy: true })
    );
    reviewsnameoryearEndpoint.addMethod(
        "GET",
        new apig.LambdaIntegration(getAllReviewsByIdBynameoryearFn, { proxy: true })
    );
    updatereviewEndpoint.addMethod(
        "PUT",
        new apig.LambdaIntegration(updateReviewFn, { proxy: true }),
        {
            authorizer: requestAuthorizer,
            authorizationType: apig.AuthorizationType.CUSTOM,
        }
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