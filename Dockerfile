FROM node:20-bullseye

# Install Chromium dependencies required by Puppeteer / Venom
RUN apt-get update && apt-get install -y \
    ca-certificates fonts-liberation libnss3 lsb-release wget xdg-utils \
    gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 \
    libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 \
    libxrender1 libxss1 libxtst6 libdrm2 libgbm1 \
    --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Use --omit=dev to avoid deprecated --production warning
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
