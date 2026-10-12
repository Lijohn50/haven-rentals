# Multi-stage Docker build for Vacation Rental Marketplace REST API

# Stage 1: Build JAR
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Cache Maven dependencies (settings.xml mirrors Central onto the
# Google GCS mirror to avoid Maven Central 429 rate limits)
COPY pom.xml settings.xml ./
RUN mvn -s settings.xml dependency:go-offline -B

# Compile and package application
COPY src src
RUN mvn -s settings.xml clean package -DskipTests -B

# Stage 2: Runtime Image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Install curl for container health check and create unprivileged application user
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup && useradd -r -g appgroup -d /app appuser

# Create upload directory and set permissions
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

# Copy executable jar from build stage
COPY --from=build --chown=appuser:appgroup /workspace/target/rentals-backend-1.0.0.jar app.jar

USER appuser

# Standard JVM settings with UTC timezone and safe memory bounds for 512MB containers
ENV JAVA_OPTS="-Duser.timezone=UTC -Xmx280m -Xss512k -XX:MaxMetaspaceSize=128m -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"
ENV SERVER_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:${SERVER_PORT:-8080}/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
