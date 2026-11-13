import {IDesktopNotificationInfraService} from "@interfaces/desktopNotification.infraService.interface.ts";
import {APP_NAME} from "@pkg/constants/src/app.constant.ts";
import {PLATFORMS, WSL_KERNEL_RELEASE_MARKER} from "@pkg/constants/src/process.constant.ts";
import {DESKTOP_NOTIFIERS} from "@pkg/constants/src/sessionAlert.constant.ts";
import {Array, Config, Effect, Layer, String} from "effect";
import {ChildProcess} from "effect/process";
import {ChildProcessSpawner} from "effect/process/ChildProcessSpawner";
import {Buffer} from "node:buffer";
import {platform, release} from "node:os";

import type {DesktopNotificationRequest} from "@interfaces/desktopNotification.infraService.interface.ts";

// Without VS Code's desktop file, GNOME shows Aggregor's name and logo and a click brings nothing forward.
const makeVsCodeDesktopEntryHint = Effect.fn("DesktopNotificationInfraService.makeVsCodeDesktopEntryHint")(
  function* () {
    const vsCodeDesktopFile = yield* Config.withDefault(
      Config.String(DESKTOP_NOTIFIERS.NOTIFY_SEND.DESKTOP_FILE_ENV),
      ""
    );
    const vsCodeDesktopEntry = String.replace(
      DESKTOP_NOTIFIERS.NOTIFY_SEND.DESKTOP_FILE_EXTENSION,
      ""
    )(vsCodeDesktopFile);

    return vsCodeDesktopEntry === "" ? [] : ["--hint", `string:desktop-entry:${vsCodeDesktopEntry}`];
  },
  Effect.orDie
);

// The agent's logo shows in the notification's body, and Aggregor's in its header when GNOME doesn't know the sender is
// VS Code. A button can't bring VS Code forward, only a click on the notification itself can, so there is none.
const makeNotifySendArguments = Effect.fn("DesktopNotificationInfraService.makeNotifySendArguments")(function* (
  desktopNotificationRequest: DesktopNotificationRequest
) {
  return [
    ...["--app-name", APP_NAME, "--app-icon", desktopNotificationRequest.aggregorIconPath, "--wait"],
    ...(yield* makeVsCodeDesktopEntryHint()),
    ...(desktopNotificationRequest.agentIconPath === undefined
      ? []
      : ["--hint", `string:image-path:${desktopNotificationRequest.agentIconPath}`]),
    ...["--", desktopNotificationRequest.headline, desktopNotificationRequest.message]
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
    ChildProcess.make(DESKTOP_NOTIFIERS.NOTIFY_SEND.COMMAND, notifySendArguments, {
      env: {[DESKTOP_NOTIFIERS.NOTIFY_SEND.IGNORE_PORTAL_ENV]: "1"},
      extendEnv: true
    })
  );
});

// osascript's notifications can't carry a button, so this one only tells.
const notifyWithOsascript = Effect.fn("DesktopNotificationInfraService.notifyWithOsascript")(function* (
  childProcessSpawner: ChildProcessSpawner["Service"],
  desktopNotificationRequest: DesktopNotificationRequest
) {
  const scriptArguments = Array.flatMap(DESKTOP_NOTIFIERS.OSASCRIPT.SCRIPT_LINES, (scriptLine) => ["-e", scriptLine]);

  yield* childProcessSpawner.exitCode(
    ChildProcess.make(DESKTOP_NOTIFIERS.OSASCRIPT.COMMAND, [
      ...scriptArguments,
      desktopNotificationRequest.headline,
      desktopNotificationRequest.message
    ])
  );
});

// A toast whose click opens the link through Windows, whose VS Code hands it to the WSL window. The texts travel as
// base64, so no quote in them can break the script.
const makeWindowsToastScript = Effect.fn("DesktopNotificationInfraService.makeWindowsToastScript")(function* (
  desktopNotificationRequest: DesktopNotificationRequest
) {
  const [encodedHeadline, encodedMessage, encodedLink] = Array.map(
    [desktopNotificationRequest.headline, desktopNotificationRequest.message, desktopNotificationRequest.openLink],
    (text) => Buffer.from(text, "utf8").toString("base64")
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
      `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${DESKTOP_NOTIFIERS.POWERSHELL.APP_ID}').Show([Windows.UI.Notifications.ToastNotification]::new($toastXml))`
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
    ChildProcess.make(DESKTOP_NOTIFIERS.POWERSHELL.COMMAND, [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodedToastScript
    ])
  );
});

// Windows itself runs no sessions, so it notifies only inside VS Code.
const findSystemNotifier = Effect.fn("DesktopNotificationInfraService.findSystemNotifier")(function* () {
  if (platform() === PLATFORMS.MACOS) return notifyWithOsascript;
  if (platform() !== PLATFORMS.LINUX) return undefined;

  return String.includes(WSL_KERNEL_RELEASE_MARKER)(String.toLowerCase(release()))
    ? notifyWithWindowsToast
    : notifyWithNotifySend;
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
