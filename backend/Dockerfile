# Multi-stage Docker build for Vacation Rental Marketplace REST API

# Stage 1: Build JAR
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /workspace

# Cache Maven dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Compile and package application
COPY src src
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime Image
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create unprivileged application user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app appuser

# Create upload directory and set permissions
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app
s
# Copy executable jar from build stage
COPY --from=build --chown=appuser:appgroup /workspace/target/rentals-backend-1.0.0.jar app.jar

USER appuser

# Standard JVM settings with UTC timezone and container memory limits
ENV JAVA_OPTS="-Duser.timezone=UTC -XX:MaxRAMPercentage=75 -Djava.security.egd=file:/dev/./urandom"
ENV SERVER_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
