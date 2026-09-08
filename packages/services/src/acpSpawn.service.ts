// import * as Acp from "@agentclientprotocol/sdk";
// import {spawn} from "node:child_process";
// import {Readable, Writable} from "node:stream";

// import {APP_NAME} from "../../constants/src/extension.constant.ts";
// import {MESSAGE_KINDS} from "../../constants/src/stream.constant.ts";
// import {AcpClientService} from "./acpClient.service.ts";

// import type * as vscode from "vscode";

// export class AcpSpawnService {
//   readonly #log: vscode.LogOutputChannel;
//   readonly #stream: vscode.ChatResponseStream;

//   constructor(log: vscode.LogOutputChannel, stream: vscode.ChatResponseStream) {
//     this.#log = log;
//     this.#stream = stream;
//   }

//   async start() {
//     const agentProcess = spawn("agent", ["acp"], {stdio: ["pipe", "pipe", "inherit"]});

//     const inputStream = Writable.toWeb(agentProcess.stdin);
//     const outputStream = Readable.toWeb(agentProcess.stdout) as ReadableStream<Uint8Array>;
//     const stream = Acp.ndJsonStream(inputStream, outputStream);

//     const acpClientService = new AcpClientService(this.#log, this.#stream);

//     try {
//       const promptResult = await Acp.client({name: APP_NAME})
//         .onRequest(Acp.methods.client.session.requestPermission, async (context) =>
//           acpClientService.requestPermission(context.params)
//         )
//         .onRequest(Acp.methods.client.fs.readTextFile, async (context) => acpClientService.readTextFile(context.params))
//         .onRequest(Acp.methods.client.fs.writeTextFile, async (context) =>
//           acpClientService.writeTextFile(context.params)
//         )
//         .connectWith(stream, async (context) => {
//           const initResult = await context.request(Acp.methods.agent.initialize, {
//             clientCapabilities: {
//               fs: {readTextFile: true, writeTextFile: true}
//             },
//             protocolVersion: Acp.PROTOCOL_VERSION
//           });

//           this.#log.info(
//             `✅ Connected to agent (protocol v${initResult.protocolVersion})`,
//             JSON.stringify(initResult, null, 2)
//           );

//           const builtSession = context.buildSession(process.cwd()).withSession(async (session) => {
//             this.#log.info(`📝 Created session: ${session.sessionId}`);
//             this.#log.info(`💬 User: Hello, agent!\n`);
//             process.stdout.write(" ");

//             session.prompt("What is in this repository? think deeply about it!");

//             while (true) {
//               const message = await session.nextUpdate();
//               if (message.kind === MESSAGE_KINDS.STOP) {
//                 this.#log.info("Message Stopped:", JSON.stringify(message, null, 2));

//                 return message;
//               }

//               this.#log.info("Message Event: ", JSON.stringify(message, null, 1));

//               await acpClientService.sessionUpdate(message.notification);
//             }
//           });

//           return builtSession;
//         });
//     } catch (error) {
//       this.#log.error("Client Error:", error);
//     } finally {
//       agentProcess.kill();
//       process.exit(0);
//     }
//   }
// }
