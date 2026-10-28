FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server.ts ./
COPY src ./src
COPY public ./public
ENV HOST=0.0.0.0 PORT=4177
EXPOSE 4177
USER node
CMD ["node", "server.ts"]
