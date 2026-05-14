# Step 1: Build the Vite application
FROM node:18-alpine as builder

WORKDIR /opt/temp

# Copy both package.json AND package-lock.json (this fixes the missing file error!)
COPY package*.json ./

# Install dependencies
ENV CI=true NODE_ENV=development NPM_CONFIG_FUND=false
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the project
RUN npm run build

# Step 2: Serve the application using Nginx
FROM nginx:alpine

# Copy the built assets from the builder stage to Nginx's public directory
COPY --from=builder /opt/temp/dist /usr/share/nginx/html

# Copy a basic Nginx configuration if you need routing (optional, Vite default is usually fine)
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
