import { S3 } from 'aws-sdk';
import 'dotenv/config';
import express from 'express';
import mime from 'mime-types';

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const app = express();

app.get('/*', async (req, res) => {
  try {
    const host = req.hostname;

    const id = host.split('.')[0];
    const filePath = req.path;

    console.log(id, filePath);

    const contentType = mime.contentType(filePath.split('/').slice(-1)[0]);

    res.set('Content-Type', contentType || 'application/octet-stream');

    const stream = s3
      .getObject({
        Bucket: process.env.BUCKET_NAME!,
        Key: `buildRepos/${id}${filePath}`,
      })
      .createReadStream();

    stream.on('error', (error) => {
      if ('code' in error && error.code === 'NoSuchKey') {
        res.status(404).send('Not Found');
      } else {
        console.error('Error retrieving S3 object:', error);
        res.status(500).send('Internal Server Error');
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error('Error retrieving S3 object:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3001, () => {
  console.log('Server is running on port 3001');
});
