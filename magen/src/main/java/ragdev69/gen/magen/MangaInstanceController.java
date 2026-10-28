package ragdev69.gen.magen;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/instances")
@CrossOrigin(origins = "http://localhost:5173")
public class MangaInstanceController {

    private final MangaInstanceRepository instanceRepository;
    private final CharacterRepository characterRepository;
    private final MangaPanelRepository panelRepository;
    private final AIService aiService;

    public MangaInstanceController(
            MangaInstanceRepository instanceRepository,
            CharacterRepository characterRepository,
            MangaPanelRepository panelRepository,
            AIService aiService
    ) {
        this.instanceRepository = instanceRepository;
        this.characterRepository = characterRepository;
        this.panelRepository = panelRepository;
        this.aiService = aiService;
    }

    @GetMapping
    public List<ApiDtos.InstanceSummary> getInstances() {
        return instanceRepository.findAll()
                .stream()
                .map(instance -> new ApiDtos.InstanceSummary(
                        instance.getId(),
                        instance.getName(),
                        instance.getCreatedAt(),
                        characterRepository
                                .findByInstance_Id(instance.getId()).size(),
                        panelRepository
                                .findByInstance_IdOrderByCreatedAtDesc(
                                        instance.getId()
                                ).size()
                ))
                .toList();
    }

    @PostMapping
    public ApiDtos.InstanceSummary createInstance(
            @RequestBody ApiDtos.CreateInstanceRequest request
    ) {
        if (request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException(
                    "Manga instance name is required."
            );
        }

        MangaInstance instance = instanceRepository.save(
                new MangaInstance(request.name().trim())
        );

        return new ApiDtos.InstanceSummary(
                instance.getId(),
                instance.getName(),
                instance.getCreatedAt(),
                0,
                0
        );
    }

    @GetMapping("/{id}")
    public ApiDtos.InstanceDetails getInstance(
            @PathVariable Long id
    ) {
        MangaInstance instance = instanceRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Manga instance not found."
                        )
                );

        List<ApiDtos.CharacterDto> characters =
                characterRepository.findByInstance_Id(id)
                        .stream()
                        .map(aiService::toCharacterDto)
                        .toList();

        List<ApiDtos.PanelDto> panels =
                panelRepository.findByInstance_IdOrderByCreatedAtDesc(id)
                        .stream()
                        .map(aiService::toPanelDto)
                        .toList();

        return new ApiDtos.InstanceDetails(
                instance.getId(),
                instance.getName(),
                instance.getCreatedAt(),
                characters,
                panels
        );
    }
}