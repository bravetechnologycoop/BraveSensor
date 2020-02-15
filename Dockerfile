RUN npm install pm2 -g
FROM node:11
WORKDIR /.

CMD ["pm2-runtime", "index.js"]
