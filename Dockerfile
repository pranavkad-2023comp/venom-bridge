FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
