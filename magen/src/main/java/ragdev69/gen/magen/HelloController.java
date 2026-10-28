
package ragdev69.gen.magen;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class HelloController {

    @GetMapping("/api/hello")
    public String hello() {
        return "Hello from Spring Boot!";
    }

    @PostMapping("/api/characters")
    public String generateCharacter(@RequestBody CharacterRequest request) {
        return "Character request received! Name: "
                + request.name()
                + ", Description: "
                + request.description();
    }

    public record CharacterRequest(String name, String description) {
    }
}
