#include "room_renderer.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <string>
#include <vector>

#include "catalog.hpp"

namespace {

void setTile(std::vector<char>& tiles, int tileWidth, int tileHeight, int x, int y, char tile) {
    if (x < 0 || y < 0 || x >= tileWidth || y >= tileHeight) {
        return;
    }
    tiles[static_cast<std::size_t>(y * tileWidth + x)] = tile;
}

void fillRect(std::vector<char>& tiles, int tileWidth, int tileHeight, int x, int y, int width, int height, char tile) {
    for (int offsetY = 0; offsetY < height; ++offsetY) {
        for (int offsetX = 0; offsetX < width; ++offsetX) {
            setTile(tiles, tileWidth, tileHeight, x + offsetX, y + offsetY, tile);
        }
    }
}

RoomPaintProfile buildRoomPaintProfile(const TopologyNode& node, const GeneratedTopology& topology, const ChapterArchetypeProfile& archetype) {
    const std::string phase = describeNodePhase(node, topology);
    RoomPaintProfile profile;

    if (archetype.id == "linearAscent") {
        profile.shellVariant = "stairwell";
        profile.platformVariant = "ascending";
        profile.textureStride = 6;
        profile.supportSpacing = 7;
    } else if (archetype.id == "longRunDensityBurst") {
        const bool denseCenter = phase == "checkpoint" || node.role == "knot";
        profile.shellVariant = denseCenter ? "arena" : "loft";
        profile.platformVariant = denseCenter ? "arena" : "scattered";
        profile.textureChance = 0.28;
        profile.extraPlatformPasses = 1;
    } else if (archetype.id == "spineCompactBranching") {
        profile.shellVariant = "perch";
        profile.platformVariant = "flanks";
        profile.supportSpacing = 8;
    } else if (archetype.id == "landmarkCorridor") {
        profile.shellVariant = "corridor";
        profile.platformVariant = "corridor";
        profile.textureStride = 7;
        profile.supportSpacing = 9;
    } else if (archetype.id == "celesteCategory") {
        profile.shellVariant = (phase == "escalation" || phase == "finale") ? "stairwell" : "loft";
        profile.platformVariant = phase == "build" ? "flanks" : "ascending";
        profile.textureChance = 0.24;
        profile.supportSpacing = 7;
        profile.extraPlatformPasses = 1;
    } else if (archetype.id == "segmentedSummit") {
        profile.shellVariant = (phase == "escalation" || phase == "finale") ? "stairwell" : "loft";
        profile.platformVariant = "ascending";
        profile.textureChance = 0.26;
        profile.tallSupports = true;
    }

    if (node.role == "start" || node.role == "intro") {
        profile.shellVariant = "loft";
        profile.platformVariant = "ascending";
    } else if (node.role == "checkpoint" || node.role == "hub") {
        profile.shellVariant = "arena";
        profile.platformVariant = "arena";
        profile.tallSupports = true;
    } else if (node.role == "branch") {
        profile.shellVariant = "perch";
        profile.platformVariant = "branchPerch";
    } else if (node.role == "reward") {
        profile.shellVariant = "perch";
        profile.platformVariant = "branchPerch";
        profile.textureChance = 0.16;
    } else if (node.role == "setpiece") {
        profile.shellVariant = "corridor";
        profile.platformVariant = "corridor";
        profile.extraPlatformPasses = std::max(profile.extraPlatformPasses, 1);
    } else if (node.role == "knot") {
        profile.shellVariant = "arena";
        profile.platformVariant = "flanks";
        profile.extraPlatformPasses = 1;
    } else if (node.role == "goal") {
        profile.shellVariant = "stairwell";
        profile.platformVariant = "ascending";
        profile.tallSupports = true;
    }

    return profile;
}

void addBackgroundTexture(Room& room, const HouseKit& kit, RandomSource& random, const RoomPaintProfile& profile) {
    for (int y = 1; y < room.tileHeight - 1; ++y) {
        for (int x = 1; x < room.tileWidth - 1; ++x) {
            if (((x + y) % profile.textureStride) == 0 && random.chance(profile.textureChance)) {
                setTile(room.tilesBg, room.tileWidth, room.tileHeight, x, y, kit.trimTile);
            }
        }
    }
}

void paintShell(Room& room, const HouseKit& kit, RandomSource& random, const RoomPaintProfile& profile) {
    std::fill(room.tilesFg.begin(), room.tilesFg.end(), '0');
    fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 0, 0, room.tileWidth, 1, kit.trimTile);
    fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 0, room.tileHeight - 2, room.tileWidth, 2, kit.wallTile);
    fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 0, 0, 1, room.tileHeight, kit.wallTile);
    fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 1, 0, 1, room.tileHeight, kit.wallTile);

    if (profile.shellVariant == "loft") {
        const int loftWidth = std::max(6, static_cast<int>(std::floor(static_cast<double>(room.tileWidth) * 0.38)));
        const int loftX = std::max(2, static_cast<int>(std::floor((room.tileWidth - loftWidth) * 0.5)));
        const int loftY = 3 + random.nextInt(std::max(1, room.tileHeight / 4));
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, loftX, loftY, loftWidth, 1, kit.platformTile);
    } else if (profile.shellVariant == "stairwell") {
        const int stepWidth = std::max(4, room.tileWidth / 5);
        for (int step = 0; step < 3; ++step) {
            const int width = std::max(4, stepWidth - step);
            const int x = 2 + step * std::max(3, std::max(1, (room.tileWidth - stepWidth - 4) / 3));
            const int y = room.tileHeight - 6 - step * 3;
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, x, y, std::min(width, room.tileWidth - x - 2), 1, kit.platformTile);
        }
    } else if (profile.shellVariant == "corridor") {
        const int corridorY = std::max(4, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.45)));
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 2, corridorY, room.tileWidth - 4, 1, kit.platformTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, std::max(3, room.tileWidth / 2 - 3), corridorY, 6, 1, '0');
    } else if (profile.shellVariant == "perch") {
        const int perchWidth = std::max(4, room.tileWidth / 4);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 3, std::max(4, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.35))), perchWidth, 1, kit.platformTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 3 - perchWidth, std::max(6, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.55))), perchWidth, 1, kit.platformTile);
    } else if (profile.shellVariant == "arena") {
        const int middleY = std::max(5, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.5)));
        const int sideWidth = std::max(6, room.tileWidth / 3);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 3, middleY, sideWidth, 1, kit.platformTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 3 - sideWidth, middleY, sideWidth, 1, kit.platformTile);
    }

    if (room.tileWidth > 16) {
        const int inset = 3 + random.nextInt(3);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, inset, room.tileHeight - 6, room.tileWidth - inset * 2, 1, kit.platformTile);
    }

    if (profile.shellVariant == "default" && random.chance(0.55)) {
        const int loftWidth = std::max(6, room.tileWidth / 3);
        const int loftX = 2 + random.nextInt(std::max(1, room.tileWidth - loftWidth - 4));
        const int loftY = 4 + random.nextInt(std::max(1, room.tileHeight / 3));
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, loftX, loftY, loftWidth, 1, kit.platformTile);
    }
}

void carveConnections(Room& room, bool hasLeft, bool hasRight, bool hasUp, bool hasDown) {
    const int midY = static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.65));
    if (hasLeft) {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 0, midY - 4, 1, 4, '0');
    }
    if (hasRight) {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 1, midY - 4, 1, 4, '0');
    }
    if (hasUp) {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth / 2 - 2, 0, 4, 1, '0');
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth / 2 - 1, 1, 2, 2, '0');
    }
    if (hasDown) {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth / 2 - 2, room.tileHeight - 2, 4, 2, '0');
    }

    if (room.tileWidth > 14) {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 2, room.tileHeight - 4, 3, 2, '0');
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 5, room.tileHeight - 4, 3, 2, '0');
    }
}

void addPlatforms(Room& room, const HouseKit& kit, RandomSource& random, const ConnectionFlags& flags, const RoomPaintProfile& profile) {
    const int passes = 1 + profile.extraPlatformPasses;
    for (int pass = 0; pass < passes; ++pass) {
        if (profile.platformVariant == "ascending") {
            for (int step = 0; step < 2; ++step) {
                const int width = std::max(4, room.tileWidth / 5);
                const int x = 3 + step * std::max(4, std::max(1, (room.tileWidth - width - 6) / 2));
                const int y = std::max(4, room.tileHeight - 11 - step * 3 - pass);
                fillRect(room.tilesFg, room.tileWidth, room.tileHeight, x, y, std::min(width, room.tileWidth - x - 2), 1, kit.platformTile);
            }
        } else if (profile.platformVariant == "flanks") {
            const int y = std::max(5, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.42)) + pass * 2);
            const int width = std::max(4, room.tileWidth / 4);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 2, y, width, 1, kit.platformTile);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - width - 2, y + 1, width, 1, kit.platformTile);
        } else if (profile.platformVariant == "branchPerch") {
            const int width = std::max(4, room.tileWidth / 4);
            const bool rightBiased = flags.hasLeft || !flags.hasRight;
            const int x = rightBiased ? room.tileWidth - width - 3 : 3;
            const int y = std::max(4, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.34))) + pass * 2;
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, x, y, width, 1, kit.platformTile);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, std::max(3, room.tileWidth / 2 - 2), y + 4, 4, 1, kit.trimTile);
        } else if (profile.platformVariant == "corridor") {
            const int width = std::max(6, room.tileWidth / 3);
            const int y = std::max(5, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.35)) + pass * 3);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 3, y, width, 1, kit.platformTile);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 3 - width, y + 2, width, 1, kit.platformTile);
        } else if (profile.platformVariant == "arena") {
            const int width = std::max(4, room.tileWidth / 5);
            const int y = std::max(5, static_cast<int>(std::floor(static_cast<double>(room.tileHeight) * 0.3)) + pass * 3);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, std::max(2, room.tileWidth / 2 - width - 1), y, width, 1, kit.platformTile);
            fillRect(room.tilesFg, room.tileWidth, room.tileHeight, std::min(room.tileWidth - width - 2, room.tileWidth / 2 + 1), y, width, 1, kit.platformTile);
        } else {
            const int platformCount = 1 + random.nextInt(3);
            for (int index = 0; index < platformCount; ++index) {
                const int width = 4 + random.nextInt(std::max(2, room.tileWidth / 4));
                const int x = 2 + random.nextInt(std::max(1, room.tileWidth - width - 4));
                const int y = 5 + random.nextInt(std::max(1, room.tileHeight - 11));
                fillRect(room.tilesFg, room.tileWidth, room.tileHeight, x, y, width, 1, kit.platformTile);
                if (random.chance(0.4)) {
                    setTile(room.tilesFg, room.tileWidth, room.tileHeight, x, y - 1, kit.trimTile);
                    setTile(room.tilesFg, room.tileWidth, room.tileHeight, x + width - 1, y - 1, kit.trimTile);
                }
            }
        }
    }
}

void addSupports(Room& room, const HouseKit& kit, RandomSource& random, const RoomPaintProfile& profile) {
    for (int x = 3; x < room.tileWidth - 3; x += profile.supportSpacing) {
        if (random.chance(0.65)) {
            const int top = profile.tallSupports ? 1 : 2;
            const int height = room.tileHeight - (profile.tallSupports ? 2 : 4);
            fillRect(room.tilesBg, room.tileWidth, room.tileHeight, x, top, 1, height, kit.trimTile);
        }
    }
}

void addRoleFeatures(Room& room, const HouseKit& kit, const std::string& role) {
    const int centerX = room.tileWidth / 2 - 2;
    if (role == "checkpoint") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX, room.tileHeight - 8, 5, 1, kit.platformTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX + 1, room.tileHeight - 9, 3, 1, '0');
    } else if (role == "start" || role == "intro") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 2, room.tileHeight - 9, 6, 1, kit.trimTile);
    } else if (role == "hub") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, 3, room.tileHeight / 2, 4, 1, kit.platformTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 7, room.tileHeight / 2 - 2, 4, 1, kit.platformTile);
    } else if (role == "branch") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, room.tileWidth - 7, 5, 4, 1, kit.trimTile);
    } else if (role == "reward") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX, 5, 5, 1, kit.trimTile);
        fillRect(room.tilesBg, room.tileWidth, room.tileHeight, centerX + 1, 3, 3, 1, kit.trimTile);
    } else if (role == "goal") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX, 4, 5, 1, kit.trimTile);
    } else if (role == "setpiece") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX - 3, room.tileHeight / 2, 11, 1, kit.trimTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX - 1, room.tileHeight / 2 - 3, 7, 1, kit.platformTile);
    } else if (role == "knot") {
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX - 2, room.tileHeight / 2 - 3, 9, 1, kit.platformTile);
        fillRect(room.tilesFg, room.tileWidth, room.tileHeight, centerX - 3, room.tileHeight / 2 + 2, 11, 1, kit.trimTile);
    }
}

std::string buildGeneratedRoomName(const TopologyNode& node, const GeneratedTopology& topology, const ChapterArchetypeProfile& archetype) {
    const auto iterator = std::find(topology.mainPath.begin(), topology.mainPath.end(), node.id);
    if (iterator != topology.mainPath.end()) {
        const int pathIndex = static_cast<int>(std::distance(topology.mainPath.begin(), iterator));
        std::ostringstream suffix;
        suffix << std::setw(2) << std::setfill('0') << pathIndex;
        return archetype.id + "_" + node.role + "_" + suffix.str();
    }
    return archetype.id + "_" + node.role + "_" + std::to_string(node.row) + "_" + std::to_string(node.column);
}

} // namespace

std::string describeNodePhase(const TopologyNode& node, const GeneratedTopology& topology) {
    const auto iterator = std::find(topology.mainPath.begin(), topology.mainPath.end(), node.id);
    if (iterator == topology.mainPath.end()) {
        return node.role == "reward" ? "reward" : "branch";
    }

    const int pathIndex = static_cast<int>(std::distance(topology.mainPath.begin(), iterator));
    if (pathIndex == 0) {
        return "intro";
    }
    if (pathIndex == static_cast<int>(topology.mainPath.size()) - 1) {
        return "finale";
    }
    if (pathIndex <= static_cast<int>(std::floor(static_cast<double>(topology.mainPath.size()) / 3.0))) {
        return "build";
    }
    if (pathIndex >= static_cast<int>(std::floor(static_cast<double>(topology.mainPath.size()) * 0.66))) {
        return "escalation";
    }
    return "checkpoint";
}

int getNodeSegment(const TopologyNode& node, const GeneratedTopology& topology) {
    const auto iterator = std::find(topology.mainPath.begin(), topology.mainPath.end(), node.id);
    if (iterator == topology.mainPath.end() || topology.mainPath.size() <= 1) {
        return 0;
    }

    const double numerator = static_cast<double>(std::distance(topology.mainPath.begin(), iterator));
    const double denominator = static_cast<double>(std::max<std::size_t>(1, topology.mainPath.size() - 1));
    return std::min(2, static_cast<int>(std::floor((numerator / denominator) * 3.0)));
}

ConnectionFlags getConnectionFlags(const TopologyNode& node, const Options& options) {
    ConnectionFlags flags;
    const int leftId = node.column > 0 ? node.id - 1 : -1;
    const int rightId = node.column < options.clusterWidth - 1 ? node.id + 1 : -1;
    const int upId = node.row > 0 ? node.id - options.clusterWidth : -1;
    const int downId = node.row < options.clusterHeight - 1 ? node.id + options.clusterWidth : -1;

    for (const int connectionId : node.connections) {
        if (connectionId == leftId) flags.hasLeft = true;
        if (connectionId == rightId) flags.hasRight = true;
        if (connectionId == upId) flags.hasUp = true;
        if (connectionId == downId) flags.hasDown = true;
    }
    return flags;
}

Entity makeEntity(RandomSource& random, std::string name, int x, int y, int width, int height) {
    return Entity{std::move(name), random.nextInt(999999) + 1, x, y, width, height};
}

int getRoleColor(const std::string& role, RandomSource& random) {
    if (role == "start") return 2;
    if (role == "goal") return 7;
    if (role == "checkpoint") return 5;
    if (role == "hub") return 6;
    if (role == "branch") return 1;
    if (role == "intro") return 3;
    if (role == "reward") return 4;
    if (role == "setpiece") return 0;
    if (role == "knot") return 5;
    return random.nextInt(8);
}

Room makeRoom(const HouseKit& kit, RandomSource& random, const Options& options,
              const TopologyNode& node, const GeneratedTopology& topology,
              const ChapterArchetypeProfile& archetype) {
    Room room;
    room.name = buildGeneratedRoomName(node, topology, archetype);
    room.x = node.column * (options.roomWidth + options.roomGap);
    room.y = node.row * (options.roomHeight + options.roomGap);
    room.width = options.roomWidth;
    room.height = options.roomHeight;
    room.tileWidth = options.roomWidth / 8;
    room.tileHeight = options.roomHeight / 8;
    room.music = kit.music;
    room.ambience = kit.ambience;
    room.color = getRoleColor(node.role, random);
    room.tilesFg.assign(static_cast<std::size_t>(room.tileWidth * room.tileHeight), '0');
    room.tilesBg.assign(static_cast<std::size_t>(room.tileWidth * room.tileHeight), kit.backgroundTile);

    const RoomPaintProfile profile = buildRoomPaintProfile(node, topology, archetype);
    addBackgroundTexture(room, kit, random, profile);
    paintShell(room, kit, random, profile);
    const ConnectionFlags flags = getConnectionFlags(node, options);
    carveConnections(room, flags.hasLeft, flags.hasRight, flags.hasUp, flags.hasDown);
    addPlatforms(room, kit, random, flags, profile);
    addRoleFeatures(room, kit, node.role);
    addSupports(room, kit, random, profile);

    return room;
}
