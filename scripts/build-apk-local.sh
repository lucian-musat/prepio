#!/usr/bin/env bash
# Builds the Android app on this machine with `eas build --local` (no EAS build quota used), using the local JDK 17 in
# ~/.local/jdk-17 and the Android SDK in ~/Android/Sdk (one-time setup: docs/deploy.md "Local APK builds"). The signing
# keystore still comes from the EAS credentials (the CLI must be logged in). The artifact goes to ~/prepio-builds.
# Usage: bash scripts/build-apk-local.sh [preview|production]
set -euo pipefail

profile="${1:-preview}"
case "$profile" in preview | production) ;; *) echo "Unknown profile: $profile (preview or production)" >&2; exit 1 ;; esac

export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
[ -x "$JAVA_HOME/bin/java" ] || { echo "No JDK at $JAVA_HOME (see docs/deploy.md \"Local APK builds\")." >&2; exit 1; }
[ -d "$ANDROID_HOME/cmdline-tools" ] || { echo "No Android SDK at $ANDROID_HOME (see docs/deploy.md \"Local APK builds\")." >&2; exit 1; }

# A 2-core / 8 GB WSL machine: one Gradle daemon with a bounded heap, Kotlin compiled in that process (no extra
# daemon), and native code for arm64-v8a only (every current Android phone). ABIS="arm64-v8a,armeabi-v7a,x86,x86_64"
# builds all four, which needs much more memory and time. Stop the local Supabase / dev servers first if memory is short.
export GRADLE_OPTS="${GRADLE_OPTS:--Dorg.gradle.jvmargs=-Xmx3g -Dorg.gradle.workers.max=2 -Dkotlin.compiler.execution.strategy=in-process}"
export ORG_GRADLE_PROJECT_reactNativeArchitectures="${ABIS:-arm64-v8a}"

ext="apk"
[ "$profile" = production ] && ext="aab"
out_dir="$HOME/prepio-builds"
mkdir -p "$out_dir"
out="$out_dir/prepio-$profile-$(date +%Y%m%d-%H%M)-$(git -C "$(dirname "$0")/.." rev-parse --short HEAD).$ext"

cd "$(dirname "$0")/../apps/mobile"
pnpm dlx eas-cli build -p android --profile "$profile" --local --non-interactive --output "$out"
echo "Built: $out"
