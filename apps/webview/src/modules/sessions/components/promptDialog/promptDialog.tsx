import {PromptBody} from "@/modules/sessions/components/promptDialog/components/promptBody.tsx";
import {PromptHeader} from "@/modules/sessions/components/promptDialog/components/promptHeader.tsx";
import {usePromptDialog} from "@/modules/sessions/components/promptDialog/promptDialog.hook.ts";
import {Dialog, DialogContent} from "@pkg/ui/src/components/base/dialog.tsx";

export const PromptDialog = () => {
  const promptDialogView = usePromptDialog();

  return (
    <Dialog onOpenChange={promptDialogView.closeOnDismiss} open={promptDialogView.prompt !== undefined}>
      <DialogContent showCloseButton={false}>
        <PromptHeader
          Icon={promptDialogView.PromptIcon}
          isDestructive={promptDialogView.isDestructive}
          title={promptDialogView.prompt?.title}
        />
        {promptDialogView.prompt !== undefined && (
          <PromptBody
            onCancel={promptDialogView.cancel}
            onChoose={promptDialogView.choose}
            onEnterText={promptDialogView.enterText}
            prompt={promptDialogView.prompt}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
