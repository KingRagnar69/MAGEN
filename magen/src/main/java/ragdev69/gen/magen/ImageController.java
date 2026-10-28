package ragdev69.gen.magen;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/images")
@CrossOrigin(origins = "http://localhost:5173")
public class ImageController {

    private final AIService aiService;

    public ImageController(AIService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/{filename}")
    public ResponseEntity<Resource> getImage(
            @PathVariable String filename
    ) throws IOException {
        Path imageFile = aiService.getImageFile(filename);

        String contentType = Files.probeContentType(imageFile);

        if (contentType == null
                || !contentType.startsWith("image/")) {
            contentType = MediaType.IMAGE_PNG_VALUE;
        }

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .body(new FileSystemResource(imageFile));
    }
}