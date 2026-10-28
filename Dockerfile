FROM node:20-bookworm-slim
ENV NODE_ENV=production TZ=Asia/Almaty
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY backend/ ./
COPY frontend/ /app/frontend/
ENV FRONTEND_DIR=/app/frontend
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
