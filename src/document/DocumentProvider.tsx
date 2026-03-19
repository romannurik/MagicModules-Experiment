/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuthContext } from "@/auth/AuthProvider";
import { db } from "@/firebase";
import {
  child,
  DatabaseReference,
  onValue,
  ref,
  remove,
  set,
  update,
} from "firebase/database";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { DOC_ROOT_PATH, DocMetadata, USERINFO_ROOT_PATH } from "./model-and-db";
import { generateId } from "./util";
import { Engine } from "@/engines/types";
import { engineForCodebase } from "@/engines";

const FORK_KEYS_TO_COPY = ["metadata", "codebase"];

export type Codebase = {
  files: Record<string, string>;
};

type DocumentContext = {
  docLoading: boolean;
  docId: string;
  docRef: DatabaseReference;
  metadata: DocMetadata | undefined;
  updateMetadata: (updates: Partial<DocMetadata>) => void;
  engine: Engine;
  codebase: Codebase;
  setCodebase: (codebase: Codebase | ((prev: Codebase) => Codebase)) => void;
  fork: () => void;
  deleteDocument: () => void;
};

const DocumentContext = createContext<DocumentContext>({} as DocumentContext);

export const DocumentContextConsumer = DocumentContext.Consumer;

export function useDocumentContext() {
  return useContext(DocumentContext);
}

type Props = {
  docId: string;
};

export function DocumentProvider({
  docId,
  children,
}: React.PropsWithChildren<Props>) {
  const { user } = useAuthContext();
  const docRef = ref(db, `${DOC_ROOT_PATH}/${docId}`);
  const [metadata, setMetadata] = useState<DocMetadata>();
  const [codebase, _setCodebase] = useState<Codebase>({ files: {} });
  const totallyEmptyRef = useRef(true);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const updateMetadata = useCallback(
    (updates: Partial<DocMetadata>) => {
      setMetadata((metadata) => {
        let merged = {
          ...metadata,
          ...updates,
        };
        update(child(docRef, "metadata"), updates);
        if (userRef.current?.uid && merged.creatorUid === userRef.current.uid) {
          update(
            ref(
              db,
              `${USERINFO_ROOT_PATH}/${userRef.current.uid}/docs/${docId}`,
            ),
            updates,
          );
        }
        return merged;
      });
    },
    [docId],
  );

  useEffect(() => {
    if (!totallyEmptyRef.current && !metadata?.creatorUid && user) {
      updateMetadata({ creatorUid: user.uid });
    }
  }, [metadata, user]);

  const setCodebase = useCallback(
    (codebase: Codebase | ((prev: Codebase) => Codebase)) => {
      _setCodebase((prev) => {
        let newCodebase =
          typeof codebase === "function" ? codebase(prev) : codebase;
        newCodebase.files = Object.fromEntries(
          Object.entries(newCodebase.files).map(([path, content]) => [
            path.replace(/^\//, ""),
            content,
          ]),
        );
        set(child(docRef, "codebase"), {
          ...newCodebase,
          files: Object.fromEntries(
            Object.entries(newCodebase.files)
              .map(([path, content]) => [
                path.replace(
                  /[^\w]/g,
                  (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
                ),
                content,
              ])
              .filter((path) => !!path),
          ),
        });
        return newCodebase;
      });
    },
    [String(docRef)],
  );

  const deleteDocument = useCallback(() => {
    set(docRef, { deleted: true, metadata: { creatorUid: "deleted" } });
    userRef.current &&
      remove(
        ref(db, `${USERINFO_ROOT_PATH}/${userRef.current.uid}/docs/${docId}`),
      );
    window.location.pathname = "/";
  }, [docId]);

  const fork = useCallback(async () => {
    let ss: Record<string, any> = await new Promise((resolve) => {
      onValue(docRef, (ss) => resolve(ss.val()), { onlyOnce: true });
    });
    let newDoc: Record<string, any> = {};
    for (let key of FORK_KEYS_TO_COPY) {
      if (ss[key]) {
        newDoc[key] = ss[key];
      }
    }
    newDoc.metadata = newDoc.metadata || {};
    newDoc.metadata.title = (newDoc.metadata.title || "Untitled") + " (Fork)";
    // Create new doc in RTDB + redirect
    let newId = generateId();
    await set(ref(db, `${DOC_ROOT_PATH}/${newId}`), newDoc);
    userRef.current &&
      (await set(
        ref(db, `${USERINFO_ROOT_PATH}/${userRef.current.uid}/docs/${newId}`),
        newDoc.metadata,
      ));
    window.open(newId);
  }, []);

  // Observe doc metadata and content from RTDB
  useEffect(() => {
    let unsub = onValue(docRef, (ss) => {
      let val = ss.val();
      totallyEmptyRef.current = !val;
      setMetadata(val?.metadata || {});
      let codebase = val?.codebase || { files: {} };
      if (Object.keys(codebase.files || {}).length) {
        codebase.files = Object.fromEntries(
          Object.entries(codebase.files || {}).map(([path, content]) => [
            decodeURIComponent(path).replace(/^\//, ""),
            content,
          ]),
        );
      } else {
        // codebase = structuredClone(STARTER_CODEBASE);
      }
      _setCodebase(codebase);
    });
    return () => unsub();
  }, [docId]);

  const engine = engineForCodebase(codebase);

  return (
    <DocumentContext.Provider
      value={{
        docLoading: !metadata,
        docId,
        docRef,
        metadata,
        engine,
        updateMetadata,
        fork,
        deleteDocument,
        codebase,
        setCodebase,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}
