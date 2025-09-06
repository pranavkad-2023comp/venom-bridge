# Use official Node image
FROM node:20-bullseye

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy app source code
COPY . .

# Expose port (Render will set $PORT dynamically)
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
