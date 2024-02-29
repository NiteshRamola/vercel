import { DeploymentStatus, PrismaClient } from '@prisma/client';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import httpProxy from 'http-proxy';
const app = express();

const proxy = httpProxy.createProxy();

const BASE_PATH = `https://${process.env.BUCKET_NAME}.s3.ap-south-1.amazonaws.com/_outputs`;

const prisma = new PrismaClient({});

app.use(async (req: Request, res: Response) => {
  const hostname = req.hostname;
  const subdomain = hostname.split('.')[0];

  const deployment = await prisma.deployment.findFirst({
    where: {
      project: {
        subDomain: subdomain,
      },
      status: DeploymentStatus.COMPLETED,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  console.log('Latest Completed Deployment ID:', deployment?.id);

  const resolvesTo = `${BASE_PATH}/${deployment?.id}`;

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on('proxyReq', (proxyReq, req, res) => {
  const url = req.url;
  if (url === '/') proxyReq.path += 'index.html';

  console.log(url);
});

const PORT = process.env.S3_REVERSE_PROXY_PORT || 8000;
app.listen(PORT, () => {
  console.log(`Reverse Proxy Running: ${PORT}`);
});
