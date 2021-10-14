FROM node:11
RUN mkdir -p /home/node/BraveSensor/node_modules && chown -R node:node /home/node/BraveSensor
WORKDIR /home/node/BraveSensor
COPY package*.json ./
USER node
RUN npm install
COPY --chown=node:node . .
EXPOSE 8080
CMD ["node", "index.js"]