FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    TZ=Asia/Shanghai \
    XD_PORT=3020 \
    XD_DATA_DIR=/app/data

WORKDIR /app

# 零第三方依赖：不需要 npm install
COPY package.json ./
COPY server ./server
COPY public ./public

RUN mkdir -p /app/data && node -e "const{DatabaseSync}=require('node:sqlite');new DatabaseSync(':memory:').exec('create table t(a)');console.log('sqlite ok')"

EXPOSE 3020
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.XD_PORT||3020)+'/api/projects').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
