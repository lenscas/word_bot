import { ChannelType, ThreadChannel, messageLink } from "discord.js";
import { create_command } from "../../command";
import CliTable3 from "cli-table3";

export const command = create_command("basic test comand", {
  config: (x) =>
    x
      .addChannelOption((y) =>
        y
          .setName("thread")
          .setDescription("The thread to count")
          .setRequired(true)
          .addChannelTypes(ChannelType.PublicThread, ChannelType.PrivateThread)
      )
      .toJSON(),
  func: async ({ interaction }) => {
    const res = await interaction.deferReply();
    const thread = interaction.options.getChannel("thread");
    if (!thread) {
      return "I need a channel to work with";
    }
    if (!(thread instanceof ThreadChannel)) {
      return "I can only count words in threads";
    }
    const messages = await thread.messages.fetch();
    if (messages.size == 0) {
      return "No messages in thread";
    }
    const responses: { [key: string]: number } = {};
    messages.each((x) => {
      const toIndex = x.author.globalName || x.author.displayName;
      const currentCount = responses[toIndex] ?? 0;
      const wordCount = countWords(x.content);
      responses[toIndex] = currentCount + wordCount;
    });
    const table = new CliTable3({
      head: ["Username", "count"],
      style: {
        head: [],
        border: [],
      },
    });
    Object.keys(responses).forEach((key) => {
      const amount = responses[key];
      table.push([key, amount]);
    });
    const lastMessage = messages.last();
    if (!lastMessage) {
      return "No last message while there are supposedly last messages?\n This is a bug!";
    }
    const returnMessage =
      "```\n" +
      table.toString() +
      "\n```\n\nLast message:" +
      messageLink(lastMessage?.channelId, lastMessage?.id);
    return { content: returnMessage };
  },
});

function countWords(s: string) {
  s = s.replace(/(^\s*)|(\s*$)/gi, ""); //exclude  start and end white-space
  s = s.replace(/[ ]{2,}/gi, " "); //2 or more space to 1
  s = s.replace(/\n /, "\n"); // exclude newline with a start spacing
  return s.split(" ").filter(function (str) {
    return str != "";
  }).length;
}
