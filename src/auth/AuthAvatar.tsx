/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, DropdownMenu, IconButton, Tooltip } from "@radix-ui/themes";
import cn from "classnames";
import styles from "./AuthAvatar.module.scss";
import { useAuthContext } from "./AuthProvider";
import { Avatar } from "./Avatar";

export function AuthAvatar({ className }: { className?: string }) {
  const { user, signOut, signIn } = useAuthContext();
  if (!user) {
    return <Button onClick={() => signIn()}>Sign in</Button>;
  }

  return (
    <DropdownMenu.Root>
      <Tooltip content={user.displayName}>
        <DropdownMenu.Trigger className={cn(styles.avatarButton, className)}>
          <IconButton variant="ghost" color="gray" radius="full">
            <Avatar
              className={styles.avatar}
              src={user.photoURL}
              displayName={user.displayName}
            />
          </IconButton>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Content>
        <DropdownMenu.Item className="is-secondary" onClick={() => signOut()}>
          Sign out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
