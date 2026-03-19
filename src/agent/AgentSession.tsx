/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, Part } from "@google/genai";
import { Button, IconButton, Spinner, Text, TextField } from "@radix-ui/themes";
import cn from "classnames";
import {
  BrainIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  InfinityIcon,
  LucideIcon,
  SendIcon,
  StopCircleIcon,
  WrenchIcon,
} from "lucide-react";
import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import styles from "./AgentSession.module.scss";
import { Agent } from "./types";

export function AgentSession<TContext>({
  forcePrompt,
  className,
  agent,
  agentContext,
}: {
  forcePrompt?: string;
  className?: string;
  agentContext?: TContext;
  agent: Agent<TContext>;
}) {
  const [history, setHistory] = useState<Content[]>([]);
  let [prompt, setPrompt] = useState("");
  const [activeAbort, setActiveAbort] = useState<AbortController>();
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // trigger the active abort anytime it changes or
    // upon unmounting the component
    return () => activeAbort?.abort();
  }, [activeAbort]);

  useEffect(() => {
    historyRef.current?.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [history]);

  const sendPrompt = async (forcePrompt?: string) => {
    if (activeAbort) {
      setActiveAbort(undefined);
      await new Promise((resolve) => setTimeout(resolve));
    }

    if (forcePrompt) {
      prompt = forcePrompt;
    }

    if (!prompt.trim()) return;
    setPrompt("");

    if (prompt.trim() === "/clear") {
      setHistory([]);
      return;
    }

    setHistory((h) => [
      ...h,
      { role: "user", type: "text", parts: [{ text: prompt }] },
    ]);
    let abort = new AbortController();
    setActiveAbort(abort);
    let response: Content = { role: "model" };
    setHistory((h) => [...h, response]);
    for await (let chunk of agent.generate(prompt, {
      history,
      context: agentContext,
      signal: abort.signal,
    })) {
      if (abort.signal.aborted) return;
      response.parts ||= [];
      let lastPart = response.parts.at(-1);
      if (chunk.thought === lastPart?.thought && chunk.text && lastPart?.text) {
        lastPart.text += chunk.text;
      } else {
        response.parts.push(chunk);
      }
      setHistory((h) => {
        let newHistory = [...h];
        newHistory[newHistory.length - 1] = response;
        return newHistory;
      });
    }
    setActiveAbort(undefined);
  };

  useEffect(() => {
    if (!forcePrompt) return;
    let to = setTimeout(() => sendPrompt(forcePrompt));
    return () => clearTimeout(to);
  }, [forcePrompt]);

  return (
    <div className={cn(styles.agent, className)}>
      <div ref={historyRef} className={styles.history}>
        {!history.length && (
          <div className={styles.zeroState}>
            <div className={styles.icon}>
              <InfinityIcon size={24} />
            </div>
            <Text className="title" size="3" weight="medium">
              Start with a prompt
            </Text>
            <Text className="description" size="2" color="gray">
              Build your app with Gemini
            </Text>
          </div>
        )}
        {history.map((item, index) => (
          <div
            key={index}
            className={cn(styles.message, {
              [styles.isUser]: item.role === "user",
            })}
          >
            {item.parts?.map((part, partIndex) => {
              let isLastInHistory = index === history.length - 1;
              let nextPart = item.parts![partIndex + 1];
              let active = isLastInHistory && !nextPart && !!activeAbort;
              let partDuration = nextPart
                ? (nextPart.extTimestamp || 0) - (part.extTimestamp || 0)
                : undefined;
              return (
                <Fragment key={partIndex}>
                  {part.thought && (
                    <ThinkingPart
                      duration={partDuration}
                      active={active}
                      part={part}
                    />
                  )}
                  {!part.thought && part.text && <TextPart part={part} />}
                  {part.functionCall && (
                    <ToolCallPart
                      agent={agent}
                      active={active}
                      part={part}
                      nextPart={nextPart}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        ))}
        {activeAbort && <Spinner className={styles.spinner} />}
      </div>
      {!forcePrompt && (
        <div className={styles.prompt}>
          <form
            action=""
            onSubmit={(ev) => {
              ev.preventDefault();
              sendPrompt(); // also just stops if no prompt
            }}
          >
            <TextField.Root
              placeholder="Ask Gemini"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            >
              <TextField.Slot side="right">
                {(!activeAbort || prompt.trim()) && (
                  <IconButton type="submit" color="gray" variant="ghost">
                    <SendIcon size={16} />
                  </IconButton>
                )}
                {activeAbort && !prompt.trim() && (
                  <IconButton color="red" type="submit" variant="ghost">
                    <StopCircleIcon size={16} />
                  </IconButton>
                )}
              </TextField.Slot>
            </TextField.Root>
          </form>
        </div>
      )}
    </div>
  );
}

function ActivityBlock({
  icon,
  children,
  active,
  label,
  subLabel,
  doneLabel,
  notExpandable,
  className,
}: {
  children: React.ReactNode;
  label: string;
  doneLabel?: string;
  icon: LucideIcon;
  active?: boolean;
  subLabel?: string | ReactNode;
  notExpandable?: boolean;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = icon;
  return (
    <div className={cn(styles.activityBlock, className)}>
      <Button
        className={styles.button}
        color="gray"
        variant="ghost"
        onClick={() => !notExpandable && setIsExpanded(!isExpanded)}
      >
        <Icon className={styles.icon} size={16} />
        {active ? (
          <span className={styles.activityActiveShimmer}>{label}</span>
        ) : (
          doneLabel || label
        )}
        {subLabel && <span className={styles.subLabel}>{subLabel}</span>}
        {!active && !notExpandable && !isExpanded && (
          <ChevronDownIcon size={12} />
        )}
        {!active && !notExpandable && isExpanded && <ChevronUpIcon size={12} />}
      </Button>
      {isExpanded && <div className={styles.activityDetail}>{children}</div>}
    </div>
  );
}

function ThinkingPart({
  part,
  active,
  duration,
}: {
  part: Part;
  active?: boolean;
  duration?: number;
}) {
  return (
    <ActivityBlock
      className={styles.thinkingPart}
      active={active}
      label="Thinking"
      doneLabel="Thought"
      subLabel={
        active
          ? ""
          : `for ${
              !duration
                ? "a bit"
                : duration < 1000
                ? `${duration.toFixed(0)}ms`
                : `${(duration / 1000).toFixed(1)}s`
            }`
      }
      icon={BrainIcon}
    >
      <div className={(styles.thoughts, styles.markdown)}>
        <ReactMarkdown>{part.text}</ReactMarkdown>
      </div>
    </ActivityBlock>
  );
}

function ToolCallPart({
  part,
  nextPart,
  active,
  agent,
}: {
  part: Part;
  nextPart?: Part;
  active?: boolean;
  agent: Agent<unknown>;
}) {
  let tool = agent.tools.find((t) => t.name === part.functionCall!.name);
  let response = nextPart?.functionResponse?.response;
  let { output } = response || {};
  let renderedBody = tool?.renderBody?.(
    part.functionCall!.args as any,
    output,
    nextPart?.extMetadata
  );
  return (
    <ActivityBlock
      className={styles.toolCallPart}
      active={active}
      label={
        typeof tool?.displayName === "function"
          ? tool.displayName(
              part.functionCall!.args as any,
              output,
              nextPart?.extMetadata
            )
          : tool?.displayName || part.functionCall!.name || "Used tool"
      }
      subLabel={
        tool?.renderSummaryLine?.(
          part.functionCall!.args as any,
          output,
          nextPart?.extMetadata
        ) || Object.values(part.functionCall!.args || []).join(", ")
      }
      icon={
        tool?.dynamicIcon
          ? tool.dynamicIcon(
              part.functionCall!.args as any,
              output,
              nextPart?.extMetadata
            )
          : tool?.icon || WrenchIcon
      }
      notExpandable={renderedBody === null}
    >
      {renderedBody ? (
        renderedBody
      ) : (
        <>
          {Object.entries(part.functionCall!.args || {}).map(([k, v]) => (
            <div className={styles.toolCallArg} key={k}>
              <span className={styles.toolCallArgKey}>{k}</span>:{" "}
              <code>{typeof v === "string" ? v : JSON.stringify(v)}</code>
            </div>
          ))}
          Response:
          {typeof output === "string" && <pre>{output}</pre>}
          {!!output && typeof output !== "string" && (
            <pre>{JSON.stringify(output, null, 2)}</pre>
          )}
          {!output && <pre>{JSON.stringify(response, null, 2)}</pre>}
        </>
      )}
    </ActivityBlock>
  );
}

function TextPart({ part }: { part: Part }) {
  return (
    <div className={cn(styles.textPart, styles.markdown)}>
      <ReactMarkdown>{part.text}</ReactMarkdown>
    </div>
  );
}
