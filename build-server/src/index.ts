import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import { Redis } from 'ioredis';
import mime from 'mime-types';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);

dotenv.config();

// Constants
const DEPLOYMENT_STATUS = {
  START: process.env.DEPLOYMENT_START || 'Deployment started',
  END: process.env.DEPLOYMENT_END || 'Deployment completed',
  ERROR: process.env.DEPLOYMENT_ERROR || 'Error',
};

// Environment variables
const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

// AWS S3 client setup
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Redis client setup
const publisher = new Redis(process.env.REDIS_URI!);

// Function to publish log to Redis
async function publishLog(log: string) {
  console.log(log);
  await publisher.publish(
    `logs`,
    JSON.stringify({
      log: log,
      deployment_id: DEPLOYMENT_ID,
      project_id: PROJECT_ID,
    }),
  );
}

// Main deployment function
async function main() {
  await publishLog(DEPLOYMENT_STATUS.START);

  const outputFolderPath = path.join(__dirname, '../output');

  try {
    // Execute npm install and npm run build
    await execAsync(`cd ${outputFolderPath} && npm install && npm run build`);
    await publishLog(`Build Complete`);

    const buildFolderPath = path.join(outputFolderPath, '/dist');
    await uploadFolder(buildFolderPath, `_outputs/${PROJECT_ID}`);

    await publishLog(DEPLOYMENT_STATUS.END);
  } catch (error) {
    await publishLog(`${DEPLOYMENT_STATUS.ERROR}: ${error}`);
  } finally {
    await publisher.quit();
  }
}

// Function to recursively upload a folder to S3
async function uploadFolder(
  folderPath: string,
  s3KeyPrefix: string,
): Promise<void> {
  const folderContents = await readdir(folderPath, { withFileTypes: true });

  for (const item of folderContents) {
    const itemPath = path.join(folderPath, item.name);
    const s3Key = path.join(s3KeyPrefix, item.name);

    if (item.isDirectory()) {
      await uploadFolder(itemPath, s3Key);
    } else {
      await uploadFileToS3(itemPath, s3Key);
    }
  }
}

// Function to upload a file to S3
async function uploadFileToS3(filePath: string, s3Key: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: s3Key,
    Body: fs.createReadStream(filePath),
    ContentType: mime.lookup(filePath) || '',
  });

  await s3Client.send(command);
  await publishLog(`Uploaded ${filePath}`);
}

// Function to get env without .env variables
interface ProcessEnv {
  [key: string]: string | undefined;
}
function customEnvironmentForExec(): ProcessEnv {
  const result = dotenv.config();

  const customEnvironmentVariables: ProcessEnv = Object.keys(process.env)
    .filter((key) => !result.parsed?.hasOwnProperty(key))
    .reduce<ProcessEnv>((acc, key) => {
      acc[key] = process.env[key];
      return acc;
    }, {});

  return customEnvironmentVariables;
}

// Asynchronous execution of a shell command
function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = exec(
      command,
      { env: customEnvironmentForExec() },
      async (error, stdout, stderr) => {
        if (error) {
          await publishLog(`${DEPLOYMENT_STATUS.ERROR}: ${error.toString()}`);
          reject(error);
        } else {
          await publishLog(stdout.toString());
          resolve();
        }
      },
    );

    p.stdout?.on('data', async (data) => {
      await publishLog(data.toString());
    });

    p.stderr?.on('data', async (data) => {
      await publishLog(`${DEPLOYMENT_STATUS.ERROR}: ${data.toString()}`);
    });
  });
}

main();
