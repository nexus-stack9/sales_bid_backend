# Use official Node.js LTS image
FROM node:20

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies (use npm ci for production)
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the app (consider "start" for production instead of "dev")
CMD ["npm", "run", "dev"]
