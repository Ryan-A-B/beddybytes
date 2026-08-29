FROM --platform=linux/amd64 gradle:9.7.1-jdk17@sha256:89c4573e06e11f51751d5037357f4d8df4807b10101623fdecfdacbab52832bd

USER root

ARG ANDROID_COMMAND_LINE_TOOLS_VERSION=15859902
ARG ANDROID_COMMAND_LINE_TOOLS_SHA256=4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583
ARG ANDROID_PLATFORM_TOOLS_VERSION=37.0.1
ARG ANDROID_PLATFORM_TOOLS_SHA256=d230f13842f60f782a8645f9c813f8f845bf36089ea7289f28c48f17979313f1

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools"

RUN set -eux; \
    mkdir -p "${ANDROID_HOME}/cmdline-tools"; \
    wget --no-verbose \
        --output-document=/tmp/android-command-line-tools.zip \
        "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_COMMAND_LINE_TOOLS_VERSION}_latest.zip"; \
    echo "${ANDROID_COMMAND_LINE_TOOLS_SHA256}  /tmp/android-command-line-tools.zip" | sha256sum --check -; \
    unzip -q /tmp/android-command-line-tools.zip -d /tmp/android-command-line-tools; \
    mv /tmp/android-command-line-tools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest"; \
    rm -rf /tmp/android-command-line-tools /tmp/android-command-line-tools.zip; \
    wget --no-verbose \
        --output-document=/tmp/android-platform-tools.zip \
        "https://dl.google.com/android/repository/platform-tools_r${ANDROID_PLATFORM_TOOLS_VERSION}-linux.zip"; \
    echo "${ANDROID_PLATFORM_TOOLS_SHA256}  /tmp/android-platform-tools.zip" | sha256sum --check -; \
    unzip -q /tmp/android-platform-tools.zip -d "${ANDROID_HOME}"; \
    rm /tmp/android-platform-tools.zip; \
    yes | sdkmanager --licenses >/dev/null; \
    sdkmanager --channel=3 \
        "platforms;android-35" \
        "platforms;android-36" \
        "platforms;android-37.0" \
        "build-tools;36.0.0" \
        "build-tools;37.0.0"; \
    chmod -R a+rX "${ANDROID_HOME}"

WORKDIR /workspace

CMD ["./gradlew", "--no-daemon", "tasks"]
