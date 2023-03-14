FROM node:16

RUN mkdir /app
COPY backend /app/backend
COPY frontend /app/frontend
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh

WORKDIR /app/frontend
RUN npm install
RUN npm run prod

WORKDIR /app/backend
RUN npm install
ENV TZ=Europe/Stockholm

## Se till att den lokala containerporten exponeras för reverse proxy
EXPOSE 80

CMD ["npm", "run", "prod"]