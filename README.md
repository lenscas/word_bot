# Roguelite Bot

Just a fun discord bot I decided to make that plays a simple roguelite through discord

# Dependencies

- Node (v18)
- Yarn (npm install yarn -g)

# Setup docker

1. Install docker and docker compose
2. Copy `config.example.json` to `config.json`
3. Put your own key into the `config.json` file (You can get a key for your bot at https://discord.com/developers/applications )
4. Run `docker-compose up` and watch the magic happen as `docker-compose` pulls in everything needed and starts the bot.

# Setup locally

1. Copy `config.example.json` to `config.json`
2. Put your own key into the `config.json` file (You can get a key for your bot at https://discord.com/developers/applications )
3. Run `yarn install`
4. Run `yarn start` to start the bot. Or use `yarn start:dev` to also have it automatically restart when it detects changes.

# Useful scripts

There are a few commands placed in the package.json file. You can run these commands using `yarn {commandName}`

1. `lintFix` uses eslint to fix most lint errors (PR's with lint errors won't get merged)
2. `unitTest` runs the unit tests
3. `start:dev` automatically compiles and restarts on changes
4. `build` does a clean build
5. `start` does a clean build, then starts the bot
6. `lint` runs eslint and tells you what the problems are.
7. `test` runs the linter and the unit tests
