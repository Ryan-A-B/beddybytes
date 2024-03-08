FROM python:3.8

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    chromium-driver \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Install Docker
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc && \
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

CMD [ "python", "./run.py" ]
