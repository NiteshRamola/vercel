import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import httpProxy from 'http-proxy';
import path from 'path';
const app = express();

const proxy = httpProxy.createProxy();

const BASE_PATH = `https://${process.env.BUCKET_NAME}.s3.ap-south-1.amazonaws.com/_outputs`;

const prisma = new PrismaClient({});

app.use(async (req: Request, res: Response) => {
  const hostname = req.hostname;
  const subdomain = hostname.split('.')[0];

  const project = await prisma.project.findFirst({
    where: {
      subDomain: subdomain,
    },
    select: {
      id: true,
    },
  });

  console.log('Project ID:', project?.id, 'Sub Domain:', subdomain);

  if (!project) {
    return res.sendFile(path.join(__dirname, '../static', 'error.html'));
  }

  const deployment = await prisma.deployment.findFirst({
    where: {
      projectId: project.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      status: true,
      id: true,
    },
  });

  console.log(
    'Deployment Id:',
    deployment?.id,
    'Deployment Status:',
    deployment?.status,
    'Sub Domain:',
    subdomain,
  );

  if (!deployment || deployment.status !== 'COMPLETED') {
    return res.sendFile(path.join(__dirname, '../static', 'wait.html'));
  }

  const resolvesTo = `${BASE_PATH}/${project?.id}`;

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on('proxyReq', (proxyReq, req, res) => {
  const url = req.url;
  if (url === '/') {
    proxyReq.path += 'index.html';
  } else if (!url?.split('.')[1]) {
    proxyReq.path =
      proxyReq.path.substring(0, proxyReq.path.lastIndexOf('/') + 1) +
      'index.html';
  }

  console.log(url);
});

const PORT = process.env.S3_REVERSE_PROXY_PORT || 8000;
app.listen(PORT, () => {
  console.log(`Reverse Proxy Running: ${PORT}`);
});
