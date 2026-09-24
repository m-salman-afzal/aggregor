// // import

// // // import {AcpSpawnService} from "./services/acpSpawn.service.ts";

// // const activate = (ctx: vsc.ExtensionContext) => {
// //   const log = vsc.window.createOutputChannel("Aggregor", {log: true});
// //   ctx.subscriptions.push(log);

// //   const handler: vsc.ChatRequestHandler = async (
// //     request: vsc.ChatRequest,
// //     context: vsc.ChatContext,
// //     stream: vsc.ChatResponseStream,
// //     token: vsc.CancellationToken
// //     // eslint-disable-next-line @typescript-eslint/max-params
// //   ) => {
// //     // const acpSpawnService = new AcpSpawnService(log, stream);
// //     // await acpSpawnService.start();
// //   };

// //   const tutor = vsc.chat.createChatParticipant("aggregor.cursor", handler);

// //   tutor.iconPath = vsc.Uri.joinPath(ctx.extensionUri, "./assets/agents/cursorIcon.jpg");
// // };

// // const deactivate = () => {
// //   /* Empty */
// // };

// // export {activate, deactivate};

// import * as vscode from "vscode";

// type WebviewMessage =
//   | {
//       payload: {
//         format: string;
//         notes: string;
//         projectName: string;
//       };
//       type: "saveSettings";
//     }
//   | {
//       payload: {
//         message: string;
//       };
//       type: "showInfo";
//     };

// export const activate = (context: vscode.ExtensionContext) => {
//   const log = vscode.window.createOutputChannel("Aggregor", {log: true});
//   context.subscriptions.push(log);

//   const disposable = vscode.commands.registerCommand("react-webview-vite.openPanel", () => {
//     const panel = vscode.window.createWebviewPanel("reactWebviewVite", "React Webview", vscode.ViewColumn.One, {
//       enableScripts: true,
//       localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "..", "webview", "dist")]
//     });

//     log.info(`context.extensionUri`, JSON.stringify(context.extensionUri, null, 2));
//     log.info(`context.extension`, JSON.stringify(context.extension, null, 2));
//     log.info(`context.extensionMode`, JSON.stringify(context.extensionMode, null, 2));
//     log.info(`context.extensionPath`, JSON.stringify(context.extensionPath, null, 2));
//     panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri, log);

//     panel.webview.onDidReceiveMessage(
//       async (message: WebviewMessage) => {
//         switch (message.type) {
//           case "saveSettings": {
//             await context.globalState.update("reactWebviewVite.settings", message.payload);

//             vscode.window.showInformationMessage(`Saved settings for ${message.payload.projectName}`);

//             panel.webview.postMessage({
//               payload: {
//                 savedAt: new Date().toLocaleTimeString()
//               },
//               type: "settingsSaved"
//             });

//             break;
//           }

//           case "showInfo": {
//             vscode.window.showInformationMessage(message.payload.message);

//             panel.webview.postMessage({
//               payload: {
//                 message: "VS Code received the message and showed a notification."
//               },
//               type: "fromExtension"
//             });

//             break;
//           }
//           default:
//             break;
//         }
//       },
//       undefined,
//       context.subscriptions
//     );
//   });

//   context.subscriptions.push(disposable);
// };

// export const deactivate = () => {};

// const getNonce = () => {
//   let text = "";
//   const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

//   for (let i = 0; i < 32; i++) {
//     text += possible.charAt(Math.floor(Math.random() * possible.length));
//   }

//   return text;
// };

// const getWebviewHtml = (webview: vscode.Webview, extensionUri: vscode.Uri, log: vscode.LogOutputChannel) => {
//   const scriptUri = webview.asWebviewUri(
//     vscode.Uri.joinPath(extensionUri, "..", "webview", "dist", "assets", "index.js")
//   );

//   log.info("scriptUri", scriptUri);
//   const styleUri = webview.asWebviewUri(
//     vscode.Uri.joinPath(extensionUri, "..", "webview", "dist", "assets", "index.css")
//   );

//   const nonce = getNonce();

//   return `
//     <!DOCTYPE html>
//     <html lang="en">
//       <head>
//         <meta charset="UTF-8" />
//         <meta name="viewport" content="width=device-width, initial-scale=1.0" />

//         <meta
//           http-equiv="Content-Security-Policy"
//           content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
//         />

//         <link rel="stylesheet" href="${styleUri}" />
//         <title>React Webview</title>
//       </head>
//       <body>
//         <div id="root"></div>
//         <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
//       </body>
//     </html>
//   `;
// };
