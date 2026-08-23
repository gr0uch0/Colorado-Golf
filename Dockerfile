# Use a Python image that also includes Node.js tools
FROM node:20-slim AS node
FROM python:3.11-slim

# Copy Node.js from the node image into the Python image
COPY --from=node /usr/local /usr/local

WORKDIR /app

# Copy all your project files
COPY . .

# Install your Node.js and Python packages
RUN npm install
RUN pip install --no-cache-dir -r server/requirements.txt
