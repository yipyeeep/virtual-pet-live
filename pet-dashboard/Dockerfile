FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Accept build args with defaults
ARG NEXT_PUBLIC_WS_URL
ARG NODE_ENV

# Set environment variables for build
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NODE_ENV=production

RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]