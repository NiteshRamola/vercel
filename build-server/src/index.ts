import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import 'dotenv/config';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const PROJECT_ID = process.env.PROJECT_ID;

async function main() {
  console.log('Starting script...');

  const outDirPath = path.join(__dirname, '../output');

  try {
    await execAsync(`cd ${outDirPath} && npm install && npm run build`);
    console.log('Build complete');

    const distFolderPath = path.join(__dirname, '../output', 'dist');
    const distFolderContents = await fs.promises.readdir(distFolderPath, {
      withFileTypes: true,
    });

    for (const file of distFolderContents) {
      const filePath = path.join(distFolderPath, file.name);
      if (file.isDirectory()) continue;

      console.log('Uploading', filePath);

      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: `__outputs/${PROJECT_ID}/${file.name}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath) || '',
      });

      await s3Client.send(command);
      console.log('Uploaded', filePath);
    }

    console.log('Done...');
  } catch (error) {
    console.error('Error:', error);
  }
}

function execAsync(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing command:', error);
        reject(error);
      } else {
        console.log(stdout);
        resolve();
      }
    });

    p.stdout?.on('data', (data) => console.log(data.toString()));
    p.stderr?.on('data', (data) => console.error('Error:', data.toString()));
  });
}

main();
