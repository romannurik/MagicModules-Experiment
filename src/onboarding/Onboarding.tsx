/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthAvatar } from "@/auth/AuthAvatar";
import { useAuthContext } from "@/auth/AuthProvider";
import { Logo } from "@/components/Logo";
import { usePrefsContext } from "@/util/PrefsProvider";
import { GodRays, MeshGradient } from "@paper-design/shaders-react";
import { Card, Heading, HeadingProps, Text, TextProps } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import { Loading } from "../components/Loading";
import { InitialPrefsScreen } from "./InitialPrefsScreen";
import { InviteCodeScreen } from "./InviteCodeScreen";
import { LoginScreen } from "./LoginScreen";
import styles from "./Onboarding.module.scss";
import { areRequiredPrefsSet } from "./RequiredPrefs";
import { areTermsAccepted, TermsScreen } from "./TermsScreen";

export function OnboardGate({
  children,
  signInWorkaroundPath,
}: React.PropsWithChildren<{
  /**
   * To get Firebase Auth working with COEP, only call signIn() from
   * non-COEP'd paths (needs custom server config for that path)
   */
  signInWorkaroundPath?: string;
}>) {
  const { user, hasAccess, authLoaded } = useAuthContext();
  const { prefs } = usePrefsContext();
  const [continueKey, setContinueKey] = useState(0);
  const termsAccepted = useMemo(() => areTermsAccepted(prefs), [continueKey]);
  // only check on first mount to avoid kicking users out if they delete prefs
  const initialConfigDone = useMemo(
    () => areRequiredPrefsSet(prefs),
    [continueKey],
  );

  // const demo = {
  //   "1": <LoginScreen />,
  //   "2": <InviteCodeScreen />,
  //   "3": <InitialPrefsScreen onContinue={() => {}} />,
  // }[new URLSearchParams(window.location.search).get("force") || ""];
  // if (demo) return demo;

  useEffect(() => {
    if (!signInWorkaroundPath || !authLoaded) return;
    if (user && window.location.pathname === signInWorkaroundPath) {
      let redirect = new URLSearchParams(window.location.search).get(
        "redirect",
      );
      window.location.href = redirect || "/";
    } else if (!user && window.location.pathname !== signInWorkaroundPath) {
      window.location.href =
        signInWorkaroundPath +
        "?" +
        new URLSearchParams({
          redirect: window.location.href,
        }).toString();
    }
  }, [authLoaded, user]);

  if (!authLoaded) return <Loading />;
  if (!user) return <LoginScreen />;
  if (!hasAccess) return <InviteCodeScreen />;
  if (!termsAccepted)
    return <TermsScreen onContinue={() => setContinueKey((k) => k + 1)} />;
  if (!initialConfigDone)
    return (
      <InitialPrefsScreen onContinue={() => setContinueKey((k) => k + 1)} />
    );

  // fully onboarded
  return <>{children}</>;
}

function OnboardingContainer({ children }: React.PropsWithChildren) {
  const { user } = useAuthContext();
  return (
    <>
      {user && <AuthAvatar className={styles.avatar} />}
      <div className={styles.container}>
        <MeshGradient
          className={styles.backdrop}
          colors={["#2E2259", "#341947", "#2B2137"]}
          distortion={0.4}
          speed={1}
          grainMixer={1}
        />
        <GodRays
          className={styles.godrays}
          colors={["#2E2259", "#341947", "#2B2137"]}
          colorBloom="#2B2137"
          colorBack="#00000000"
          speed={2}
          offsetX={0}
          offsetY={0}
        />
        <Card size="4" className={styles.card}>
          {children}
        </Card>
      </div>
    </>
  );
}

export const Onboarding = {
  Container: OnboardingContainer,
  Logo: () => <Logo className={styles.logo} size={24} />,
  Image: ({ children }: React.PropsWithChildren) => (
    <div className={styles.image}>{children}</div>
  ),
  Title: ({ children, ...props }: React.PropsWithChildren<HeadingProps>) => (
    <Heading size="4" weight="medium" mb="2" {...props}>
      {children}
    </Heading>
  ),
  Description: ({ children, ...props }: React.PropsWithChildren<TextProps>) => (
    <Text
      style={{ maxWidth: 300, textWrap: "balance" }}
      as="p"
      color="gray"
      size="2"
      mb="5"
      {...props}
    >
      {children}
    </Text>
  ),
};
