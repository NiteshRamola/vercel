import { S3 } from 'aws-sdk';
import 'dotenv/config';
import fs, { promises as fsPromise } from 'fs';
import path from 'path';
import { getAllFiles } from './file';

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const bucketName = process.env.BUCKET_NAME!;

export async function downloadS3Folder(prefix: string) {
  const { Contents } = await s3
    .listObjectsV2({ Bucket: bucketName, Prefix: prefix })
    .promise();

  if (Contents) {
    await Promise.all(
      Contents.map(async ({ Key }) => {
        if (!Key) return;

        const finalOutputPath = path.resolve(__dirname, '../../' + Key);
        const dirName = path.dirname(finalOutputPath);

        if (!fs.existsSync(dirName)) {
          await fsPromise.mkdir(dirName, { recursive: true });
        }

        const outputFile = fs.createWriteStream(finalOutputPath);
        const s3Stream = s3
          .getObject({ Bucket: bucketName, Key })
          .createReadStream();

        await new Promise((resolve, reject) => {
          s3Stream.on('error', reject);
          outputFile.on('finish', resolve);
          s3Stream.pipe(outputFile);
        });

        console.log(`Downloaded: ${Key}`);
      }),
    );
  }
}

export async function copyFinalDist(id: string, folderPath: string) {
  const allFiles = await getAllFiles(folderPath);

  await Promise.all(
    allFiles.map(async (file) => {
      const s3Key = `buildRepos/${id}/` + file.slice(folderPath.length + 1);
      await uploadFile(s3Key, file);
    }),
  );
}

const uploadFile = async (s3Key: string, localFilePath: string) => {
  const fileContent = await fsPromise.readFile(localFilePath);
  await s3
    .upload({
      Body: fileContent,
      Bucket: bucketName,
      Key: s3Key.replace(/\\/g, '/'),
    })
    .promise();
  console.log(`Uploaded: ${s3Key}`);
};
