FROM node:24-alpine AS verify
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json server.ts ./
COPY src ./src
COPY public ./public
COPY tests ./tests
COPY scripts ./scripts
RUN npm run check && npm test

FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=verify /app/server.ts ./
COPY --from=verify /app/src ./src
COPY --from=verify /app/public ./public
ENV HOST=0.0.0.0 PORT=4177 NODE_ENV=production
EXPOSE 4177
USER node
CMD ["node", "server.ts"]
