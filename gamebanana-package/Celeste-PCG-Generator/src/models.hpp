#ifndef CELESTE_PCG_MODELS_HPP
#define CELESTE_PCG_MODELS_HPP

#include <cstdint>
#include <string>
#include <vector>

struct Options {
    std::string mode = "pseudo";
    std::uint32_t seed = 0;
    bool hasSeed = false;
    std::string layout = "grid";
    bool hasLayout = false;
    std::string archetype = "linearAscent";
    int clusterWidth = 2;
    int clusterHeight = 2;
    int roomWidth = 320;
    int roomHeight = 184;
    int roomGap = 16;
    std::string kit = "house";
};

struct Entity {
    std::string name;
    int id = 0;
    int x = 0;
    int y = 0;
    int width = 8;
    int height = 8;
};

struct Room {
    std::string name;
    int x = 0;
    int y = 0;
    int width = 0;
    int height = 0;
    int tileWidth = 0;
    int tileHeight = 0;
    std::string music;
    std::string ambience;
    int color = 0;
    std::vector<char> tilesFg;
    std::vector<char> tilesBg;
    std::vector<Entity> entities;
};

struct ConnectionFlags {
    bool hasLeft = false;
    bool hasRight = false;
    bool hasUp = false;
    bool hasDown = false;
};

struct RoomPaintProfile {
    std::string shellVariant = "default";
    std::string platformVariant = "scattered";
    int textureStride = 5;
    double textureChance = 0.22;
    int supportSpacing = 6;
    bool tallSupports = false;
    int extraPlatformPasses = 0;
};

struct TopologyNode {
    int id;
    int row;
    int column;
    std::string role = "path";
    std::vector<int> connections;
};

struct GeneratedTopology {
    std::vector<TopologyNode> nodes;
    int startId = 0;
    int goalId = 0;
    std::vector<int> mainPath;
    std::string label = "Grid";
};

struct FarthestSearch {
    int id = 0;
    std::vector<int> previous;
};

struct ShortestPathSearch {
    std::vector<int> distance;
    std::vector<int> previous;
};

struct HouseKit {
    std::string id;
    std::string label;
    std::string namePrefix;
    char wallTile;
    char backgroundTile;
    char platformTile;
    char trimTile;
    std::string music;
    std::string ambience;
};

struct ChapterArchetypeProfile {
    std::string id;
    std::string label;
    std::string recommendedLayout;
    std::string preferredOrientation;
    bool hasPreferredOuterReverse = false;
    bool preferredOuterReverse = false;
    bool hasPreferredInnerAlternate = false;
    bool preferredInnerAlternate = false;
};

struct RandomizerMainPath {
    int startId = 0;
    int goalId = 0;
    std::vector<int> path;
};

struct ShortcutCandidate {
    int leftId;
    int rightId;
    double weight;
};

#endif // CELESTE_PCG_MODELS_HPP
