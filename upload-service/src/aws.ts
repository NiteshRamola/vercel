import { S3 } from 'aws-sdk';
import fs from 'fs/promises';

const s3 = new S3({});

export const uploadFile = async (fileName: string, localFilePath: string) => {
  const fileContent = await fs.readFile(localFilePath);
  const response = await s3
    .upload({
      Body: fileContent,
      Bucket: process.env.BUCKET_NAME!,
      Key: fileName,
    })
    .promise();

  console.log(response?.Location);
};
