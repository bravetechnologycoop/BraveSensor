FROM node:11
RUN mkdir -p /home/node/BraveSensor-Server/node_modules && chown -R node:node /home/node/BraveSensor-Server
WORKDIR /home/node/BraveSensor-Server
COPY package*.json ./
USER node
RUN npm install
COPY --chown=node:node . .
EXPOSE 8080
CMD ["node", "index.js"]