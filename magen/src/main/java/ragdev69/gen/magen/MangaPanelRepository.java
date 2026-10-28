package ragdev69.gen.magen;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MangaPanelRepository
        extends JpaRepository<MangaPanel, Long> {

    List<MangaPanel> findByInstance_IdOrderByCreatedAtDesc(
            Long instanceId
    );
}