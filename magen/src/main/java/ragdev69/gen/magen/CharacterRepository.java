package ragdev69.gen.magen;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CharacterRepository
        extends JpaRepository<Character, Long> {

    List<Character> findByInstance_Id(Long instanceId);

    List<Character> findByIdInAndInstance_Id(
            List<Long> ids,
            Long instanceId
    );
}