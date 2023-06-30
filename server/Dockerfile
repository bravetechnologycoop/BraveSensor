FROM node:18.16.1
RUN mkdir -p /home/node/BraveSensor/node_modules && chown -R node:node /home/node/BraveSensor
WORKDIR /home/node/BraveSensor
COPY --chown=node:node package*.json ./
USER node
RUN npm ci
COPY --chown=node:node . .
EXPOSE 8080
CMD ["node", "index.js"]