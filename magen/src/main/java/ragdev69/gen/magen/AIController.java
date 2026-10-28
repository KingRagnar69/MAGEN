package ragdev69.gen.magen;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "http://localhost:5173")
public class AIController {

    private final AIService aiService;

    public AIController(AIService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/characters")
    public ApiDtos.GeneratedImageDto generateCharacter(
            @RequestBody ApiDtos.CharacterGenerationRequest request
    ) {
        return aiService.generateCharacter(
                request.name(),
                request.description(),
                request.negativePrompt()
        );
    }

    @PostMapping("/characters/save")
    public ApiDtos.CharacterDto saveCharacter(
            @RequestBody ApiDtos.SaveCharacterRequest request
    ) {
        return aiService.saveCharacter(request);
    }

    @PostMapping("/manga")
    public ApiDtos.GeneratedImageDto generateMangaPanel(
            @RequestBody ApiDtos.MangaGenerationRequest request
    ) {
        return aiService.generateMangaPanel(
                request.instanceId(),
                request.prompt(),
                request.characterIds()
        );
    }

    @PostMapping("/manga/save")
    public ApiDtos.PanelDto saveMangaPanel(
            @RequestBody ApiDtos.SavePanelRequest request
    ) {
        return aiService.savePanel(request);
    }
}