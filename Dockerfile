FROM node:11
RUN mkdir -p /home/node/ODetect-Backend-Local/node_modules && chown -R node:node /home/node/ODetect-Backend-Local
WORKDIR /home/node/ODetect-Backend-Local
COPY package*.json ./
USER node
RUN npm install
COPY --chown=node:node . .
EXPOSE 8081
CMD ["node", "index.js"]


sudo docker run -it --entrypoint=/bin/bash mariocimet/odetect-load-sim