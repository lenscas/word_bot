import { Guild } from "discord.js";
import {
  CommandTree,
  drill_until_found_something,
  Command,
  find_something,
  SlashCommandParams,
} from "./command";

const start_message =
  "Hello! GameDev!\n\
I'm here to keep track of who is helpful so the mods can reward them with a special role.\n\
Did you recently get help and want to show your appreciation? Use the !thx command.\n\
If you want more information about a specific command, just pass the command as argument (!help thx).\n";

export async function getHelpText(
  guild: Guild,
  commandTree: CommandTree,
  command: Array<string> | undefined
): Promise<string> {
  if (!command) {
    return [start_message].concat(render_group(commandTree)).join("\n");
  }
  const found_something =
    command.length == 1
      ? find_something(command[0], commandTree)
      : drill_until_found_something(command, commandTree);
  if (!found_something || "context_menu" in found_something) {
    return "Could not find that group/command";
  } else if ("slash_command" in found_something) {
    return found_something.help_text;
  } else if (Array.isArray(found_something)) {
    return ["**Commands**"]
      .concat(found_something.map((v) => "`" + v + "`"))
      .join("\n");
  } else {
    return render_group(found_something).join("\n");
  }
}

export async function help_through_slash(
  params: SlashCommandParams,
  commandTree: CommandTree
): Promise<void> {
  if (!params.interaction.guild) {
    return;
  }
  const res = params.interaction.options.getString("search");

  const toSearchFor = res ? [res] : undefined;
  await params.interaction.reply({
    ephemeral: true,
    content: await getHelpText(
      params.interaction.guild,
      commandTree,
      toSearchFor
    ),
  });
}

export function render_group(commandTree: CommandTree): string[] {
  const commands: Array<string> = [];
  const groups: Array<string> = [];
  commandTree.commands.forEach((v) => {
    if ("name" in v) {
      commands.push(`\`${v.name}\``);
    } else {
      const filtered = v.commands.filter(
        (x): x is { name: string; command: Command } => {
          return "name" in x;
        }
      );
      const maxCommandsShown = 4;
      groups.push(
        v.group +
          " : " +
          filtered.slice(0, maxCommandsShown).map((x) => "`" + x.name + "`") +
          (filtered < v.commands || filtered.length > maxCommandsShown
            ? "+ more"
            : "")
      );
    }
  });
  return (
    commands.length > 0 ? ["**Commands** :"].concat(commands) : []
  ).concat(groups.length > 0 ? ["**Groups** :"].concat(groups) : []);
}
