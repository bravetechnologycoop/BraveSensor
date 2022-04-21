FROM node:16.14.2
RUN mkdir -p /home/node/BraveSensor/node_modules && chown -R node:node /home/node/BraveSensor
WORKDIR /home/node/BraveSensor
COPY --chown=node:node package*.json ./
USER node
RUN npm install
COPY --chown=node:node . .
EXPOSE 8080
CMD ["node", "index.js"]