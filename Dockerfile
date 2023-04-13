FROM node:16.13.2-alpine

RUN mkdir /app
COPY backend /app/backend
COPY frontend /app/frontend

WORKDIR /app/frontend
RUN npm install
RUN npm run prod

WORKDIR /app/backend
RUN npm install
ENV TZ=Europe/Stockholm

## Se till att den lokala containerporten exponeras för reverse proxy
EXPOSE 80

CMD ["npm", "run", "prod"]