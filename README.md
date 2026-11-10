# MAGEN — Project Documentation

> **Project:** MAGEN — AI-Powered Manga Character and Panel Generation  
> **Repository:** https://github.com/KingRagnar69/MAGEN  
> **Documentation date:** 10 November 2026  
> **Status:** Development / local-first prototype

## 1. Project overview

MAGEN is a local-first manga image-generation application. Its intended workflow is to let a user describe a manga character in a web interface, send that description to a Spring Boot backend, ask a locally running ComfyUI workflow to generate an image, save the resulting image on disk, and persist character metadata and the image path in PostgreSQL.

The project combines:

- **React** — browser-based user interface.
- **Java + Spring Boot** — backend API and application logic.
- **PostgreSQL** — persistent character and manga-project data.
- **Spring Data JPA / Hibernate** — object-relational persistence.
- **ComfyUI** — local image-generation workflow server.
- **Docker** — container packaging for the backend and frontend.

The project is local-first: the image-generation engine is intended to run on the user's own machine rather than requiring a paid cloud image-generation API.

## 2. Architecture and request flow

```text
Browser (React :5173 during development)
        |
        | HTTP request / JSON
        v
Spring Boot backend (:8080)
        |
        +---- Spring Data JPA / Hibernate ----> PostgreSQL (:5432)
        |
        +---- HTTP + JSON --------------------> ComfyUI (:8188)
                                                  |
                                                  v
                                         Local image workflow
                                                  |
                                                  v
                                      Generated image returned
        |
        v
Backend saves image to generated-images/
and persists character metadata/path
        |
        v
React displays the returned Base64 data URL
```

### Character-generation flow observed in `AIService`

1. The backend loads `src/main/resources/workflow/imgmodel.json`.
2. Jackson parses the ComfyUI API workflow JSON.
3. The service updates the positive prompt in workflow node `4`.
4. It generates a random seed and updates node `7`.
5. It submits the workflow to `POST /prompt` on ComfyUI.
6. It reads the returned `prompt_id`.
7. It polls `/history/{prompt_id}` until an output image appears, with a 180-second deadline and a one-second polling interval.
8. It downloads the image through ComfyUI's `/view` endpoint.
9. It creates the output directory if necessary and writes a uniquely named PNG.
10. It saves a `Character` record through `CharacterRepository`.
11. It Base64-encodes the image and returns a `data:image/png;base64,...` string to the frontend.

**Important:** This is the behavior of the AIService source recovered from the previous project discussion. Exact current controller mappings and request/response DTOs should be checked against the current repository before treating every endpoint contract as final.

## 3. Technology stack

| Technology | Role in MAGEN |
|---|---|
| Java | Backend programming language |
| Spring Boot | Backend application framework and dependency/configuration management |
| Spring Web | HTTP controllers and REST endpoints |
| Spring Data JPA | Repository abstraction for database operations |
| Hibernate | JPA implementation that maps Java entities to SQL tables |
| PostgreSQL | Relational database |
| React | Frontend component framework |
| JavaScript / TypeScript | Frontend application code (TypeScript was used in the supplied React app context) |
| ComfyUI | Local image-generation server and workflow execution |
| Jackson | Reads, edits, and writes JSON workflow/request data |
| Docker | Packages backend/frontend into containers |
| Maven | Backend dependency management and build |
| Node.js / npm | Frontend dependency installation and build |
| Nginx | Serves the built React frontend in the frontend container |

## 4. Backend project structure

The backend project directory was identified as `magen`, with Java package:

`ragdev69.gen.magen`

The following describes the files/classes discussed or visible in the supplied project material. Where the exact source was not available in the recovered context, the description is identified as a role-based explanation rather than a line-by-line source audit.

| File / component | Responsibility |
|---|---|
| `MagenApplication.java` | Spring Boot entry point. Its `main` method starts the application and component scanning discovers Spring-managed classes. |
| `AIController.java` | HTTP boundary for AI-related requests. Receives frontend requests and delegates generation work to `AIService`. The previously discussed API area was `/api/ai`; confirm exact method mappings in the current source. |
| `AIService.java` | Coordinates ComfyUI workflow submission, polling, image retrieval, local file storage, character persistence, and Base64 response creation. |
| `Character.java` | JPA entity representing a generated character and its stored metadata/image path. |
| `CharacterRepository.java` | Spring Data repository used by `AIService` to persist and retrieve character records. |
| `MangaInstance.java` | Entity representing a manga/project instance. |
| `MangaPanel.java` | Entity representing a panel associated with a manga instance. |
| `MangaInstanceController.java` | Controller for manga-instance operations; its existence is supported by a recovered application log. |
| `application.yaml` | Spring configuration, including database connection and Hibernate/JPA settings. |
| `pom.xml` | Maven project descriptor: project coordinates, Java/build configuration, dependency declarations, and Spring Boot build plugin. |
| `src/main/resources/workflow/imgmodel.json` | Exported ComfyUI API workflow. The backend edits selected node inputs before submission. |
<img width="1767" height="857" alt="image" src="https://github.com/user-attachments/assets/64ac6042-fa66-4e20-91f4-e6a02b8ed664" />
| `generated-images/` | Runtime output directory for generated PNG files. It should be treated as application data, not source code. |

### `AIService.java` — important implementation details

- `@Service` registers the class as a Spring-managed service.
- `ObjectMapper` (Jackson) reads and modifies the workflow JSON tree.
- `HttpClient` and `HttpRequest` / `HttpResponse` are Java standard-library HTTP APIs; they do not require a third-party HTTP-client dependency.
- `getResourceAsStream("/workflow/imgmodel.json")` loads the workflow from the application classpath.
- `workflow.path("4").path("inputs")` selects node 4; its `text` property is updated with the character prompt.
- Node 7's `seed` is randomized for each request.
- `/prompt` submits a workflow; `/history/{prompt_id}` is polled for completion; `/view` downloads the generated image.
- `Files.createDirectories` and `Files.write` create the output directory and save the image.
- `CharacterRepository.save(...)` persists the character record.
- `Thread.currentThread().interrupt()` correctly restores the interrupt flag when an `InterruptedException` occurs.

### A deployment concern in the recovered source

The recovered `AIService` contains a hard-coded ComfyUI URL of `http://127.0.0.1:8188` and a Windows-specific output path:

`C:\Users\ronak\MAGEN\generated-images`

These are suitable only for the matching local development arrangement. Inside a Docker container, `127.0.0.1` means the backend container itself, not the Windows host. For a backend container talking to ComfyUI running on the host, use a configurable URL such as `http://host.docker.internal:8188` (and ensure the host service is reachable). Make the image output directory configurable and mount it as a persistent volume.

## 5. Maven dependencies (`pom.xml`)

### Dependency responsibilities

The recovered runtime logs show Spring Boot 4.1.1-era Spring libraries, Spring Data JPA, Hibernate, PostgreSQL JDBC, and HikariCP. The AIService source directly uses Jackson's `ObjectMapper`; Spring's web starter normally supplies Jackson through its managed dependency set. The code uses Java's built-in `java.net.http.HttpClient`, so a separate HTTP client library is not required for that implementation.

| Dependency | Why it is needed |
|---|---|
| `spring-boot-starter-web` | REST controllers, HTTP request handling, embedded web server, and JSON HTTP support. Keep the starter name consistent with the actual Spring Boot generation and the existing project POM. |
| `spring-boot-starter-data-jpa` | Spring Data repositories, JPA entity management, transactions, and Hibernate integration. |
| `postgresql` | PostgreSQL JDBC driver. Runtime scope is sufficient for a normal application. |
| `spring-boot-starter-test` (optional, test scope) | Spring/JUnit testing support if backend tests are present or are being added. |

### Representative Maven dependency section

This is a **dependency reference**, not a verified copy of the current repository's complete `pom.xml`. The original `pom.xml` was not available in the recovered project files for this regeneration, so compare this section with the file in your working tree before replacing anything.

```xml
<dependencies>
    <!-- REST controllers and HTTP/JSON support -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- JPA repositories, entity management and Hibernate -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>

    <!-- PostgreSQL JDBC driver -->
    <dependency>
        <groupId>org.postgresql</groupId>
        <artifactId>postgresql</artifactId>
        <scope>runtime</scope>
    </dependency>

    <!-- Optional: include when tests use Spring Boot/JUnit test support -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Jackson and HTTP-client notes

- `AIService` imports `com.fasterxml.jackson.databind.JsonNode`, `ObjectMapper`, and `ObjectNode`. These are Jackson Databind classes. In a Spring Web application Jackson is commonly brought in transitively; do not add a second, manually versioned Jackson dependency without a reason. If the actual POM excludes Jackson or the class is unavailable at compile time, declare `com.fasterxml.jackson.core:jackson-databind` and let the Spring Boot dependency management choose its version.
- `java.net.http.HttpClient` is part of the JDK (Java 11+). No OkHttp, Apache HttpClient, or WebClient dependency is required by the recovered service implementation.
- Hibernate and HikariCP are brought in through the JPA starter and its managed dependencies; they normally should not be declared separately.
- Do not add Lombok unless the source actually uses Lombok annotations such as `@Data`, `@Getter`, or `@RequiredArgsConstructor`.

### Maven commands

Run these from the backend directory containing `pom.xml`:

```bash
mvn clean
mvn test
mvn package
mvn spring-boot:run
```

To inspect resolved dependencies:

```bash
mvn dependency:tree
```

## 6. Database and Hibernate configuration

The database name and connection previously recorded for the project are:

- Database: `magen_db`
- JDBC URL: `jdbc:postgresql://localhost:5432/magen_db`
- Database: PostgreSQL
- Hibernate schema mode: `update` (previously reported as `ddl-auto: update`)
- SQL logging: enabled during development (`show-sql: true`)

A representative YAML shape is:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/magen_db
    username: ${DB_USERNAME:postgres}
    password: ${DB_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
```

This is an illustrative safe configuration shape, not a verified verbatim copy of the current `application.yaml`. Set credentials through environment variables or a local ignored configuration file. Do not commit real database passwords.

### What Hibernate does here

1. `@Entity` classes describe persistent Java objects.
2. Hibernate maps entity fields and relationships to database tables and columns.
3. Spring Data JPA repositories provide methods for saving and querying entities.
4. `ddl-auto: update` asks Hibernate to attempt schema updates at startup. It is convenient during development but is not a substitute for controlled database migrations in production.

### Recorded database issue

A recovered log showed PostgreSQL error SQLState `42703`:

`ERROR: column c1_0.instance_id does not exist`

Hibernate generated a query selecting `characters.instance_id`, but the existing database table did not contain that column. This indicates a mismatch between the current entity relationship/mapping and the actual database schema. Do not immediately delete the database. Inspect the entity annotations, table columns, foreign-key relationship, and generated SQL; then apply a deliberate migration or repair.

Another recorded issue involved Hibernate failing to obtain JDBC metadata / determine the dialect when the application was started locally after Docker configuration changes. Check that PostgreSQL is running and reachable at the configured JDBC URL, the database exists, credentials are correct, and the PostgreSQL driver is present. An explicit dialect should not be the first fix for an unreachable database.

## 7. Frontend

The frontend is a React application. The supplied project context identified a React TypeScript `App` component. Its responsibility is to collect user input, call the Spring Boot API, and render generated character imagery and application data.

Typical frontend responsibilities:

- Capture character name and description.
- Send an HTTP request to the backend AI endpoint.
- Handle loading and error states while the backend waits for ComfyUI.
- Display the Base64 image data URL returned by the backend.
- Request and display saved characters through the relevant API.

The exact React filenames, component tree, npm dependency versions, and API request payloads were not recoverable in this regeneration. Use the current frontend source and `package.json` as the authority.

### Frontend container

The previously inspected Docker archive used a multi-stage Node build and Nginx to serve the production frontend. Node is used to install dependencies and compile the React application; Nginx serves the resulting static files. The development server port and production container port are different:

- React development server: `5173`
- Nginx frontend container: `80`
- Previously recorded Docker mapping: host `5173` → container `80`

## 8. REST API and service communication

The earlier project discussion identified the AI API area as `/api/ai` and a character API path as `/api/characters`. These are useful route references, but the exact HTTP verbs, path variables, request fields, response structure, and controller annotations must be confirmed against the current controller source.

| API area | Purpose |
|---|---|
| `/api/ai` | AI/image-generation operations (exact method mapping to verify) |
| `/api/characters` | Character-related operations (exact methods and response DTOs to verify) |

The browser should call the backend, not ComfyUI directly. This keeps workflow manipulation, file storage, and database persistence in the backend. For production deployment, configure the frontend API base URL rather than hard-coding a development URL.

## 9. ComfyUI workflow

ComfyUI is a separate local service. MAGEN's backend does not itself implement the image-generation neural network; it submits a workflow to ComfyUI.

Important workflow concepts:

- **Workflow JSON:** graph of nodes and connections exported in API format.
- **Node 4:** positive prompt input in the recovered implementation.
- **Node 7:** sampler seed input in the recovered implementation.
- **Prompt ID:** identifier returned after a workflow is queued.
- **History:** endpoint used to inspect execution results.
- **View:** endpoint used to retrieve the generated image.

The node IDs are tied to the exported workflow. If the workflow is edited or re-exported, verify that node `4` still contains the prompt input and node `7` still contains the seed input. Do not assume node IDs are universal across workflows.

## 10. Docker, images, containers, and ports

### Previously recorded container layout

| Component | Container/internal port | Host/development port |
|---|---:|---:|
| Spring Boot backend | `8080` | `8080` |
| Nginx frontend | `80` | `5173` (previous mapping) |
| PostgreSQL | `5432` | `5432` |
| ComfyUI | `8188` | `8188` on host/local machine |

The earlier Docker archive was inspected as a multi-stage build:

- Backend: Maven build stage followed by an Eclipse Temurin 25 runtime stage.
- Frontend: Node 24 Alpine build stage followed by an Nginx runtime stage.
- Previously reported backend image size: approximately 577 MB (image listing also showed approximately 166 MB for a size-related column; Docker's displayed size fields can differ by command/output).
- Previously reported backend image tag: `magen-backend:latest`.
- Previously used container name: `magen-backend-container`.

### Commands recorded during development

Run commands from the directory containing the relevant Dockerfile.

```bash
# Build backend image
docker build -t magen-backend:latest .

# Run backend container (example port mapping)
docker run -d --name magen-backend-container -p 8080:8080 magen-backend:latest

# List running containers
docker ps

# List all containers
docker ps -a

# List local images
docker images

# View backend logs
docker logs magen-backend-container

# Follow backend logs
docker logs -f magen-backend-container

# Stop and remove a container
docker stop magen-backend-container
docker rm magen-backend-container
```

These commands are examples based on recorded names and port mappings. A working deployment also needs environment variables, database connectivity, persistent storage, and a ComfyUI address.

### Docker networking: localhost vs host.docker.internal

Inside a container, `localhost` and `127.0.0.1` refer to that same container. They do not refer to the Windows host and do not automatically refer to another container.

If ComfyUI runs directly on the Windows host while the backend runs in Docker, configure the backend to reach:

`http://host.docker.internal:8188`

If ComfyUI is another container on the same Docker network, use its Docker service/container DNS name and internal port instead.

Likewise, if PostgreSQL is containerized on the same Docker network, the backend JDBC hostname should be the database service name (for example `postgres`), not `localhost`. If PostgreSQL runs directly on the host, use a host-reachable address and ensure PostgreSQL accepts the connection.

### Previously identified Docker gaps

The archive inspected in the earlier discussion did not contain:

- `docker-compose.yml`
- `.dockerignore`

A Compose file would make multi-service configuration repeatable. A `.dockerignore` file would prevent unnecessary files (such as build output, local IDE files, and secrets) from entering the Docker build context. These were identified as gaps, not files confirmed to exist.

## 11. Configuration UI, Google IDX / Firebase Studio, and deployment notes

The earlier documentation request included the cloud development configuration UI and deployment/container configuration. The exact configuration screenshots and final deployed configuration were not available in the recovered files, so this section records the concepts and known distinctions rather than claiming a verified deployment.

A cloud development environment configuration commonly defines:

- **Workspace/runtime image:** base environment and installed tooling.
- **Backend run configuration:** working directory, Maven command, environment variables, and exposed port `8080`.
- **Frontend run configuration:** working directory, npm install/start or build command, and exposed development port `5173`.
- **Database configuration:** PostgreSQL service, database name, credentials, and reachable hostname.
- **ComfyUI configuration:** external/local service URL; a cloud workspace cannot automatically access a ComfyUI server bound only to the developer's Windows loopback interface.
- **Container configuration:** Dockerfile path, build context, image name, exposed container port, environment variables, and persistent storage.
- **Port forwarding / preview:** maps a workspace service port to a browser-accessible preview URL.

Google IDX was renamed into the Firebase Studio product experience. Workspace configuration, app preview, container build, and public deployment are separate concepts. A successful workspace preview does not by itself prove that the application has been deployed as a durable public service or that the ComfyUI host is reachable.

Before deployment, decide where each of the four runtime components lives: frontend, backend, PostgreSQL, and ComfyUI. A local Windows path and `127.0.0.1` URL cannot be carried unchanged into a cloud container.

## 12. Security, reliability, and production-readiness notes

1. **Secrets:** remove real database passwords and API secrets from tracked YAML files. Use environment variables or a secrets manager.
2. **Filesystem paths:** replace the hard-coded Windows output path with a configurable directory.
3. **ComfyUI URL:** externalize the ComfyUI base URL in configuration.
4. **Persistent images:** mount a volume for `generated-images`; otherwise container recreation can discard generated files.
5. **Database persistence:** use a persistent PostgreSQL volume and backups.
6. **Long-running generation:** image generation can take time. Add request timeouts, clear status/error responses, and consider an asynchronous job model for multiple users.
7. **Base64 payload size:** returning image bytes as Base64 inside JSON is simple for a prototype but increases response size. A later design can return an image URL or file endpoint.
8. **Workflow validation:** validate required workflow nodes and inputs before submission.
9. **Schema changes:** use database migrations for controlled schema evolution rather than relying indefinitely on `ddl-auto: update`.
10. **Container orchestration:** add a Compose definition for repeatable local startup and health checks.
11. **CORS and API configuration:** allow only the frontend origins needed by the environment.
12. **Logging:** avoid logging credentials or sensitive user prompts unnecessarily.

## 13. Suggested repository layout

This is a recommended organization, not a claim that every directory currently exists.

```text
MAGEN/
├── README.md
├── MAGEN_DOCUMENTATION.md
├── magen/                         # Spring Boot backend
│   ├── pom.xml
│   ├── Dockerfile
│   └── src/
│       └── main/
│           ├── java/ragdev69/gen/magen/
│           └── resources/
│               ├── application.yaml
│               └── workflow/imgmodel.json
├── frontend/                      # React application (actual folder name to verify)
│   ├── package.json
│   ├── Dockerfile
│   └── src/
├── generated-images/              # Runtime output; persist, do not commit generated bulk data
├── docker-compose.yml             # Recommended; not present in inspected archive
└── .dockerignore                  # Recommended; not present in inspected archive
```

## 14. Known facts vs items requiring repository verification

### Supported by recovered project discussion/source

- Repository: `KingRagnar69/MAGEN`.
- Backend package: `ragdev69.gen.magen`.
- Spring Boot application and Java backend.
- React frontend.
- PostgreSQL database `magen_db`.
- JPA/Hibernate persistence and PostgreSQL JDBC usage.
- ComfyUI workflow resource `workflow/imgmodel.json`.
- Recovered AIService behavior: prompt node 4, seed node 7, submit `/prompt`, poll `/history/{prompt_id}`, download `/view`, save PNG, persist character, return Base64.
- Backend/frontend ports `8080` and `80` in containers; frontend development port `5173`; PostgreSQL `5432`; ComfyUI `8188`.
- Previously inspected Dockerfiles used Maven/Temurin 25 and Node 24 Alpine/Nginx multi-stage builds.
- The inspected archive did not include Compose or `.dockerignore`.
- A schema mismatch involving missing `characters.instance_id` was recorded.

### Verify against the current Git working tree before treating as exact

- The current complete `pom.xml` and exact dependency versions.
- Exact Spring Boot parent version and Java compiler target.
- Every current file and class name.
- Exact controller routes, HTTP verbs, request/response DTOs.
- Current frontend folder name, `package.json`, and API base URL.
- Current Dockerfile contents, image tags, container names, and runtime environment variables.
- Exact cloud workspace configuration and whether a public deployment was completed.
- Current database schema and whether the missing-column issue has been repaired.

## 15. Recommended next documentation update

For a truly file-by-file, line-accurate edition, regenerate this document after comparing it with the current repository files: `pom.xml`, `application.yaml`, all Java controllers/services/entities/repositories, both Dockerfiles, frontend `package.json` and source, and the ComfyUI workflow JSON. The current edition deliberately labels reconstructed examples and does not present them as verified source.
