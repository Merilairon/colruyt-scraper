FROM node:latest

ARG PORT=3000

WORKDIR /srv/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

EXPOSE ${PORT}

CMD ["node", "dist/server.js"]
