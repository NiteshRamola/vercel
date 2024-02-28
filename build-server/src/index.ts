import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import 'dotenv/config';
import fs from 'fs';
import { Redis } from 'ioredis';
import mime from 'mime-types';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const publisher = new Redis(process.env.REDIS_URI!);

const PROJECT_ID = process.env.PROJECT_ID;

function publishLog(log: string) {
  publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
}

async function main() {
  console.log('Starting script...');
  publishLog('Build started...');

  const outputFolderPath = path.join(__dirname, '../output');

  try {
    await execAsync(`cd ${outputFolderPath} && npm install && npm run build`);
    console.log('Build complete');
    publishLog(`Build Complete`);

    const buildFolderPath = path.join(outputFolderPath, '/dist');
    await uploadFolder(buildFolderPath, `_outputs/${PROJECT_ID}`);

    console.log('Done...');
    publishLog(`Done...`);
  } catch (error) {
    publishLog(`Error: ${error}`);
    console.error('Error:', error);
  } finally {
    await publisher.quit();
  }
}

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
      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: s3Key,
        Body: fs.createReadStream(itemPath),
        ContentType: mime.lookup(itemPath) || '',
      });

      await s3Client.send(command);
      console.log('Uploaded', itemPath);
      publishLog(`uploaded ${itemPath}`);
    }
  }
}

function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing command:', error);
        publishLog(`Error: ${error.toString()}`);
        reject(error);
      } else {
        console.log(stdout);
        publishLog(stdout.toString());
        resolve();
      }
    });

    p.stdout?.on('data', (data) => {
      console.log(data.toString());
      publishLog(data.toString());
    });

    p.stderr?.on('data', (data) => {
      console.error('Error:', data.toString());
      publishLog(`Error: ${data.toString()}`);
    });
  });
}

main();
