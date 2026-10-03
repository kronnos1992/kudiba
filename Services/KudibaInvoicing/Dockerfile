# =============================================================================
# KUDIBA ERP — KUDIBA INVOICING MICROSERVICE (.NET 10 / C#)
# Conformidade: Decreto Presidencial n.º 71/25 (AGT Angola)
# =============================================================================

# Stage 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project definitions for layer caching
COPY KudibaInvoicing.sln ./
COPY src/KudibaInvoicing.Domain/KudibaInvoicing.Domain.csproj src/KudibaInvoicing.Domain/
COPY src/KudibaInvoicing.Application/KudibaInvoicing.Application.csproj src/KudibaInvoicing.Application/
COPY src/KudibaInvoicing.Infrastructure/KudibaInvoicing.Infrastructure.csproj src/KudibaInvoicing.Infrastructure/
COPY src/KudibaInvoicing.Api/KudibaInvoicing.Api.csproj src/KudibaInvoicing.Api/
COPY src/KudibaInvoicing.HealthCheck/KudibaInvoicing.HealthCheck.csproj src/KudibaInvoicing.HealthCheck/

RUN dotnet restore KudibaInvoicing.sln

# Copy source code and publish
COPY . .
RUN dotnet publish src/KudibaInvoicing.Api/KudibaInvoicing.Api.csproj -c Release -o /app/publish
RUN dotnet publish src/KudibaInvoicing.HealthCheck/KudibaInvoicing.HealthCheck.csproj -c Release -o /app/healthcheck

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

COPY --from=build /app/publish .
COPY --from=build /app/healthcheck/KudibaInvoicing.HealthCheck.dll ./KudibaInvoicing.HealthCheck.dll
COPY --from=build /app/healthcheck/KudibaInvoicing.HealthCheck.runtimeconfig.json ./KudibaInvoicing.HealthCheck.runtimeconfig.json

ENV PORT=9090
ENV ASPNETCORE_URLS=http://+:9090
EXPOSE 9090

# Native healthcheck using compiled .NET assembly (zero external package dependency)
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=3 \
  CMD ["dotnet", "/app/KudibaInvoicing.HealthCheck.dll"]

ENTRYPOINT ["dotnet", "KudibaInvoicing.Api.dll"]
