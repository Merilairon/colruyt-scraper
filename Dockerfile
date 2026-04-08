FROM node:20-bookworm-slim

ARG PORT=3000

WORKDIR /srv/app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE ${PORT}

CMD ["node", "dist/server.js"]
