FROM node:20-alpine

WORKDIR /app

COPY ./package*.json ./

RUN npm install --production

COPY prisma/ ./prisma/

RUN npx prisma generate

COPY . .

RUN npm run build

CMD ["node", "dist/index.js"]

