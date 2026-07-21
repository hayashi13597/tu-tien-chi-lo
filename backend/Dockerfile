FROM node:24-alpine
WORKDIR /app
# Prisma's runtime OpenSSL-version detection (used to pick the right query
# engine binary) needs the `openssl` CLI present; without it, on newer Alpine
# bases (OpenSSL 3-only, no libssl.so.1.1 compat), detection fails and Prisma
# silently defaults to an incompatible openssl-1.1.x engine binary.
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
