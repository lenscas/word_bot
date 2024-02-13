FROM node:18-alpine3.18

WORKDIR /home/app

RUN apk add yarn
RUN apk add python3 make

RUN echo "test"

COPY package.json /home/app/
COPY yarn.lock /home/app/

RUN rm -rf node_modules
RUN yarn install

COPY . /home/app

CMD ./scripts/startup.sh