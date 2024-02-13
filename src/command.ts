import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import {
  PermissionFlagsBits,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIContextMenuApplicationCommandsJSONBody,
  Routes,
} from "discord-api-types/v10";
import {
  ApplicationCommandOptionChoiceData,
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  InteractionReplyOptions,
  MessagePayload,
  ModalBuilder,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { readdir, lstat } from "fs/promises";
import path from "path";

export type CommandParams = {
  client: Client;
  rest: REST;
};

export type CommandReturn =
  | void
  | string
  | InteractionReplyOptions
  | MessagePayload;
export type CommandPromise = Promise<CommandReturn>;

export type BasicCommandParams<I> = {
  interaction: I;
} & CommandParams;

export type SlashCommandParams =
  BasicCommandParams<ChatInputCommandInteraction>;
export type AutoCompleteParams = BasicCommandParams<AutocompleteInteraction>;
export type ModalSubmitParams = BasicCommandParams<ModalSubmitInteraction>;
export type ButtonCommandParams = BasicCommandParams<ButtonInteraction>;
export type RoleSelectCommandParams =
  BasicCommandParams<RoleSelectMenuInteraction>;
export type StringSelectCommandParams =
  BasicCommandParams<StringSelectMenuInteraction>;

export type Handler<T> = (params: BasicCommandParams<T>) => CommandPromise;

export type HandlerFinder<T> = (
  id: string,
  tree: CommandTree
) => Handler<T> | undefined;

export type BasicInteractionConfig<T> = {
  name: string;
  func: Handler<T>;
};

export type ButtonCommandConfig = BasicInteractionConfig<ButtonInteraction>;
export type RoleSelectMenuConfig =
  BasicInteractionConfig<RoleSelectMenuInteraction>;
export type StringSelectMenuConfig =
  BasicInteractionConfig<StringSelectMenuInteraction>;
export type ModalSubmitConfig = BasicInteractionConfig<ModalSubmitInteraction>;

export type OtherInteractionStyles = {
  button_commands: ButtonCommandConfig[];
  role_select_menu: RoleSelectMenuConfig[];
  string_select_menu: StringSelectMenuConfig[];
  modal_interaction: ModalSubmitConfig[];
};

export type ModalBuilderProps = {
  builder: ModalBuilder;
  interaction: ChatInputCommandInteraction;
};

export type AutoCompleteFunc = (
  params: AutoCompleteParams
) => Promise<ApplicationCommandOptionChoiceData[]>;

export type SlashCommandConfig = {
  config: (
    x: SlashCommandBuilder,
    guild_id: string
  ) =>
    | RESTPostAPIApplicationCommandsJSONBody
    | Promise<RESTPostAPIApplicationCommandsJSONBody>;
} & (
  | {
      func: Handler<ChatInputCommandInteraction>;
      autoComplete?: AutoCompleteFunc;
    }
  | ({
      modal_builder: (
        x: ModalBuilderProps
      ) => Promise<ModalBuilder> | ModalBuilder;
    } & { modal_interaction: [ModalSubmitConfig] })
) &
  Partial<OtherInteractionStyles>;

export type ContextMenuCommandConfig = {
  config: (
    x: ContextMenuCommandBuilder,
    guild_id: string
  ) =>
    | RESTPostAPIContextMenuApplicationCommandsJSONBody
    | Promise<RESTPostAPIContextMenuApplicationCommandsJSONBody>;
  func: Handler<ContextMenuCommandInteraction>;
};

export type Command =
  | {
      context_menu: ContextMenuCommandConfig;
    }
  | {
      help_text: string;
      slash_command: SlashCommandConfig;
    };

export function create_command(
  help_text: string,
  slash_command: SlashCommandConfig
): Command {
  return {
    help_text,
    slash_command,
  };
}
export function create_context_menu(
  context_menu: ContextMenuCommandConfig
): Command {
  return {
    context_menu,
  };
}

export function create_command_for_command_channel(
  help_text: string,
  slash_command: SlashCommandConfig
): Command {
  return create_command(help_text, slash_command);
}

export function create_moderator_command(
  help_text: string,
  slash_command: SlashCommandConfig
): Command {
  const oldConfig = slash_command.config;
  slash_command.config = (x, guild_id) =>
    oldConfig(
      x.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
      guild_id
    );

  return create_command(help_text, slash_command);
}
export type CommandWithName = {
  name: string;
  command: Command;
};

export type CommandTree = {
  group: string;
  commands: Array<CommandWithName | CommandTree>;
};

export async function get_commands_in(
  dir: string,
  group = ""
): Promise<CommandTree> {
  const files = await readdir(dir);
  console.log(files);
  const commands = await Promise.all(
    (
      await Promise.all(
        files
          .filter((file) => !file.startsWith("_"))
          .map(async (file) => {
            const full_path = path.join(dir, file);
            return {
              file: await lstat(full_path),
              name: file,
              path: full_path,
              parsed_path: path.parse(full_path),
            };
          })
      )
    )
      .filter(
        (x) =>
          x.file.isDirectory() ||
          (x.parsed_path.ext != ".sql" && x.parsed_path.ext != ".map")
      )
      .filter((x) => {
        if (x.file.isDirectory()) {
          return true;
        }
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return !!require(x.path).command;
      })
      .map(async (file) => {
        if (file.file.isDirectory()) {
          return get_commands_in(file.path, file.name);
        } else {
          return {
            name: path.parse(file.path).name,
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            command: require(file.path).command as Command,
          };
        }
      })
  );

  return {
    group,
    commands,
  };
}

export function find_command_with(
  tree: CommandTree,
  filter: (_: CommandWithName) => boolean
): Command | undefined {
  return find_command_and_map(tree, (x) => {
    if (filter(x)) {
      return { k: "some", v: x.command };
    }
    return { k: "none" };
  });
}

type FilterMapFunc<T> = (
  command: CommandWithName
) => { k: "none" } | { k: "some"; v: T };

export function find_command_and_map<T>(
  tree: CommandTree,
  filter_map: FilterMapFunc<T>
): T | undefined {
  for (const candidate of tree.commands) {
    if ("name" in candidate) {
      const res = filter_map(candidate);
      if (res.k == "some") {
        return res.v;
      }
    } else {
      const found = find_command_and_map(candidate, filter_map);
      if (found) {
        return found;
      }
    }
  }
}

export function find_command(
  command: string,
  tree: CommandTree
): Command | undefined {
  return find_command_with(
    tree,
    (candidate) =>
      candidate.name == command || candidate.name.toLowerCase() == command
  );
}

export type None = { k: "none" };
export type Option<T> =
  | None
  | {
      k: "some";
      v: T;
    };

const findItem = <
  T extends Partial<OtherInteractionStyles>[keyof OtherInteractionStyles]
>(
  id: string,
  searchingIn: T
): Option<NonNullable<T>[number]["func"]> => {
  if (searchingIn != undefined) {
    for (const iterator of searchingIn) {
      if (iterator.name == id) {
        return {
          k: "some",
          v: iterator.func,
        };
      }
    }
  }
  return { k: "none" } as const;
};

const makeFinder =
  <K extends keyof OtherInteractionStyles>(key: K) =>
  (to_find: string) =>
  (col: CommandWithName) => {
    if ("slash_command" in col.command) {
      const a = col.command.slash_command[key];

      return findItem(to_find, a);
    } else {
      return { k: "none" } as const;
    }
  };

const findAndExtractFunc =
  <K extends keyof OtherInteractionStyles>(key: K) =>
  (to_find: string, tree: CommandTree) =>
    find_command_and_map(tree, makeFinder(key)(to_find));

export const find_string_select_handler: HandlerFinder<StringSelectMenuInteraction> =
  findAndExtractFunc("string_select_menu");

export const find_role_select_handler: HandlerFinder<RoleSelectMenuInteraction> =
  findAndExtractFunc("role_select_menu");

export const find_button_handler: HandlerFinder<ButtonInteraction> =
  findAndExtractFunc("button_commands");

export const find_modal_handler: HandlerFinder<ModalSubmitInteraction> =
  findAndExtractFunc("modal_interaction");

export const find_context_menu_handler: HandlerFinder<
  ContextMenuCommandInteraction
> = (id: string, tree: CommandTree) => {
  const x = find_command_and_map(tree, (x) => {
    if (x.name == id && "context_menu" in x.command) {
      return { k: "some", v: x.command.context_menu.func };
    }
    return { k: "none" };
  });
  return x;
};

export function find_something(
  command: string,
  tree: CommandTree
): Command | CommandTree | undefined {
  for (const candidate of tree.commands) {
    console.log(candidate);
    if ("name" in candidate) {
      if (candidate.name == command) {
        return candidate.command;
      }
    } else if (candidate.group == command) {
      return candidate;
    } else {
      const result = find_something(command, candidate);
      if (result) {
        return result;
      }
    }
  }
}

export function drill_until_found_something(
  needles: string[],
  tree: CommandTree
): CommandTree | Command | undefined {
  let working_with = tree;
  for (const needle of needles) {
    let found = false;
    for (const candidate of working_with.commands) {
      if ("name" in candidate) {
        if (candidate.name == needle) {
          return candidate.command;
        }
      } else {
        console.log(candidate.group, candidate.group == needle);
        if (candidate.group == needle) {
          working_with = candidate;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return;
    }
  }
  return working_with;
}

export async function find_every_slash_command_config(
  tree: CommandTree,
  guild_id: string
): Promise<Array<RESTPostAPIApplicationCommandsJSONBody>> {
  let results: Array<RESTPostAPIApplicationCommandsJSONBody> = [];
  for (const candidate of tree.commands) {
    if ("name" in candidate) {
      const name = candidate.name.toLowerCase();
      if (
        "slash_command" in candidate.command &&
        candidate.command.slash_command
      ) {
        const description = candidate.command.help_text;
        const builder = new SlashCommandBuilder()
          .setName(name)
          .setDescription(description);
        results.push(
          await candidate.command.slash_command.config(builder, guild_id)
        );
      } else if ("context_menu" in candidate.command) {
        const builder = new ContextMenuCommandBuilder().setName(name);
        results.push(
          await candidate.command.context_menu.config(builder, guild_id)
        );
      }
    } else {
      const result = await find_every_slash_command_config(candidate, guild_id);
      results = results.concat(result);
    }
  }
  return results;
}

export async function register_commands_for(
  client: Client,
  guild: string,
  rest: REST
): Promise<void> {
  const foundCommands = await get_commands_in(path.join(__dirname, "commands"));
  const slashCommands = await find_every_slash_command_config(
    foundCommands,
    guild
  );
  const commands = slashCommands.concat(
    new SlashCommandBuilder()
      .setName("help")
      .setDescription("shows help text")
      .addStringOption((x) =>
        x.setName("search").setDescription("What command/group to search for")
      )
      .toJSON()
  );
  if (!client.user) {
    throw new Error("No user for the given client. Maybe not logged in?");
  }
  await rest.put(Routes.applicationGuildCommands(client.user?.id, guild), {
    body: commands,
  });
}
