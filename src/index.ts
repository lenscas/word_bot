import { CacheType, Client, Interaction, ModalBuilder } from "discord.js";

import path from "path";
import { discordToken } from "../config.json";

import {
  CommandPromise,
  CommandReturn,
  CommandTree,
  find_button_handler,
  find_command,
  find_context_menu_handler,
  find_modal_handler,
  find_role_select_handler,
  find_string_select_handler,
  get_commands_in,
  Handler,
  HandlerFinder,
  register_commands_for,
} from "./command";
import { help_through_slash } from "./help";
//import { enableGhostPingDetection } from './ghostPingDetection';
import { REST } from "@discordjs/rest";

const rest = new REST().setToken(discordToken);

const client = new Client({
  intents: ["Guilds", "MessageContent"],
});
const reply = async <Cache extends CacheType, I extends Interaction<Cache>>(
  interaction: I,
  toReplyWith: CommandReturn
) => {
  if (!toReplyWith) {
    return toReplyWith;
  }
  if (interaction.isRepliable()) {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply(toReplyWith);
    } else if (interaction.replied || interaction.deferred) {
      await interaction.followUp(toReplyWith);
    } else {
      await interaction.reply(toReplyWith);
    }
  } else {
    return toReplyWith;
  }
};

const runCommand = async <
  T extends Handler<I>,
  Cache extends CacheType,
  I extends Interaction<Cache>
>(
  handler: T,
  interaction: I
) => {
  try {
    return reply(interaction, await handler({ interaction, client, rest }));
  } catch (e) {
    console.error(e);
  }
};

const findAndRunCommand = async <
  T extends HandlerFinder<I>,
  Cache extends CacheType,
  I extends Interaction<Cache>
>(
  find_handler: T,
  interaction: I,
  name: string,
  commands: CommandTree
): CommandPromise => {
  const command = find_handler(name, commands);
  if (!command) {
    return reply(interaction, {
      content: "Could not find handler for this action. Handler=" + name,
      ephemeral: true,
    });
  }
  return runCommand(command, interaction);
};

(async () => {
  const commands = await get_commands_in(path.join(__dirname, "commands"));
  await client.login(discordToken);

  await register_slash_commands(client);
  client.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        const command = find_command(interaction.commandName, commands);
        if (!command) {
          console.log(
            "Tried to get autocomplete for " +
              interaction.commandName +
              " which does not exist as a command"
          );
          return;
        }
        if ("slash_command" in command) {
          if (
            "autoComplete" in command.slash_command &&
            command.slash_command.autoComplete
          ) {
            const res = await command.slash_command.autoComplete({
              interaction,
              client,
              rest,
            });
            await interaction.respond(res);
          } else {
            console.log(
              "Tried to get autocomplete for " +
                interaction.commandName +
                " which does not appear to have a way for autocompletion"
            );
          }
          return;
        }
      }
      if (interaction.isModalSubmit()) {
        await findAndRunCommand(
          find_modal_handler,
          interaction,
          interaction.customId,
          commands
        );
      }
      if (interaction.isButton()) {
        await findAndRunCommand(
          find_button_handler,
          interaction,
          interaction.customId,
          commands
        );
      }
      if (interaction.isRoleSelectMenu()) {
        await findAndRunCommand(
          find_role_select_handler,
          interaction,
          interaction.customId,
          commands
        );
      }
      if (interaction.isStringSelectMenu()) {
        await findAndRunCommand(
          find_string_select_handler,
          interaction,
          interaction.customId,
          commands
        );
      }

      if (interaction.isContextMenuCommand()) {
        await findAndRunCommand(
          find_context_menu_handler,
          interaction,
          interaction.commandName,
          commands
        );
      }
      if (!interaction.isChatInputCommand()) return;
      if (interaction.commandName == "help") {
        await help_through_slash({ client, interaction, rest }, commands);
        return;
      }
      const command = find_command(interaction.commandName, commands);
      if (!command) {
        await reply(interaction, {
          content:
            "Failed finding command to run. Command trying to run: " +
            interaction.commandName,
        });
        return;
      }
      if ("slash_command" in command) {
        if ("func" in command.slash_command) {
          const func = command.slash_command.func;
          await runCommand(func, interaction);
        } else {
          const builder = await command.slash_command.modal_builder({
            builder: new ModalBuilder().setCustomId(
              command.slash_command.modal_interaction[0].name
            ),
            interaction,
          });
          console.debug(builder);
          await interaction.showModal(builder);
        }
      }
    } catch (e) {
      console.log(e);
      if (interaction.isRepliable()) {
        const a = await reply(
          interaction,
          `Something has gone wrong.\nError:\n ${e}`
        );
        if (!a) {
          console.log("Could not log error in chat");
        }
      }
    }
  });
})();

async function register_slash_commands(client: Client) {
  try {
    const guilds = await client.guilds.fetch();
    for (const [guild] of guilds) {
      console.log(guild);
      await register_commands_for(client, guild, rest);
    }
  } catch (e) {
    console.error("Could not register commands!");
    throw e;
  }
}
