FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY runner.js ./

# Create non-root user for security
RUN addgroup -g 1001 -S runner && \
    adduser -S runner -u 1001 -G runner

USER runner

EXPOSE 3001

CMD ["node", "runner.js"]
