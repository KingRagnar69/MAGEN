package ragdev69.gen.magen;

import java.time.LocalDateTime;
import java.util.List;

public final class ApiDtos {

    private ApiDtos() {
    }

    public record CreateInstanceRequest(String name) {}

    public record InstanceSummary(
            Long id,
            String name,
            LocalDateTime createdAt,
            int characterCount,
            int panelCount
    ) {}
    public record CharacterGenerationRequest(
            String name,
            String description,
            String negativePrompt
    ) {}
    public record CharacterDto(
            Long id,
            String name,
            String description,
            String negativePrompt,
            String image,
            LocalDateTime createdAt
    ) {}

    public record PanelDto(
            Long id,
            String prompt,
            List<String> characters,
            String image,
            LocalDateTime createdAt
    ) {}

    public record InstanceDetails(
            Long id,
            String name,
            LocalDateTime createdAt,
            List<CharacterDto> characters,
            List<PanelDto> panels
    ) {}

    public record GeneratedImageDto(
            String image,
            String imagePath
    ) {}

    public record SaveCharacterRequest(
            Long instanceId,
            String name,
            String description,
            String negativePrompt,
            String imagePath
    ) {}

    public record MangaGenerationRequest(
            Long instanceId,
            String prompt,
            List<Long> characterIds
    ) {}

    public record SavePanelRequest(
            Long instanceId,
            String prompt,
            String imagePath,
            List<Long> characterIds
    ) {}
}