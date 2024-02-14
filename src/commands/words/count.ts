import {
  ChannelType,
  Interaction,
  InteractionResponse,
  Message,
  PrivateThreadChannel,
  PublicThreadChannel,
  ThreadChannel,
  messageLink,
} from "discord.js";
import { create_command } from "../../command";
import CliTable3 from "cli-table3";

export const command = create_command(
  "Count all words, grouped by all members inside a thread",
  {
    config: (x) =>
      x
        .addChannelOption((y) =>
          y
            .setName("thread")
            .setDescription("The thread to count")
            .setRequired(true)
            .addChannelTypes(
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
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
      const responses = await fetchAll<{ [key: string]: number }>(
        thread,
        {},
        (state, x) => {
          const toIndex = x.author.globalName || x.author.displayName;
          const currentCount = state[toIndex] ?? 0;
          const wordCount = countWords(x.content);
          state[toIndex] = currentCount + wordCount;
          return state;
        },
        res
      );
      if (!responses.lastMessage) {
        await res.edit("No messages in thread");
        return;
      }
      const table = new CliTable3({
        head: ["Username", "count"],
        style: {
          head: [],
          border: [],
        },
      });
      Object.keys(responses.state).forEach((key) => {
        const amount = responses.state[key];
        table.push([key, amount]);
      });
      const returnMessage =
        "```\n" +
        table.toString() +
        "\n```\n\nLast message:" +
        messageLink(responses.lastMessage.channelId, responses.lastMessage.id);
      await res.edit({ content: returnMessage });
    },
  }
);

function countWords(s: string) {
  s = s.replace(/(^\s*)|(\s*$)/gi, ""); //exclude  start and end white-space
  s = s.replace(/[ ]{2,}/gi, " "); //2 or more space to 1
  s = s.replace(/\n /, "\n"); // exclude newline with a start spacing
  return s.split(" ").filter(function (str) {
    return str != "";
  }).length;
}

async function fetchAll<T>(
  thread: PrivateThreadChannel | PublicThreadChannel<boolean>,
  startState: T,
  func: (state: T, message: Message) => T,
  interaction: InteractionResponse<boolean>
): Promise<{ state: T; lastMessage: Message | undefined }> {
  let lastProcessedMessage: Message<true> | undefined = undefined;
  let totalMessageCount = 0;
  while (true) {
    let messages;
    if (lastProcessedMessage) {
      messages = await thread.messages.fetch({
        cache: false,
        before: lastProcessedMessage.id,
      });
    } else {
      messages = await thread.messages.fetch({ cache: false });
    }
    messages.forEach((message) => {
      startState = func(startState, message);
    });

    const lastInBatch: Message<true> | undefined = messages.last();

    if (!lastInBatch) {
      return {
        state: startState,
        lastMessage: lastProcessedMessage,
      };
    }
    lastProcessedMessage = lastInBatch;
    totalMessageCount += messages.size;
    interaction.edit(
      "Processing.\nProcessed " + totalMessageCount + " messages so far."
    );
    await new Promise<void>((res) => setTimeout(() => res(), 40));
  }
}
