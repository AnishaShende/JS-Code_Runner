#!/bin/bash

set -e

echo "=== JS Code Runner Setup ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Install API dependencies
echo "Installing API dependencies..."
cd api
npm install

# Start the server (this will build the image and start the container)
echo "Starting the server..."
node server.js
