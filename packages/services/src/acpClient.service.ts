// import readline from "node:readline/promises";

// import {SESSION_UPDATE_CONTENT_TYPES, SESSION_UPDATE_TYPES} from "../../constants/src/stream.constant.ts";

// import type * as Acp from "@agentclientprotocol/sdk"; import type * as vscode from "vscode";

// export class AcpClientService implements Acp.Client {
//   readonly #log: vscode.LogOutputChannel;
//   readonly #stream: vscode.ChatResponseStream;

//   constructor(log: vscode.LogOutputChannel, stream: vscode.ChatResponseStream) {
//     this.#log = log;
//     this.#stream = stream;
//   }

//   async readTextFile(parameters: Acp.ReadTextFileRequest): Promise<Acp.ReadTextFileResponse> {
//     this.#log.info("[Client] Read text file called with:", JSON.stringify(parameters, null, 2));

//     return {
//       content: "Mock file content"
//     };
//   }

//   async requestPermission(parameters: Acp.RequestPermissionRequest): Promise<Acp.RequestPermissionResponse> {
//     this.#log.debug(`\n\n-----${JSON.stringify(parameters, null, 2)}\n\n`);

//     this.#log.info(`\n🔐 Permission requested: ${parameters.toolCall.title}`);

//     this.#log.info(`\nOptions:`);
//     for (const [index, option] of parameters.options.entries()) {
//       this.#log.info(`   ${index + 1}. ${option.name} (${option.kind})`);
//     }

//     while (true) {
//       const rl = readline.createInterface({
//         input: process.stdin,
//         output: process.stdout
//       });

//       const answer = await rl.question("\nChoose an option: ");
//       const trimmedAnswer = answer.trim();

//       const optionIndex = Number(trimmedAnswer) - 1;
//       if (optionIndex >= 0 && optionIndex < parameters.options.length && parameters.options[optionIndex]) {
//         return {
//           outcome: {
//             optionId: parameters.options[optionIndex].optionId,
//             outcome: "selected"
//           }
//         };
//       }
//       this.#log.info("Invalid option. Please try again.");
//     }
//   }

//   async sessionUpdate(parameters: Acp.SessionNotification): Promise<void> {
//     this.#log.debug(`\n\n-----${JSON.stringify(parameters, null, 2)}\n\n`);

//     const {update} = parameters;

//     switch (update.sessionUpdate) {
//       case SESSION_UPDATE_TYPES.AGENT_MESSAGE_CHUNK: {
//         if (update.content.type === SESSION_UPDATE_CONTENT_TYPES.TEXT) {
//           this.#log.info(update.content.text);
//           this.#stream.markdown(update.content.text);
//         } else {
//           this.#log.info(`[${update.content.type}]`);
//         }
//         break;
//       }
//       case SESSION_UPDATE_TYPES.AGENT_THOUGHT_CHUNK:
//       case SESSION_UPDATE_TYPES.PLAN:
//       case SESSION_UPDATE_TYPES.USER_MESSAGE_CHUNK: {
//         this.#log.info(`[${update.sessionUpdate}]`);
//         break;
//       }
//       case SESSION_UPDATE_TYPES.TOOL_CALL: {
//         this.#log.info(`\n🔧 ${update.title} (${update.status})`);
//         break;
//       }
//       case SESSION_UPDATE_TYPES.TOOL_CALL_UPDATE: {
//         this.#log.info(`\n🔧 Tool call \`${update.toolCallId}\` updated: ${update.status}\n`);
//         break;
//       }
//       default: {
//         break;
//       }
//     }
//   }

//   async writeTextFile(parameters: Acp.WriteTextFileRequest): Promise<Acp.WriteTextFileResponse> {
//     this.#log.info("[Client] Write text file called with:", JSON.stringify(parameters, null, 2));

//     return {};
//   }
// }
