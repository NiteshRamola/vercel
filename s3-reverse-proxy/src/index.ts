import 'dotenv/config';
import express from 'express';
import httpProxy from 'http-proxy';
const app = express();

const proxy = httpProxy.createProxy();

const BASE_PATH = `https://${process.env.BUCKET_NAME}.s3.ap-south-1.amazonaws.com/_outputs`;

app.use((req, res) => {
  const hostname = req.hostname;
  const subdomain = hostname.split('.')[0];

  const resolvesTo = `${BASE_PATH}/${subdomain}`;

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on('proxyReq', (proxyReq, req, res) => {
  const url = req.url;
  if (url === '/') proxyReq.path += 'index.html';

  console.log(url);
});

const PORT = 80;
app.listen(PORT, () => {
  console.log(`Reverse Proxy Running: ${PORT}`);
});
