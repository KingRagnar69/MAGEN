
package ragdev69.gen.magen;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class AIService {

    @Value("${comfyui.url:http://127.0.0.1:8188}")
    private String comfyuiUrl;

    private static final Path IMAGE_DIRECTORY =
            Paths.get("C:\\Users\\ronak\\MAGEN\\generated-images")
                    .toAbsolutePath()
                    .normalize();

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    private final MangaInstanceRepository instanceRepository;
    private final CharacterRepository characterRepository;
    private final MangaPanelRepository panelRepository;

    public AIService(
            MangaInstanceRepository instanceRepository,
            CharacterRepository characterRepository,
            MangaPanelRepository panelRepository
    ) {
        this.instanceRepository = instanceRepository;
        this.characterRepository = characterRepository;
        this.panelRepository = panelRepository;
    }

    public ApiDtos.GeneratedImageDto generateCharacter(
            String name,
            String description,
            String negativePrompt
    ) {
        String positive = "Character name: " + name
                + ". Character description: " + description
                + ". Manga character illustration.";

        return generateImage(
                positive,
                negativePrompt,
                "character"
        );
    }

    public ApiDtos.GeneratedImageDto generateMangaPanel(
            Long instanceId,
            String scenePrompt,
            List<Long> characterIds
    ) {
        MangaInstance instance = instanceRepository.findById(instanceId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Manga instance not found: " + instanceId
                        )
                );

        if (characterIds == null || characterIds.isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one saved character."
            );
        }

        List<Character> characters =
                characterRepository.findByIdInAndInstance_Id(
                        characterIds,
                        instanceId
                );

        if (characters.size() != characterIds.stream().distinct().count()) {
            throw new IllegalArgumentException(
                    "One or more selected characters do not belong "
                            + "to this manga instance."
            );
        }

        StringBuilder positive = new StringBuilder();
        positive.append("Manga panel illustration. ");
        positive.append("Manga project: ")
                .append(instance.getName()).append(". ");
        positive.append("Scene: ").append(scenePrompt).append(". ");
        positive.append("Characters in this scene: ");

        for (Character character : characters) {
            positive.append(character.getName()).append(": ")
                    .append(character.getDescription()).append(". ");
        }

        positive.append(
                "Keep character descriptions consistent. "
                        + "Japanese manga art style."
        );

        return generateImage(
                positive.toString(),
                "blurry, low quality, bad anatomy, extra fingers, "
                        + "deformed hands, duplicate characters",
                "panel"
        );
    }

    public ApiDtos.CharacterDto saveCharacter(
            ApiDtos.SaveCharacterRequest request
    ) {
        requireText(request.name(), "Character name");
        requireText(request.description(), "Character description");

        MangaInstance instance = instanceRepository
                .findById(request.instanceId())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Manga instance not found."
                        )
                );

        Path imageFile = validateGeneratedImage(request.imagePath());

        Character character = new Character(
                request.name().trim(),
                request.description().trim(),
                imageFile.toString()
        );

        character.setNegativePrompt(
                request.negativePrompt() == null
                        ? ""
                        : request.negativePrompt().trim()
        );
        character.setInstance(instance);

        Character saved = characterRepository.save(character);

        return toCharacterDto(saved);
    }

    public ApiDtos.PanelDto savePanel(
            ApiDtos.SavePanelRequest request
    ) {
        requireText(request.prompt(), "Scene description");

        MangaInstance instance = instanceRepository
                .findById(request.instanceId())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Manga instance not found."
                        )
                );

        Path imageFile = validateGeneratedImage(request.imagePath());

        if (request.characterIds() == null
                || request.characterIds().isEmpty()) {
            throw new IllegalArgumentException(
                    "Select at least one character."
            );
        }

        List<Character> characters =
                characterRepository.findByIdInAndInstance_Id(
                        request.characterIds(),
                        request.instanceId()
                );

        if (characters.size()
                != request.characterIds().stream().distinct().count()) {
            throw new IllegalArgumentException(
                    "One or more characters do not belong "
                            + "to this instance."
            );
        }

        MangaPanel panel = new MangaPanel();
        panel.setInstance(instance);
        panel.setPrompt(request.prompt().trim());
        panel.setImagePath(imageFile.toString());
        panel.setCreatedAt(LocalDateTime.now());
        panel.setCharacters(characters);

        MangaPanel saved = panelRepository.save(panel);

        return toPanelDto(saved);
    }

    public ApiDtos.CharacterDto toCharacterDto(Character character) {
        return new ApiDtos.CharacterDto(
                character.getId(),
                character.getName(),
                character.getDescription(),
                character.getNegativePrompt(),
                imageUrl(character.getImagePath()),
                null
        );
    }

    public ApiDtos.PanelDto toPanelDto(MangaPanel panel) {
        List<String> names = panel.getCharacters()
                .stream()
                .map(Character::getName)
                .toList();

        return new ApiDtos.PanelDto(
                panel.getId(),
                panel.getPrompt(),
                names,
                imageUrl(panel.getImagePath()),
                panel.getCreatedAt()
        );
    }

    public String imageUrl(String imagePath) {
        String filename = Paths.get(imagePath)
                .getFileName()
                .toString();

        return "/api/images/" + filename;
    }

    public Path getImageFile(String filename) {
        if (filename == null
                || filename.isBlank()
                || !Paths.get(filename).getFileName().toString()
                .equals(filename)) {
            throw new IllegalArgumentException("Invalid image filename.");
        }

        Path file = IMAGE_DIRECTORY.resolve(filename)
                .normalize();

        if (!file.startsWith(IMAGE_DIRECTORY)
                || !Files.isRegularFile(file)) {
            throw new IllegalArgumentException("Image not found.");
        }

        return file;
    }

    private Path validateGeneratedImage(String imagePath) {
        if (imagePath == null || imagePath.isBlank()) {
            throw new IllegalArgumentException(
                    "Generate an image before saving."
            );
        }

        Path requested = Paths.get(imagePath)
                .toAbsolutePath()
                .normalize();

        if (!requested.startsWith(IMAGE_DIRECTORY)
                || !Files.isRegularFile(requested)) {
            throw new IllegalArgumentException(
                    "The generated image file does not exist "
                            + "in the MAGEN image directory."
            );
        }

        return requested;
    }

    private void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    fieldName + " is required."
            );
        }
    }

    private ApiDtos.GeneratedImageDto generateImage(
            String positivePrompt,
            String negativePrompt,
            String filenamePrefix
    ) {
        try (InputStream inputStream =
                     getClass().getResourceAsStream(
                             "/workflow/imgmodel.json"
                     )) {

            if (inputStream == null) {
                throw new IllegalStateException(
                        "Workflow not found at "
                                + "src/main/resources/workflow/imgmodel.json"
                );
            }

            JsonNode workflow = objectMapper.readTree(inputStream);

            setWorkflowText(workflow, "4", positivePrompt);
            setWorkflowText(
                    workflow,
                    "6",
                    negativePrompt == null ? "" : negativePrompt
            );

            JsonNode samplerInputs = workflow.path("7").path("inputs");

            if (!(samplerInputs instanceof ObjectNode)) {
                throw new IllegalStateException(
                        "Workflow node 7 or its inputs are missing."
                );
            }

            long seed = ThreadLocalRandom.current()
                    .nextLong(0, 1125899906842624L);

            ((ObjectNode) samplerInputs).put("seed", seed);

            ObjectNode requestBody = objectMapper.createObjectNode();
            requestBody.set("prompt", workflow);

            HttpRequest submitRequest = HttpRequest.newBuilder()
                    .uri(URI.create(comfyuiUrl + "/prompt"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(
                            objectMapper.writeValueAsString(requestBody)
                    ))
                    .build();

            HttpResponse<String> submitResponse = httpClient.send(
                    submitRequest,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (submitResponse.statusCode() < 200
                    || submitResponse.statusCode() >= 300) {
                throw new IllegalStateException(
                        "ComfyUI returned HTTP "
                                + submitResponse.statusCode()
                                + ": " + submitResponse.body()
                );
            }

            JsonNode result = objectMapper.readTree(
                    submitResponse.body()
            );

            JsonNode promptIdNode = result.get("prompt_id");

            if (promptIdNode == null || promptIdNode.isNull()) {
                throw new IllegalStateException(
                        "ComfyUI did not return a prompt ID: "
                                + submitResponse.body()
                );
            }

            String promptId = promptIdNode.asText();
            long deadline = System.currentTimeMillis() + 180_000;
            JsonNode imageNode = null;

            while (System.currentTimeMillis() < deadline) {
                String encodedId = URLEncoder.encode(
                        promptId,
                        StandardCharsets.UTF_8
                );

                HttpRequest historyRequest = HttpRequest.newBuilder()
                        .uri(URI.create(
                                comfyuiUrl + "/history/" + encodedId
                        ))
                        .GET()
                        .build();

                HttpResponse<String> historyResponse = httpClient.send(
                        historyRequest,
                        HttpResponse.BodyHandlers.ofString()
                );

                if (historyResponse.statusCode() >= 200
                        && historyResponse.statusCode() < 300) {
                    JsonNode history = objectMapper.readTree(
                            historyResponse.body()
                    );

                    JsonNode promptHistory = history.path(promptId);
                    JsonNode status = promptHistory.path("status");

                    if ("error".equals(
                            status.path("status_str").asText())) {
                        throw new IllegalStateException(
                                "ComfyUI failed: " + status
                        );
                    }

                    JsonNode outputs = promptHistory.path("outputs");

                    if (outputs.isObject()) {
                        imageNode = findFirstImage(outputs);
                    }

                    if (imageNode != null) {
                        break;
                    }
                }

                Thread.sleep(1000);
            }

            if (imageNode == null) {
                throw new IllegalStateException(
                        "Timed out waiting for ComfyUI."
                );
            }

            String filename = imageNode.path("filename").asText();
            String subfolder = imageNode.path("subfolder").asText();
            String type = imageNode.path("type").asText("output");

            String imageUrl = comfyuiUrl + "/view?filename="
                    + URLEncoder.encode(filename, StandardCharsets.UTF_8)
                    + "&subfolder="
                    + URLEncoder.encode(subfolder, StandardCharsets.UTF_8)
                    + "&type="
                    + URLEncoder.encode(type, StandardCharsets.UTF_8);

            HttpRequest imageRequest = HttpRequest.newBuilder()
                    .uri(URI.create(imageUrl))
                    .GET()
                    .build();

            HttpResponse<byte[]> imageResponse = httpClient.send(
                    imageRequest,
                    HttpResponse.BodyHandlers.ofByteArray()
            );

            if (imageResponse.statusCode() < 200
                    || imageResponse.statusCode() >= 300) {
                throw new IllegalStateException(
                        "Could not retrieve image from ComfyUI. HTTP "
                                + imageResponse.statusCode()
                );
            }

            Files.createDirectories(IMAGE_DIRECTORY);

            String safeFilename = filenamePrefix + "_"
                    + System.currentTimeMillis() + "_"
                    + ThreadLocalRandom.current()
                    .nextInt(1000, 10000)
                    + ".png";

            Path imageFile = IMAGE_DIRECTORY.resolve(safeFilename)
                    .normalize();

            Files.write(imageFile, imageResponse.body());

            String base64 = Base64.getEncoder()
                    .encodeToString(imageResponse.body());

            return new ApiDtos.GeneratedImageDto(
                    "data:image/png;base64," + base64,
                    imageFile.toString()
            );

        } catch (IOException e) {
            throw new IllegalStateException(
                    "Failed to read the workflow, save the image, "
                            + "or communicate with ComfyUI.",
                    e
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(
                    "The request to ComfyUI was interrupted.",
                    e
            );
        }
    }

    private void setWorkflowText(
            JsonNode workflow,
            String nodeId,
            String text
    ) {
        JsonNode inputs = workflow.path(nodeId).path("inputs");

        if (!(inputs instanceof ObjectNode)) {
            throw new IllegalStateException(
                    "Workflow node " + nodeId
                            + " or its inputs are missing."
            );
        }

        ((ObjectNode) inputs).put("text", text);
    }

    private JsonNode findFirstImage(JsonNode outputs) {
        var nodes = outputs.fields();

        while (nodes.hasNext()) {
            var node = nodes.next();
            JsonNode images = node.getValue().path("images");

            if (images.isArray() && !images.isEmpty()) {
                JsonNode image = images.get(0);

                if (image.hasNonNull("filename")) {
                    return image;
                }
            }
        }

        return null;
    }
}
