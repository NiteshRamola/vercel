FROM ubuntu:focal

RUN apt-get update
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get upgrade -y
RUN apt-get install -y nodejs

RUN apt-get install git -y

WORKDIR /home/app

COPY package*.json .
RUN npm install --production

COPY main.sh main.sh
COPY src/index.ts src/index.ts
COPY tsconfig.json tsconfig.json

RUN npm run build

RUN chmod +x main.sh
RUN chmod +x dist/index.js

ENTRYPOINT [ "/home/app/main.sh" ]