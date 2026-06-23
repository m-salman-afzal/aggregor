import {inspect} from "node:util";
import * as vsc from "vscode";

const activate = (ctx: vsc.ExtensionContext) => {
  // ponytail: route console.* to an Output channel so logs show in the Output panel, not just the Debug Console
  const log = vsc.window.createOutputChannel("Yamac", {log: true});
  ctx.subscriptions.push(log);

  // define a chat handler
  const handler: vsc.ChatRequestHandler = async (
    request: vsc.ChatRequest,
    context: vsc.ChatContext,
    stream: vsc.ChatResponseStream,
    token: vsc.CancellationToken
    // eslint-disable-next-line @typescript-eslint/max-params
  ) => {
    // initialize the messages array with the prompt
    const messages = [vsc.LanguageModelChatMessage.User("")];

    // get all the previous participant messages
    const previousMessages = context.history.filter((hist) => hist instanceof vsc.ChatResponseTurn);

    // add the previous messages to the messages array
    previousMessages.forEach((previousMessage) => {
      let fullMessage = "";
      previousMessage.response.forEach((response) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const mdPart = response as vsc.ChatResponseMarkdownPart;
        fullMessage += mdPart.value.value;
      });
      messages.push(vsc.LanguageModelChatMessage.Assistant(fullMessage));
    });

    // add in the user's message
    messages.push(vsc.LanguageModelChatMessage.User(request.prompt));

    // send the request
    const chatResponse = await request.model.sendRequest(messages, {}, token);

    // stream the response
    for await (const fragment of chatResponse.text) {
      log.info(inspect({fragment}));
      stream.markdown(fragment);
    }

    // consume stream
    for await (const chunk of chatResponse.stream) {
      if (chunk instanceof vsc.LanguageModelTextPart) {
        console.log("TEXT", chunk);
        log.info("TEXT", inspect(chunk));
      } else if (chunk instanceof vsc.LanguageModelToolCallPart) {
        console.log("TOOL CALL", chunk);
        log.info("TOOL CALL", inspect(chunk));
      }
    }
  };

  // create participant
  const tutor = vsc.chat.createChatParticipant("chat-tutorial.code-tutor", handler);

  // add icon to participant
  tutor.iconPath = vsc.Uri.joinPath(ctx.extensionUri, "tutor.jpeg");
};

const deactivate = () => {
  /* Empty */
};

export {activate, deactivate};
