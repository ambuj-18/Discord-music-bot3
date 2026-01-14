FROM node:18-alpine

# ffmpeg install
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

CMD ["node", "index.js"]
