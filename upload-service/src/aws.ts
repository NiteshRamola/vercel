import { S3 } from 'aws-sdk';
import fs from 'fs';

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

export const uploadFile = async (fileName: string, localFilePath: string) => {
  const fileContent = fs.createReadStream(localFilePath);
  const response = await s3
    .upload({
      Body: fileContent,
      Bucket: process.env.BUCKET_NAME!,
      Key: fileName.replace(/\\/g, '/'),
    })
    .promise();

  console.log(response?.Location);
};
