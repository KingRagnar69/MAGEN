package ragdev69.gen.magen;

import jakarta.persistence.*;

@Entity
@Table(name = "characters")
public class Character {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String negativePrompt;

    @Column(nullable = false)
    private String imagePath;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "instance_id", nullable = false)
    private MangaInstance instance;

    public Character() {
    }

    public Character(
            String name,
            String description,
            String imagePath
    ) {
        this.name = name;
        this.description = description;
        this.imagePath = imagePath;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getNegativePrompt() {
        return negativePrompt;
    }

    public String getImagePath() {
        return imagePath;
    }

    public MangaInstance getInstance() {
        return instance;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public void setNegativePrompt(String negativePrompt) {
        this.negativePrompt = negativePrompt;
    }

    public void setImagePath(String imagePath) {
        this.imagePath = imagePath;
    }

    public void setInstance(MangaInstance instance) {
        this.instance = instance;
    }
}