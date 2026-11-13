import {UserInputBody} from "@/modules/sessions/components/userInputDialog/components/userInputBody.tsx";
import {UserInputHeader} from "@/modules/sessions/components/userInputDialog/components/userInputHeader.tsx";
import {useUserInputDialog} from "@/modules/sessions/components/userInputDialog/userInputDialog.hook.ts";
import {Dialog, DialogContent} from "@pkg/ui/src/components/base/dialog.tsx";

export const UserInputDialog = () => {
  const userInputDialogView = useUserInputDialog();

  return (
    <Dialog onOpenChange={userInputDialogView.closeOnDismiss} open={userInputDialogView.userInput !== undefined}>
      <DialogContent showCloseButton={false}>
        <UserInputHeader
          Icon={userInputDialogView.UserInputIcon}
          isDestructive={userInputDialogView.isDestructive}
          title={userInputDialogView.userInput?.title}
        />
        {userInputDialogView.userInput !== undefined && (
          <UserInputBody
            onCancel={userInputDialogView.cancel}
            onChoose={userInputDialogView.choose}
            onEnterText={userInputDialogView.enterText}
            userInput={userInputDialogView.userInput}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
