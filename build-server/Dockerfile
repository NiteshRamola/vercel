FROM ubuntu:focal

RUN apt-get update \
    && apt-get install -y curl \
    && curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get upgrade -y \
    && apt-get install -y nodejs \
    && apt-get install -y git

WORKDIR /home/app

COPY package*.json .
RUN npm install --production

COPY . .

RUN npm run build

RUN chmod +x main.sh dist/index.js

ENTRYPOINT [ "/home/app/main.sh" ]

RUN apt-get clean \
    && rm -rf /var/lib/apt/lists/*
