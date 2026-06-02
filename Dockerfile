FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY packages/test/package*.json ./packages/test/
COPY packages/service/package*.json ./packages/service/

RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "start"]
