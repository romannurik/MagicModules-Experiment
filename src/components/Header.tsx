/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthAvatar } from "@/auth/AuthAvatar";
import { useAuthContext } from "@/auth/AuthProvider";
import { Command } from "@/commands/CommandProvider";
import { useDocumentContext } from "@/document/DocumentProvider";
import {
  APP_ROOT_PATH,
  AppUserInfo,
  UNTITLED_DOC_TITLE,
  USERINFO_ROOT_PATH,
} from "@/document/model-and-db";
import { db } from "@/firebase";
import {
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Popover,
  Separator,
  Text,
  TextField,
} from "@radix-ui/themes";
import { onValue, ref } from "firebase/database";
import {
  ChevronDownIcon,
  CopyIcon,
  LinkIcon,
  PlusIcon,
  Share2Icon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./Header.module.scss";
import { InlineTextEdit } from "./InlineTextEdit";
import { Logo } from "./Logo";
import { SendFeedbackButton } from "./SendFeedbackButton";
import { SettingsButton } from "./SettingsButton";
import { useToast } from "./Toast";

export function Header() {
  const { user } = useAuthContext();
  const [appUserInfo, setAppUserInfo] = useState<AppUserInfo>({ docs: {} });
  const { docId, fork, metadata, updateMetadata, deleteDocument } =
    useDocumentContext();
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;
    let unsub = onValue(
      ref(db, `${USERINFO_ROOT_PATH}/${user.uid}`),
      (snapshot) => {
        const appUserInfo = (snapshot.val() || { docs: {} }) as AppUserInfo;
        setAppUserInfo(appUserInfo);
      },
    );
    return () => unsub();
  }, [user]);

  const { title } = metadata || {};

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <DropdownMenu.Root>
          <Command label="Open menu" keyName="." sendEnterKey>
            <DropdownMenu.Trigger>
              <IconButton
                className={styles.logoButton}
                variant="ghost"
                radius="full"
                color="gray"
              >
                <Logo className={styles.logo} size={28} />
                <ChevronDownIcon className={styles.logoMenuIcon} />
              </IconButton>
            </DropdownMenu.Trigger>
          </Command>
          <DropdownMenu.Content>
            <a href="/" style={{ color: "unset", textDecoration: "none" }}>
              <DropdownMenu.Item>
                <PlusIcon size={16} />
                New
              </DropdownMenu.Item>
            </a>
            {Object.entries(appUserInfo.docs).length > 0 && (
              <DropdownMenu.Separator />
            )}
            {Object.entries(appUserInfo.docs)
              .sort((a, b) =>
                (a[1].title || UNTITLED_DOC_TITLE)
                  .toLocaleLowerCase()
                  .localeCompare(
                    (b[1].title || UNTITLED_DOC_TITLE).toLocaleLowerCase(),
                  ),
              )
              .map(([id, doc]) => (
                <a
                  key={id}
                  href={`/${id}`}
                  onClick={(ev) => docId === id && void ev.preventDefault()}
                  style={{ color: "unset", textDecoration: "none" }}
                >
                  <DropdownMenu.Item disabled={docId === id}>
                    {doc.title || UNTITLED_DOC_TITLE}
                  </DropdownMenu.Item>
                </a>
              ))}
            <DropdownMenu.Separator />
            <DropdownMenu.Item color="red" onClick={() => deleteDocument()}>
              <TrashIcon size={16} />
              Delete {metadata?.title || "this file"}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        <InlineTextEdit
          className={styles.docTitle}
          value={title || UNTITLED_DOC_TITLE}
          onChange={(title) => updateMetadata({ title })}
        />
      </div>
      <div style={{ flexGrow: 1 }} />
      <div className={styles.actions}>
        <Popover.Root>
          <Command label="Share" keyName="s">
            <Popover.Trigger>
              <IconButton variant="ghost" color="gray" radius="full">
                <Share2Icon size={20} />
              </IconButton>
            </Popover.Trigger>
          </Command>
          <Popover.Content width="360px">
            <Flex direction="column" gap="2">
              <Text size="2" color="gray">
                Share to collaborate:
              </Text>
              <Flex gap="2">
                <TextField.Root
                  readOnly
                  value={window.location.href.replace(/https?:\/\//, "")}
                  style={{ flex: "1 1 0", userSelect: "all" }}
                  onFocus={(ev) => ev.currentTarget.select()}
                >
                  <TextField.Slot>
                    <LinkIcon size={16} />
                  </TextField.Slot>
                </TextField.Root>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast("Copied!", { status: "success" });
                  }}
                >
                  Copy
                </Button>
              </Flex>
            </Flex>
          </Popover.Content>
        </Popover.Root>
        <Command label="Fork" keyName="f" ctrlOrCmd={false}>
          <IconButton
            variant="ghost"
            color="gray"
            radius="full"
            onClick={() => fork()}
          >
            <CopyIcon size={20} />
          </IconButton>
        </Command>
        <Separator orientation="vertical" />
        <SettingsButton />
        <SendFeedbackButton feedbackKey={APP_ROOT_PATH} />
      </div>
      <AuthAvatar />
    </header>
  );
}
