# One image that serves both halves: Express already serves client/dist when it exists,
# so the built front end ships inside the API container and everything is same-origin on one port.

# ---- 1. build the front end ----
FROM node:22-bookworm-slim AS client
WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# ---- 2. server dependencies, production only ----
# --omit=dev leaves out mongodb-memory-server, which would otherwise download a mongod binary
# into the image. It is only imported when MONGO_URI is unset, and in Docker it always is set.
FROM node:22-bookworm-slim AS deps
WORKDIR /build
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# ---- 3. runtime ----
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update && apt-get install -y tini wget && rm -rf /var/lib/apt/lists/*

# app.js resolves ../../client/dist from server/src, so the two must keep this shape
COPY --from=deps  /build/node_modules  ./server/node_modules
COPY server/                            ./server/
COPY --from=client /build/dist          ./client/dist

# drop privileges — the node image ships an unprivileged `node` user
RUN chown -R node:node /app
USER node

WORKDIR /app/server
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=4s --start-period=40s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT:-4000}/healthz > /dev/null || exit 1

# tini reaps zombies and makes Ctrl-C actually stop the server
ENTRYPOINT ["/sbin/tini", "--"]
# not `npm start`: that script passes --env-file=.env, and in a container the config comes
# from real environment variables instead.
CMD ["node", "src/index.js"]
