FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server.ts ./
COPY src ./src
COPY public ./public
ENV HOST=0.0.0.0 PORT=4177 NODE_ENV=production
EXPOSE 4177
USER node
CMD ["node", "server.ts"]
