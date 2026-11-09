import {IDesktopNotificationInfraService} from "@interfaces/desktopNotification.infraService.interface.ts";
import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {Array, Config, Effect, Layer, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";
import {Buffer} from "node:buffer";
import {platform, release} from "node:os";

import type {DesktopNotificationRequest} from "@interfaces/desktopNotification.infraService.interface.ts";

// The Windows app id PowerShell's own toasts go out under, which needs no registration.
const POWERSHELL_APP_ID = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe";

// The texts arrive as osascript's arguments, so no quote in them reaches the script.
const OSASCRIPT_NOTIFICATION_LINES = [
  "on run argv",
  "display notification (item 2 of argv) with title (item 1 of argv)",
  "end run"
];

const DESKTOP_FILE_EXTENSION = /\.desktop$/u;

// VS Code's desktop file, as Electron names it for its processes (com.microsoft.VSCode.desktop), so GNOME files the
// notification under VS Code; a click then brings VS Code's most recently used window forward. Without it, GNOME shows
// Aggregor's name and logo and a click brings nothing forward.
const makeVsCodeDesktopEntryHint = Effect.fn("DesktopNotificationInfraService.makeVsCodeDesktopEntryHint")(
  function* () {
    const vsCodeDesktopFile = yield* Config.withDefault(Config.String("CHROME_DESKTOP"), "");
    const vsCodeDesktopEntry = String.replace(DESKTOP_FILE_EXTENSION, "")(vsCodeDesktopFile);

    return vsCodeDesktopEntry === "" ? [] : ["--hint", `string:desktop-entry:${vsCodeDesktopEntry}`];
  },
  Effect.orDie
);

// The agent's logo shows in the notification's body, and Aggregor's in its header when GNOME doesn't know the sender is
// VS Code. A button can't bring VS Code forward, only a click on the notification itself can, so there is none.
const makeNotifySendArguments = Effect.fn("DesktopNotificationInfraService.makeNotifySendArguments")(function* ({
  agentIconPath,
  aggregorIconPath,
  headline,
  message
}: DesktopNotificationRequest) {
  return [
    ...["--app-name", APP_NAME, "--app-icon", aggregorIconPath, "--wait"],
    ...(yield* makeVsCodeDesktopEntryHint()),
    ...(agentIconPath === undefined ? [] : ["--hint", `string:image-path:${agentIconPath}`]),
    ...["--", headline, message]
  ];
});

// libnotify sends a snap's or flatpak's notifications through the desktop portal, which drops what this one carries, and
// the extension host can inherit a snap terminal's environment, so the portal is turned off. notify-send has to wait
// until the notification closes: GNOME deletes a notification filed under an app as soon as its sender leaves.
const notifyWithNotifySend = Effect.fn("DesktopNotificationInfraService.notifyWithNotifySend")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  desktopNotificationRequest: DesktopNotificationRequest
) {
  const notifySendArguments = yield* makeNotifySendArguments(desktopNotificationRequest);

  yield* childProcessSpawner.exitCode(
    ChildProcess.make("notify-send", notifySendArguments, {env: {NOTIFY_IGNORE_PORTAL: "1"}, extendEnv: true})
  );
});

// osascript's notifications can't carry a button, so this one only tells.
const notifyWithOsascript = Effect.fn("DesktopNotificationInfraService.notifyWithOsascript")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  {headline, message}: DesktopNotificationRequest
) {
  const scriptArguments = Array.flatMap(OSASCRIPT_NOTIFICATION_LINES, (scriptLine) => ["-e", scriptLine]);

  yield* childProcessSpawner.exitCode(ChildProcess.make("osascript", [...scriptArguments, headline, message]));
});

// A toast whose click opens the link through Windows, whose VS Code hands it to the WSL window. The texts travel as
// base64, so no quote in them can break the script.
const makeWindowsToastScript = Effect.fn("DesktopNotificationInfraService.makeWindowsToastScript")(function* ({
  headline,
  message,
  openLink
}: DesktopNotificationRequest) {
  const [encodedHeadline, encodedMessage, encodedLink] = Array.map([headline, message, openLink], (text) =>
    Buffer.from(text, "utf8").toString("base64")
  );

  return Array.join(
    [
      "function Read-Text($encoded) { [Security.SecurityElement]::Escape([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))) }",
      `$headline = Read-Text '${encodedHeadline}'`,
      `$message = Read-Text '${encodedMessage}'`,
      `$link = Read-Text '${encodedLink}'`,
      "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
      "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null",
      "$toastXml = New-Object Windows.Data.Xml.Dom.XmlDocument",
      '$toastXml.LoadXml("<toast activationType=`"protocol`" launch=`"$link`"><visual><binding template=`"ToastGeneric`"><text>$headline</text><text>$message</text></binding></visual></toast>")',
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${POWERSHELL_APP_ID}').Show([Windows.UI.Notifications.ToastNotification]::new($toastXml))`
    ],
    "\n"
  );
});

// PowerShell takes the script as base64 UTF-16, so nothing in it passes through a Windows command line.
const notifyWithWindowsToast = Effect.fn("DesktopNotificationInfraService.notifyWithWindowsToast")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  desktopNotificationRequest: DesktopNotificationRequest
) {
  const toastScript = yield* makeWindowsToastScript(desktopNotificationRequest);
  const encodedToastScript = Buffer.from(toastScript, "utf16le").toString("base64");

  yield* childProcessSpawner.exitCode(
    ChildProcess.make("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedToastScript])
  );
});

// WSL's kernel names itself, as in 6.6.87.2-microsoft-standard-WSL2. Windows itself runs no sessions, so it notifies
// only inside VS Code.
const findSystemNotifier = Effect.fn("DesktopNotificationInfraService.findSystemNotifier")(function* () {
  if (platform() === "darwin") return notifyWithOsascript;
  if (platform() !== "linux") return undefined;

  return String.includes("microsoft")(String.toLowerCase(release())) ? notifyWithWindowsToast : notifyWithNotifySend;
});

// A system that can't show it logs why.
const notifyOnDesktop = Effect.fn("DesktopNotificationInfraService.notifyOnDesktop")(
  function* (
    childProcessSpawner: ChildProcessSpawner["Service"],
    desktopNotificationRequest: DesktopNotificationRequest
  ) {
    const systemNotifier = yield* findSystemNotifier();
    if (systemNotifier === undefined) return;

    yield* systemNotifier(childProcessSpawner, desktopNotificationRequest);
  },
  Effect.catch((notifyError) => Effect.logWarning("Could not show a desktop notification", notifyError))
);

const makeDesktopNotificationInfraService = Effect.fn("DesktopNotificationInfraService.make")(function* () {
  const childProcessSpawner = yield* ChildProcessSpawner;

  return {
    notifyOnDesktop: (desktopNotificationRequest: DesktopNotificationRequest) =>
      notifyOnDesktop(childProcessSpawner, desktopNotificationRequest)
  };
});

export const DesktopNotificationInfraService = Layer.effect(
  IDesktopNotificationInfraService,
  makeDesktopNotificationInfraService()
);
