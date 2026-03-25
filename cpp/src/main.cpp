#include <algorithm>
#include <cstdint>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <iomanip>
#include <iostream>
#include <limits>
#include <set>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

#include <pcg_random.hpp>

namespace {

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
    int id;
    int x;
    int y;
    int width = 8;
    int height = 8;
};

struct Room {
    std::string name;
    int x;
    int y;
    int width;
    int height;
    int tileWidth;
    int tileHeight;
    std::string music;
    std::string ambience;
    int color;
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

std::string escapeJson(std::string_view value);
std::string describeNodePhase(const TopologyNode& node, const GeneratedTopology& topology);

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

class RandomSource {
public:
    explicit RandomSource(const Options& options)
        : mode_(options.mode) {
        if (mode_ == "pseudo") {
            const std::uint64_t seed = options.hasSeed ? options.seed : 0u;
            pcg_.seed(seed, 0xda3e39cb94b95bdbULL);
            label_ = "seed=" + std::to_string(seed);
        } else {
            std::random_device device;
            trueSeed_ = (static_cast<std::uint64_t>(device()) << 32u) ^ static_cast<std::uint64_t>(device());
            engine_.seed(static_cast<std::mt19937::result_type>(trueSeed_ & 0xffffffffULL));
            std::ostringstream stream;
            stream << "crypto=" << std::hex << trueSeed_;
            label_ = stream.str();
        }
    }

    int nextInt(int upperExclusive) {
        if (upperExclusive <= 0) {
            throw std::runtime_error("upperExclusive must be positive");
        }

        if (mode_ == "pseudo") {
            std::uniform_int_distribution<int> distribution(0, upperExclusive - 1);
            return distribution(pcg_);
        }

        std::uniform_int_distribution<int> distribution(0, upperExclusive - 1);
        return distribution(engine_);
    }

    bool chance(double probability) {
        if (mode_ == "pseudo") {
            std::uniform_real_distribution<double> distribution(0.0, 1.0);
            return distribution(pcg_) < probability;
        }

        std::uniform_real_distribution<double> distribution(0.0, 1.0);
        return distribution(engine_) < probability;
    }

    template <typename T>
    const T& pickOne(const std::vector<T>& items) {
        if (items.empty()) {
            throw std::runtime_error("items must not be empty");
        }
        return items[static_cast<std::size_t>(nextInt(static_cast<int>(items.size())))];
    }

    const std::string& label() const {
        return label_;
    }

private:
    std::string mode_;
    std::string label_;
    pcg32 pcg_;
    std::mt19937 engine_;
    std::uint64_t trueSeed_ = 0u;
};

const std::vector<HouseKit> kHouseKits = {
    {"house", "House Kit", "house", '9', '1', 'a', '5', "resort", "event:/env/amb/04_main"},
    {"resort", "Resort Kit", "resort", '7', '6', '4', '5', "resort", "event:/env/amb/03_resort"},
    {"cliffside", "Cliffside Kit", "cliff", 'b', '8', '9', 'f', "cliffside", "event:/env/amb/02_awake"},
    {"kirby", "Kirby Kit", "kirby", 'c', '3', 'd', 'e', "lvl1", "event:/env/amb/01_main"},
    {"mario", "Mario Kit", "mario", '2', '4', '6', '8', "oldsite", "event:/env/amb/01_main"},
    {"metroidvania", "Metroidvania Kit", "metro", 'f', '2', '7', 'b', "temple", "event:/env/amb/05_mirror"},
    {"labybirth", "Labybirth Kit", "laby", '6', '1', '5', '9', "resort", "event:/env/amb/03_resort"},
    {"pizzatower", "Pizza Tower Kit", "pizza", 'd', '5', 'a', 'c', "mirror", "event:/env/amb/02_awake"},
    {"arcade", "Arcade Kit", "arcade", '3', '8', 'e', '4', "reflection", "event:/env/amb/05_mirror"},
};

const std::vector<ChapterArchetypeProfile> kChapterArchetypes = {
    {"linearAscent", "Linear Ascent", "criticalPath", "vertical", true, false, true, false},
    {"longRunDensityBurst", "Long Run With Density Burst", "criticalPathBranches", "horizontal", true, false, true, true},
    {"spineCompactBranching", "Spine With Compact Branching", "criticalPathBranches", "", false, false, false, false},
    {"landmarkCorridor", "Landmark Corridor", "criticalPath", "horizontal", true, false, true, false},
    {"celesteCategory", "Celeste Category", "criticalPathBranches", "vertical", true, false, true, true},
    {"segmentedSummit", "Segmented Summit", "criticalPath", "vertical", true, false, true, true},
};

const HouseKit& findKit(const std::string& id) {
    const auto iterator = std::find_if(kHouseKits.begin(), kHouseKits.end(), [&](const HouseKit& kit) {
        return kit.id == id;
    });
    return iterator != kHouseKits.end() ? *iterator : kHouseKits.front();
}

const ChapterArchetypeProfile& findArchetype(const std::string& id) {
    const auto iterator = std::find_if(kChapterArchetypes.begin(), kChapterArchetypes.end(), [&](const ChapterArchetypeProfile& archetype) {
        return archetype.id == id;
    });
    return iterator != kChapterArchetypes.end() ? *iterator : kChapterArchetypes.front();
}

Options parseOptions(int argc, char** argv) {
    Options options;
    for (int index = 1; index < argc; index += 2) {
        if (index + 1 >= argc) {
            throw std::runtime_error("missing value for argument");
        }

        const std::string key = argv[index];
        const std::string value = argv[index + 1];

        if (key == "--mode") {
            options.mode = value;
        } else if (key == "--layout") {
            options.layout = value;
            options.hasLayout = true;
        } else if (key == "--archetype") {
            options.archetype = value;
        } else if (key == "--seed") {
            options.seed = static_cast<std::uint32_t>(std::stoul(value));
            options.hasSeed = true;
        } else if (key == "--cluster-width") {
            options.clusterWidth = std::stoi(value);
        } else if (key == "--cluster-height") {
            options.clusterHeight = std::stoi(value);
        } else if (key == "--room-width") {
            options.roomWidth = std::stoi(value);
        } else if (key == "--room-height") {
            options.roomHeight = std::stoi(value);
        } else if (key == "--room-gap") {
            options.roomGap = std::stoi(value);
        } else if (key == "--kit") {
            options.kit = value;
        } else {
            throw std::runtime_error("unknown argument: " + key);
        }
    }

    if (options.clusterWidth <= 0 || options.clusterHeight <= 0 || options.roomWidth <= 0 || options.roomHeight <= 0) {
        throw std::runtime_error("cluster and room dimensions must be positive");
    }

    if (!options.hasLayout) {
        options.layout = findArchetype(options.archetype).recommendedLayout;
    }

    return options;
}

bool hasConnection(const TopologyNode& node, int neighborId) {
    return std::find(node.connections.begin(), node.connections.end(), neighborId) != node.connections.end();
}

void connectNodes(std::vector<TopologyNode>& nodes, int leftId, int rightId) {
    if (leftId == rightId) {
        return;
    }
    if (!hasConnection(nodes[leftId], rightId)) {
        nodes[leftId].connections.push_back(rightId);
    }
    if (!hasConnection(nodes[rightId], leftId)) {
        nodes[rightId].connections.push_back(leftId);
    }
}

std::vector<TopologyNode> createTopologyNodes(const Options& options) {
    std::vector<TopologyNode> nodes;
    int id = 0;
    for (int row = 0; row < options.clusterHeight; ++row) {
        for (int column = 0; column < options.clusterWidth; ++column) {
            nodes.push_back(TopologyNode{id, row, column});
            ++id;
        }
    }
    return nodes;
}

std::vector<int> getOrthogonalNeighborIds(int nodeId, const Options& options) {
    const int row = nodeId / options.clusterWidth;
    const int column = nodeId % options.clusterWidth;
    std::vector<int> neighbors;

    if (column > 0) {
        neighbors.push_back(nodeId - 1);
    }
    if (column < options.clusterWidth - 1) {
        neighbors.push_back(nodeId + 1);
    }
    if (row > 0) {
        neighbors.push_back(nodeId - options.clusterWidth);
    }
    if (row < options.clusterHeight - 1) {
        neighbors.push_back(nodeId + options.clusterWidth);
    }

    return neighbors;
}

std::vector<int> range(int length, bool reversed) {
    std::vector<int> values;
    values.reserve(static_cast<std::size_t>(length));
    for (int i = 0; i < length; ++i) {
        values.push_back(i);
    }
    if (reversed) {
        std::reverse(values.begin(), values.end());
    }
    return values;
}

std::vector<int> createSerpentinePath(const Options& options, RandomSource& random, const ChapterArchetypeProfile& archetype) {
    std::vector<int> path;
    const bool horizontal = !archetype.preferredOrientation.empty()
        ? archetype.preferredOrientation == "horizontal"
        : random.chance(0.5);
    const bool reverseOuter = archetype.hasPreferredOuterReverse ? archetype.preferredOuterReverse : random.chance(0.5);
    const bool reverseInnerStart = archetype.hasPreferredInnerAlternate ? archetype.preferredInnerAlternate : random.chance(0.5);

    if (horizontal) {
        const std::vector<int> rows = range(options.clusterHeight, reverseOuter);
        for (std::size_t rowIndex = 0; rowIndex < rows.size(); ++rowIndex) {
            const bool reverseInner = reverseInnerStart ? (rowIndex % 2 == 0) : (rowIndex % 2 == 1);
            const std::vector<int> columns = range(options.clusterWidth, reverseInner);
            for (const int column : columns) {
                path.push_back(rows[rowIndex] * options.clusterWidth + column);
            }
        }
    } else {
        const std::vector<int> columns = range(options.clusterWidth, reverseOuter);
        for (std::size_t columnIndex = 0; columnIndex < columns.size(); ++columnIndex) {
            const bool reverseInner = reverseInnerStart ? (columnIndex % 2 == 0) : (columnIndex % 2 == 1);
            const std::vector<int> rows = range(options.clusterHeight, reverseInner);
            for (const int row : rows) {
                path.push_back(row * options.clusterWidth + columns[columnIndex]);
            }
        }
    }

    return path;
}

void assignArchetypeSpecificRoles(std::vector<TopologyNode>& nodes, const std::vector<int>& mainPath, const ChapterArchetypeProfile& archetype) {
    if (mainPath.size() < 4) {
        return;
    }

    if (archetype.id == "linearAscent") {
        if (mainPath.size() >= 6) {
            nodes[mainPath[mainPath.size() - 2]].role = "setpiece";
        }
        return;
    }

    if (archetype.id == "longRunDensityBurst") {
        const std::size_t knotIndex = std::max<std::size_t>(2, mainPath.size() / 2 - 1);
        nodes[mainPath[knotIndex]].role = "knot";
        if (mainPath.size() >= 7) {
            const std::size_t setpieceIndex = std::min(mainPath.size() - 2, knotIndex + 1);
            nodes[mainPath[setpieceIndex]].role = "setpiece";
        }
        return;
    }

    if (archetype.id == "spineCompactBranching") {
        const auto iterator = std::find_if(mainPath.begin(), mainPath.end(), [&](int nodeId) {
            return nodes[static_cast<std::size_t>(nodeId)].connections.size() >= 3;
        });
        if (iterator != mainPath.end()) {
            nodes[static_cast<std::size_t>(*iterator)].role = "hub";
        }
        return;
    }

    if (archetype.id == "landmarkCorridor") {
        const std::size_t index = std::max<std::size_t>(2, static_cast<std::size_t>(std::floor(static_cast<double>(mainPath.size()) * 0.66)));
        nodes[mainPath[std::min(index, mainPath.size() - 1)]].role = "setpiece";
        return;
    }

    if (archetype.id == "celesteCategory") {
        const std::size_t checkpointIndex = mainPath.size() / 2;
        std::size_t knotIndex = std::max<std::size_t>(2, static_cast<std::size_t>(std::floor(static_cast<double>(mainPath.size()) * 0.38)));
        if (knotIndex == checkpointIndex) {
            knotIndex = std::max<std::size_t>(2, checkpointIndex - 1);
        }

        const auto iterator = std::find_if(mainPath.begin(), mainPath.end(), [&](int nodeId) {
            const auto index = static_cast<std::size_t>(std::distance(mainPath.begin(), std::find(mainPath.begin(), mainPath.end(), nodeId)));
            return index >= 2 && index < mainPath.size() - 2 && nodes[static_cast<std::size_t>(nodeId)].connections.size() >= 3;
        });

        const std::size_t hubIndex = iterator != mainPath.end()
            ? static_cast<std::size_t>(std::distance(mainPath.begin(), iterator))
            : std::max<std::size_t>(2, static_cast<std::size_t>(std::floor(static_cast<double>(mainPath.size()) * 0.28)));
        const std::size_t setpieceIndex = std::min(mainPath.size() - 2, std::max(checkpointIndex + 1, static_cast<std::size_t>(std::floor(static_cast<double>(mainPath.size()) * 0.76))));

        nodes[mainPath[hubIndex]].role = "hub";
        if (mainPath.size() >= 7) {
            nodes[mainPath[knotIndex]].role = "knot";
        }
        if (mainPath.size() >= 8) {
            nodes[mainPath[setpieceIndex]].role = "setpiece";
        }
        return;
    }

    if (archetype.id == "segmentedSummit") {
        const std::size_t index = std::max<std::size_t>(2, static_cast<std::size_t>(std::floor(static_cast<double>(mainPath.size()) * 0.75)));
        nodes[mainPath[std::min(index, mainPath.size() - 1)]].role = "setpiece";
    }
}

void assignPathRoles(std::vector<TopologyNode>& nodes, const std::vector<int>& mainPath, const ChapterArchetypeProfile& archetype) {
    for (auto& node : nodes) {
        node.role = "path";
    }
    if (mainPath.empty()) {
        return;
    }

    nodes[mainPath.front()].role = "start";
    nodes[mainPath.back()].role = "goal";
    if (mainPath.size() >= 4) {
        nodes[mainPath[1]].role = "intro";
    }
    if (mainPath.size() >= 5) {
        nodes[mainPath[mainPath.size() / 2]].role = "checkpoint";
    }

    assignArchetypeSpecificRoles(nodes, mainPath, archetype);
}

void assignSkeletonRoles(std::vector<TopologyNode>& nodes, const std::vector<int>& mainPath, const ChapterArchetypeProfile& archetype) {
    std::set<int> mainPathIds(mainPath.begin(), mainPath.end());
    for (auto& node : nodes) {
        if (node.connections.size() >= 3) {
            node.role = "hub";
        } else if (mainPathIds.find(node.id) == mainPathIds.end()) {
            node.role = node.connections.size() <= 1 ? "reward" : "branch";
        } else {
            node.role = "path";
        }
    }

    if (!mainPath.empty()) {
        nodes[mainPath.front()].role = "start";
        nodes[mainPath.back()].role = "goal";
        if (mainPath.size() >= 5) {
            nodes[mainPath[mainPath.size() / 2]].role = "checkpoint";
        }
    }

    assignArchetypeSpecificRoles(nodes, mainPath, archetype);
}

void pushFrontierEdges(std::vector<std::pair<int, int>>& frontier, int nodeId, const std::vector<bool>& visited, const Options& options) {
    for (const int neighborId : getOrthogonalNeighborIds(nodeId, options)) {
        if (!visited[static_cast<std::size_t>(neighborId)]) {
            frontier.emplace_back(nodeId, neighborId);
        }
    }
}

FarthestSearch findFarthestNode(const std::vector<TopologyNode>& nodes, int startId) {
    std::vector<int> previous(nodes.size(), -1);
    std::vector<int> distance(nodes.size(), -1);
    std::vector<int> queue = {startId};
    std::size_t cursor = 0;
    distance[static_cast<std::size_t>(startId)] = 0;
    int farthestId = startId;

    while (cursor < queue.size()) {
        const int currentId = queue[cursor++];
        const int currentDistance = distance[static_cast<std::size_t>(currentId)];
        if (currentDistance > distance[static_cast<std::size_t>(farthestId)]) {
            farthestId = currentId;
        }

        for (const int neighborId : nodes[static_cast<std::size_t>(currentId)].connections) {
            if (distance[static_cast<std::size_t>(neighborId)] != -1) {
                continue;
            }
            distance[static_cast<std::size_t>(neighborId)] = currentDistance + 1;
            previous[static_cast<std::size_t>(neighborId)] = currentId;
            queue.push_back(neighborId);
        }
    }

    return FarthestSearch{farthestId, previous};
}

std::vector<int> reconstructPath(const std::vector<int>& previous, int startId, int goalId) {
    std::vector<int> path;
    int currentId = goalId;
    while (currentId != -1) {
        path.push_back(currentId);
        if (currentId == startId) {
            break;
        }
        currentId = previous[static_cast<std::size_t>(currentId)];
    }
    std::reverse(path.begin(), path.end());
    return path;
}

GeneratedTopology buildGridTopology(const Options& options, RandomSource& random, const ChapterArchetypeProfile& archetype) {
    GeneratedTopology topology;
    topology.nodes = createTopologyNodes(options);
    for (auto& node : topology.nodes) {
        for (const int neighborId : getOrthogonalNeighborIds(node.id, options)) {
            connectNodes(topology.nodes, node.id, neighborId);
        }
    }
    topology.mainPath = createSerpentinePath(options, random, archetype);
    assignPathRoles(topology.nodes, topology.mainPath, archetype);
    topology.startId = topology.mainPath.front();
    topology.goalId = topology.mainPath.back();
    topology.label = "Grid";
    return topology;
}

int getBranchLayoutMainPathLength(const Options& options, int totalRooms, const ChapterArchetypeProfile& archetype) {
    const int baseLength = options.clusterWidth + options.clusterHeight + static_cast<int>(std::floor(static_cast<double>(totalRooms) * 0.15));
    double archetypeBias = 1.0;
    if (archetype.id == "longRunDensityBurst") {
        archetypeBias = 1.15;
    } else if (archetype.id == "spineCompactBranching") {
        archetypeBias = 0.9;
    } else if (archetype.id == "landmarkCorridor") {
        archetypeBias = 0.85;
    } else if (archetype.id == "celesteCategory") {
        archetypeBias = 1.05;
    } else if (archetype.id == "segmentedSummit") {
        archetypeBias = 1.05;
    }

    const int targetLength = static_cast<int>(std::round(static_cast<double>(baseLength) * archetypeBias));
    return std::max(2, std::min(totalRooms - 1, targetLength));
}

GeneratedTopology buildCriticalPathTopology(const Options& options, RandomSource& random, bool withBranches, const ChapterArchetypeProfile& archetype) {
    GeneratedTopology topology;
    topology.nodes = createTopologyNodes(options);
    const std::vector<int> serpentinePath = createSerpentinePath(options, random, archetype);
    const int mainPathLength = withBranches
        ? getBranchLayoutMainPathLength(options, static_cast<int>(serpentinePath.size()), archetype)
        : static_cast<int>(serpentinePath.size());
    topology.mainPath.assign(serpentinePath.begin(), serpentinePath.begin() + mainPathLength);

    for (int index = 0; index < static_cast<int>(topology.mainPath.size()) - 1; ++index) {
        connectNodes(topology.nodes, topology.mainPath[static_cast<std::size_t>(index)], topology.mainPath[static_cast<std::size_t>(index + 1)]);
    }

    if (withBranches) {
        std::set<int> connectedIds(topology.mainPath.begin(), topology.mainPath.end());
        for (std::size_t index = static_cast<std::size_t>(mainPathLength); index < serpentinePath.size(); ++index) {
            const int nodeId = serpentinePath[index];
            std::vector<int> candidates;
            for (const int neighborId : getOrthogonalNeighborIds(nodeId, options)) {
                if (connectedIds.find(neighborId) != connectedIds.end()) {
                    candidates.push_back(neighborId);
                }
            }

            std::sort(candidates.begin(), candidates.end(), [&](int leftId, int rightId) {
                return topology.nodes[static_cast<std::size_t>(leftId)].connections.size() < topology.nodes[static_cast<std::size_t>(rightId)].connections.size();
            });

            int targetId = topology.mainPath[static_cast<std::size_t>(random.nextInt(static_cast<int>(topology.mainPath.size())))];
            for (const int candidateId : candidates) {
                if (std::find(topology.mainPath.begin(), topology.mainPath.end(), candidateId) != topology.mainPath.end()) {
                    targetId = candidateId;
                    break;
                }
                targetId = candidateId;
            }

            connectNodes(topology.nodes, nodeId, targetId);
            connectedIds.insert(nodeId);
        }
    }

    assignPathRoles(topology.nodes, topology.mainPath, archetype);
    if (withBranches) {
        for (auto& node : topology.nodes) {
            if (std::find(topology.mainPath.begin(), topology.mainPath.end(), node.id) == topology.mainPath.end()) {
                node.role = node.connections.size() <= 1 ? "reward" : "branch";
            }
        }
        assignArchetypeSpecificRoles(topology.nodes, topology.mainPath, archetype);
    }

    topology.startId = topology.mainPath.front();
    topology.goalId = topology.mainPath.back();
    topology.label = withBranches ? "Critical Path + Branches" : "Critical Path";
    return topology;
}

GeneratedTopology buildOpenSkeletonTopology(const Options& options, RandomSource& random, const ChapterArchetypeProfile& archetype) {
    GeneratedTopology topology;
    topology.nodes = createTopologyNodes(options);
    const int totalNodes = static_cast<int>(topology.nodes.size());
    const int rootId = random.nextInt(totalNodes);
    std::vector<bool> visited(static_cast<std::size_t>(totalNodes), false);
    std::vector<std::pair<int, int>> frontier;
    visited[static_cast<std::size_t>(rootId)] = true;
    pushFrontierEdges(frontier, rootId, visited, options);

    while (std::count(visited.begin(), visited.end(), true) < totalNodes && !frontier.empty()) {
        const int edgeIndex = random.nextInt(static_cast<int>(frontier.size()));
        const auto edge = frontier[static_cast<std::size_t>(edgeIndex)];
        frontier.erase(frontier.begin() + edgeIndex);
        if (visited[static_cast<std::size_t>(edge.second)]) {
            continue;
        }

        connectNodes(topology.nodes, edge.first, edge.second);
        visited[static_cast<std::size_t>(edge.second)] = true;
        pushFrontierEdges(frontier, edge.second, visited, options);
    }

    const int extraEdges = std::max(1, totalNodes / 4);
    int addedEdges = 0;
    int attempts = 0;
    while (addedEdges < extraEdges && attempts < totalNodes * 10) {
        ++attempts;
        const int nodeId = random.nextInt(totalNodes);
        std::vector<int> candidates;
        for (const int neighborId : getOrthogonalNeighborIds(nodeId, options)) {
            if (!hasConnection(topology.nodes[static_cast<std::size_t>(nodeId)], neighborId)) {
                candidates.push_back(neighborId);
            }
        }
        if (candidates.empty()) {
            continue;
        }
        connectNodes(topology.nodes, nodeId, random.pickOne(candidates));
        ++addedEdges;
    }

    const FarthestSearch fromRoot = findFarthestNode(topology.nodes, rootId);
    const FarthestSearch fromStart = findFarthestNode(topology.nodes, fromRoot.id);
    topology.startId = fromRoot.id;
    topology.goalId = fromStart.id;
    topology.mainPath = reconstructPath(fromStart.previous, topology.startId, topology.goalId);
    assignSkeletonRoles(topology.nodes, topology.mainPath, archetype);
    topology.label = "Open Skeleton";
    return topology;
}

GeneratedTopology buildTopology(const Options& options, RandomSource& random) {
    const ChapterArchetypeProfile& archetype = findArchetype(options.archetype);
    if (options.layout == "criticalPath") {
        return buildCriticalPathTopology(options, random, false, archetype);
    }
    if (options.layout == "criticalPathBranches") {
        return buildCriticalPathTopology(options, random, true, archetype);
    }
    if (options.layout == "openSkeleton") {
        return buildOpenSkeletonTopology(options, random, archetype);
    }
    return buildGridTopology(options, random, archetype);
}

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

Entity makeEntity(RandomSource& random, std::string name, int x, int y, int width = 8, int height = 8) {
    return Entity{std::move(name), random.nextInt(999999) + 1, x, y, width, height};
}

int getRoleColor(const std::string& role, RandomSource& random) {
    if (role == "start") {
        return 2;
    }
    if (role == "goal") {
        return 7;
    }
    if (role == "checkpoint") {
        return 5;
    }
    if (role == "hub") {
        return 6;
    }
    if (role == "branch") {
        return 1;
    }
    if (role == "intro") {
        return 3;
    }
    if (role == "reward") {
        return 4;
    }
    if (role == "setpiece") {
        return 0;
    }
    if (role == "knot") {
        return 5;
    }
    return random.nextInt(8);
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

std::string previewMetadataJson(const GeneratedTopology& topology, const std::vector<Room>& rooms, const Options& options) {
    std::ostringstream stream;
    stream << '"' << "previewMetadata" << '"' << ":{";
    stream << "\"layoutMode\":\"" << escapeJson(options.layout) << "\",";
    stream << "\"archetype\":\"" << escapeJson(options.archetype) << "\",";
    stream << "\"startNodeId\":" << topology.startId << ',';
    stream << "\"goalNodeId\":" << topology.goalId << ',';
    stream << "\"mainPathNodeIds\":[";
    for (std::size_t index = 0; index < topology.mainPath.size(); ++index) {
        if (index > 0) {
            stream << ',';
        }
        stream << topology.mainPath[index];
    }
    stream << "],\"nodes\":[";

    for (std::size_t index = 0; index < topology.nodes.size(); ++index) {
        if (index > 0) {
            stream << ',';
        }

        const TopologyNode& node = topology.nodes[index];
        const Room& room = rooms[static_cast<std::size_t>(node.id)];
        stream << '{'
               << "\"id\":" << node.id << ','
               << "\"roomName\":\"" << escapeJson(room.name) << "\"," 
               << "\"row\":" << node.row << ','
               << "\"column\":" << node.column << ','
               << "\"role\":\"" << escapeJson(node.role) << "\"," 
               << "\"connections\":[";

        for (std::size_t connectionIndex = 0; connectionIndex < node.connections.size(); ++connectionIndex) {
            if (connectionIndex > 0) {
                stream << ',';
            }
            stream << node.connections[connectionIndex];
        }

        stream << "],\"phase\":\"" << escapeJson(describeNodePhase(node, topology)) << "\",";
        stream << "\"segment\":" << getNodeSegment(node, topology) << '}';
    }

    stream << "]}";
    return stream.str();
}

ConnectionFlags getConnectionFlags(const TopologyNode& node, const Options& options) {
    ConnectionFlags flags;
    const int leftId = node.column > 0 ? node.id - 1 : -1;
    const int rightId = node.column < options.clusterWidth - 1 ? node.id + 1 : -1;
    const int upId = node.row > 0 ? node.id - options.clusterWidth : -1;
    const int downId = node.row < options.clusterHeight - 1 ? node.id + options.clusterWidth : -1;

    flags.hasLeft = leftId != -1 && hasConnection(node, leftId);
    flags.hasRight = rightId != -1 && hasConnection(node, rightId);
    flags.hasUp = upId != -1 && hasConnection(node, upId);
    flags.hasDown = downId != -1 && hasConnection(node, downId);
    return flags;
}

std::string escapeJson(std::string_view value) {
    std::ostringstream stream;
    for (const char character : value) {
        switch (character) {
            case '\\': stream << "\\\\"; break;
            case '"': stream << "\\\""; break;
            case '\n': stream << "\\n"; break;
            case '\r': stream << "\\r"; break;
            case '\t': stream << "\\t"; break;
            default: stream << character; break;
        }
    }
    return stream.str();
}

std::string tileRowsJson(const std::vector<char>& tiles, int tileWidth, int tileHeight) {
    std::ostringstream stream;
    stream << '[';
    for (int y = 0; y < tileHeight; ++y) {
        if (y > 0) {
            stream << ',';
        }
        stream << '"';
        for (int x = 0; x < tileWidth; ++x) {
            stream << tiles[static_cast<std::size_t>(y * tileWidth + x)];
        }
        stream << '"';
    }
    stream << ']';
    return stream.str();
}

std::string roomJson(const Room& room) {
    std::ostringstream stream;
    stream << '{'
           << "\"name\":\"" << escapeJson(room.name) << "\"," 
           << "\"x\":" << room.x << ','
           << "\"y\":" << room.y << ','
           << "\"width\":" << room.width << ','
           << "\"height\":" << room.height << ','
           << "\"tileWidth\":" << room.tileWidth << ','
           << "\"tileHeight\":" << room.tileHeight << ','
           << "\"music\":\"" << escapeJson(room.music) << "\"," 
           << "\"musicLayer1\":true,\"musicLayer2\":true,\"musicLayer3\":true,\"musicLayer4\":true,"
           << "\"altMusic\":\"\",\"ambience\":\"" << escapeJson(room.ambience) << "\"," 
           << "\"dark\":false,\"underwater\":false,\"space\":false,\"disableDownTransition\":false,"
           << "\"cameraOffsetX\":0,\"cameraOffsetY\":0,\"windPattern\":\"None\",\"color\":" << room.color << ','
           << "\"tilesFg\":{" 
           << "\"width\":" << room.tileWidth << ",\"height\":" << room.tileHeight << ",\"tiles\":" << tileRowsJson(room.tilesFg, room.tileWidth, room.tileHeight) << "},"
           << "\"tilesBg\":{" 
           << "\"width\":" << room.tileWidth << ",\"height\":" << room.tileHeight << ",\"tiles\":" << tileRowsJson(room.tilesBg, room.tileWidth, room.tileHeight) << "},"
           << "\"objTiles\":null,"
           << "\"entities\":[";

    for (std::size_t index = 0; index < room.entities.size(); ++index) {
        if (index > 0) {
            stream << ',';
        }
        const Entity& entity = room.entities[index];
        stream << '{'
               << "\"name\":\"" << escapeJson(entity.name) << "\"," 
               << "\"id\":" << entity.id << ','
               << "\"x\":" << entity.x << ','
               << "\"y\":" << entity.y << ','
               << "\"width\":" << entity.width << ",\"height\":" << entity.height << ",\"nodes\":[],\"attributes\":{}"
               << '}';
    }

    stream << "],\"triggers\":[],\"decalsFg\":[],\"decalsBg\":[]}";
    return stream.str();
}

Room makeRoom(const HouseKit& kit, RandomSource& random, const Options& options, const TopologyNode& node, const GeneratedTopology& topology, const ChapterArchetypeProfile& archetype) {
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

} // namespace

int main(int argc, char** argv) {
    try {
        const Options options = parseOptions(argc, argv);
        const HouseKit& kit = findKit(options.kit);
        const ChapterArchetypeProfile& archetype = findArchetype(options.archetype);
        RandomSource random(options);
        const GeneratedTopology topology = buildTopology(options, random);

        std::vector<Room> rooms(topology.nodes.size());
        for (const TopologyNode& node : topology.nodes) {
            rooms[static_cast<std::size_t>(node.id)] = makeRoom(kit, random, options, node, topology, archetype);
        }

        if (!rooms.empty()) {
            rooms[static_cast<std::size_t>(topology.startId)].entities.push_back(makeEntity(random, "player", 24, options.roomHeight - 32));
            rooms[static_cast<std::size_t>(topology.goalId)].entities.push_back(makeEntity(random, "strawberry", options.roomWidth - 48, 40));
            if (rooms[static_cast<std::size_t>(topology.goalId)].tileWidth > 18) {
                rooms[static_cast<std::size_t>(topology.goalId)].entities.push_back(makeEntity(random, "spring", options.roomWidth - 72, options.roomHeight - 32));
            }

            for (const TopologyNode& node : topology.nodes) {
                if (node.id == topology.startId || node.id == topology.goalId) {
                    continue;
                }

                Room& room = rooms[static_cast<std::size_t>(node.id)];
                if (node.role == "checkpoint") {
                    room.entities.push_back(makeEntity(random, "checkpoint", options.roomWidth / 2, options.roomHeight - 32));
                    room.entities.push_back(makeEntity(random, "refill", options.roomWidth / 2, std::max(40, static_cast<int>(std::floor(static_cast<double>(options.roomHeight) * 0.34)))));
                } else if (node.role == "intro") {
                    room.entities.push_back(makeEntity(random, "spring", static_cast<int>(std::floor(static_cast<double>(options.roomWidth) * 0.28)), options.roomHeight - 32));
                } else if (node.role == "reward" && random.chance(0.8)) {
                    room.entities.push_back(makeEntity(random, "strawberry", options.roomWidth / 2, 40));
                    room.entities.push_back(makeEntity(random, "refill", options.roomWidth / 2, std::max(56, static_cast<int>(std::floor(static_cast<double>(options.roomHeight) * 0.42)))));
                } else if (node.role == "branch" && random.chance(0.2)) {
                    room.entities.push_back(makeEntity(random, "strawberry", options.roomWidth / 2, 40));
                    room.entities.push_back(makeEntity(random, "spring", static_cast<int>(std::floor(static_cast<double>(options.roomWidth) * 0.72)), options.roomHeight - 32));
                } else if (node.role == "hub" && random.chance(0.75)) {
                    room.entities.push_back(makeEntity(random, "spring", options.roomWidth / 2, options.roomHeight - 32));
                    room.entities.push_back(makeEntity(random, "refill", options.roomWidth / 2, std::max(48, static_cast<int>(std::floor(static_cast<double>(options.roomHeight) * 0.36)))));
                } else if (node.role == "setpiece" && random.chance(0.7)) {
                    room.entities.push_back(makeEntity(random, "spring", options.roomWidth / 2, options.roomHeight - 32));
                    room.entities.push_back(makeEntity(random, "spikesDown", options.roomWidth / 2 - 20, 24, 40, 8));
                } else if (node.role == "knot" && random.chance(0.7)) {
                    room.entities.push_back(makeEntity(random, "refill", options.roomWidth / 2, std::max(48, static_cast<int>(std::floor(static_cast<double>(options.roomHeight) * 0.38)))));
                    room.entities.push_back(makeEntity(random, "spikesRight", 12, options.roomHeight / 2 - 16, 8, 32));
                    room.entities.push_back(makeEntity(random, "spikesLeft", options.roomWidth - 20, options.roomHeight / 2 - 16, 8, 32));
                }
            }
        }

        std::sort(rooms.begin(), rooms.end(), [](const Room& left, const Room& right) {
            return left.y < right.y || (left.y == right.y && left.x < right.x);
        });

        std::ostringstream output;
        output << '{'
               << "\"summary\":\"Generated " << topology.nodes.size() << ' ' << escapeJson(kit.label)
             << " rooms in " << escapeJson(topology.label) << " mode using the " << escapeJson(archetype.label)
             << " archetype with " << (options.mode == "pseudo" ? "Pseudo Randomizer" : "True Randomizer") << " via native C++\"," 
               << "\"seedLabel\":\"" << escapeJson(random.label()) << "\"," 
             << "\"rooms\":[";

        for (std::size_t index = 0; index < rooms.size(); ++index) {
            if (index > 0) {
                output << ',';
            }
            output << roomJson(rooms[index]);
        }

        output << "]," << previewMetadataJson(topology, rooms, options) << '}';
        std::cout << output.str();
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what();
        return 1;
    }
}