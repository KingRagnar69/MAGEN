MAGEN — brief explanation of each file
1. Spring Boot backend — Java files
File	What it does
AIController.java	Exposes the AI-related REST API endpoints. Receives requests from the React frontend, such as character name and description, and forwards them to AIService.
AIService.java	Contains the main AI-generation logic. Loads the ComfyUI workflow, modifies prompts and seed values, sends requests to ComfyUI, retrieves generated images, saves them, and stores character information through the repository.
API DTOs	Data Transfer Objects define the structure of data exchanged through API requests and responses. They keep API data separate from database entity classes.
Character.java	JPA entity representing a character in the database. Maps Java fields such as ID, name, description and image path to the characters table.
CharacterRepository.java	Provides database operations for Character. Extends Spring Data JPA's JpaRepository, so common CRUD operations are available without writing SQL manually.
HelloController.java	Provides a basic test or health-check endpoint, such as GET /api/hello, to check whether the Spring Boot backend is responding.
ImageController.java	Handles image-related HTTP requests, such as exposing or retrieving generated images. Its exact responsibilities depend on the endpoint implementations in the file.
MagenApplication.java	Main Spring Boot application class. Its main() method starts the application and initializes Spring Boot components, configuration and embedded Tomcat.
MangaInstance.java	JPA entity representing a manga project or manga instance. Stores the information associated with a particular manga.
MangaInstanceController.java	Exposes REST API endpoints for creating, retrieving or managing manga instances.
MangaInstanceRepository.java	Handles database access for MangaInstance using Spring Data JPA.
MangaPanel.java	JPA entity representing an individual manga panel and its associated information.
MangaPanelRepository.java	Handles database operations for manga panels through Spring Data JPA.

2. Backend configuration and AI workflow files
File	What it does
application.yml	Stores Spring Boot configuration, including the server port, PostgreSQL datasource settings, Hibernate/JPA configuration and other application properties.
Dockerfile	Defines how Docker builds the Spring Boot backend image. It uses Maven to compile and package the application, then copies the generated JAR into a Java runtime image.
imgmodel.json	Contains the exported ComfyUI API workflow. It defines the image-generation nodes, model inputs, prompts, checkpoint and connections used to generate artwork.
workflow.json	If this is a separate workflow file in the project, it serves as a workflow configuration/input for the AI generation process. Its exact purpose depends on its contents and whether the Java service actually loads it.

ComfyUI workflow and API: ComfyUI is the image-generation engine; it runs the workflow described by the JSON file. The backend communicates with its API rather than generating images itself.

The general process is:
1. AIService loads the workflow JSON.
2. It modifies the relevant workflow nodes, such as the positive prompt and random seed.
3. It submits the workflow to ComfyUI through its API.
4. ComfyUI processes the workflow and generates an image.
5. The backend retrieves the generated image and saves it locally.
6. The generated image information can then be associated with a character in PostgreSQL.
3. Frontend — React and TypeScript files
File	What it does
App.tsx	Main React application component. Contains the primary MAGEN interface and handles user interactions, including submitting character-generation requests to the Spring Boot backend.
App.css	Contains component-specific styling for the main application interface, including layout, spacing, colours and visual elements.
index.css	Contains global CSS styles applied across the frontend, such as default fonts, body styling, margins and general layout rules.
main.tsx	Frontend entry point. Mounts the React application into the HTML page using React's root-rendering mechanism.
Dockerfile	Defines how Docker builds and serves the React frontend. It uses Node.js to install dependencies and build the production frontend, then copies the build output into an Nginx image to serve it.

4. Docker and application ports
These are the main ports used in the project:
Component	Port	Purpose
React frontend	5173 locally / 80 in its Nginx container	User interface
Spring Boot backend	8080	REST API
PostgreSQL	5432	Database
ComfyUI	8188	AI image-generation API

The Dockerfiles describe how to package the frontend and backend into separate images. They do not, by themselves, start PostgreSQL or ComfyUI. Those services need to be running separately or defined in a Docker Compose configuration.

5. Overall file interaction
React frontend

App.tsx · App.css · index.css · main.tsx

HTTP request — POST /api/ai/characters

Spring Boot backend

AIController.java → AIService.java

Workflow submission and image retrieval

ComfyUI

imgmodel.json → image generation


PostgreSQL

Entities and repositories


Generated images

Local image storage




The main distinction to remember is:
- Controller: receives and responds to HTTP requests.
- Service: implements the application's business logic.
- DTO: defines the structure of API data.
- Entity: represents a database table.
- Repository: communicates with the database.
- Configuration: defines how the application and its services run.
- Dockerfile: defines how an application is packaged into a container.
