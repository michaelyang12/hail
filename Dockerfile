FROM oven/bun:1.3-alpine
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY data ./data

# Inside the container the server must listen on all interfaces; publish the port
# on 127.0.0.1 on the host to keep it private to the tunnel.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
USER bun
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:3000/ || exit 1
CMD ["bun", "src/server.ts"]
