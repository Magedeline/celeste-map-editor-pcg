#include "topology.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <set>
#include <vector>

#include "catalog.hpp"

namespace {

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
    nodes.reserve(static_cast<std::size_t>(options.clusterWidth * options.clusterHeight));
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
    neighbors.reserve(4);

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

bool isBoundaryNode(const TopologyNode& node, const Options& options) {
    return node.row == 0
        || node.column == 0
        || node.row == options.clusterHeight - 1
        || node.column == options.clusterWidth - 1;
}

bool isPreferredStartBoundary(const TopologyNode& node, const Options& options, const ChapterArchetypeProfile& archetype) {
    if (archetype.preferredOrientation == "horizontal") {
        return node.column == 0;
    }
    return node.row == 0 || (options.clusterHeight <= 2 && node.column == 0);
}

int pickRandomizerStartNode(const std::vector<TopologyNode>& nodes, RandomSource& random, const Options& options, const ChapterArchetypeProfile& archetype) {
    std::vector<int> candidates;
    for (const auto& node : nodes) {
        if (isPreferredStartBoundary(node, options, archetype)) {
            candidates.push_back(node.id);
        }
    }

    if (candidates.empty()) {
        for (const auto& node : nodes) {
            if (isBoundaryNode(node, options)) {
                candidates.push_back(node.id);
            }
        }
    }

    if (candidates.empty()) {
        return 0;
    }

    return random.pickOne(candidates);
}

double scoreRandomizerFrontierEdge(
    const std::pair<int, int>& edge,
    const std::vector<TopologyNode>& nodes,
    const Options& options,
    const ChapterArchetypeProfile& archetype,
    int rootId
) {
    const TopologyNode& to = nodes[static_cast<std::size_t>(edge.second)];
    const TopologyNode& from = nodes[static_cast<std::size_t>(edge.first)];
    const TopologyNode& root = nodes[static_cast<std::size_t>(rootId)];
    const int primaryDistance = archetype.preferredOrientation == "horizontal"
        ? std::abs(to.column - root.column)
        : std::abs(to.row - root.row);
    const int secondaryDistance = archetype.preferredOrientation == "horizontal"
        ? std::abs(to.row - root.row)
        : std::abs(to.column - root.column);
    const double leafBias = from.connections.size() <= 1 ? 1.4 : 0.6;
    const double boundaryBias = isBoundaryNode(to, options) ? 0.35 : 0.0;
    return 1.0 + primaryDistance * 2.4 + secondaryDistance * 0.9 + leafBias + boundaryBias;
}

int pickRandomizerFrontierEdge(
    const std::vector<std::pair<int, int>>& frontier,
    const std::vector<TopologyNode>& nodes,
    RandomSource& random,
    const Options& options,
    const ChapterArchetypeProfile& archetype,
    int rootId
) {
    std::vector<double> weights;
    weights.reserve(frontier.size());
    double totalWeight = 0.0;

    for (const auto& edge : frontier) {
        const double weight = scoreRandomizerFrontierEdge(edge, nodes, options, archetype, rootId)
            + static_cast<double>(random.nextInt(1000)) / 1000.0 * 0.35;
        weights.push_back(weight);
        totalWeight += weight;
    }

    double cursor = static_cast<double>(random.nextInt(1000000)) / 1000000.0 * std::max(totalWeight, 0.0001);
    for (std::size_t index = 0; index < weights.size(); ++index) {
        cursor -= weights[index];
        if (cursor <= 0.0) {
            return static_cast<int>(index);
        }
    }

    return frontier.empty() ? 0 : static_cast<int>(frontier.size() - 1);
}

ShortestPathSearch findShortestPaths(const std::vector<TopologyNode>& nodes, int startId) {
    ShortestPathSearch search;
    search.distance.assign(nodes.size(), -1);
    search.previous.assign(nodes.size(), -1);

    std::vector<int> queue = {startId};
    std::size_t cursor = 0;
    search.distance[static_cast<std::size_t>(startId)] = 0;

    while (cursor < queue.size()) {
        const int currentId = queue[cursor++];
        const int currentDistance = search.distance[static_cast<std::size_t>(currentId)];

        for (const int neighborId : nodes[static_cast<std::size_t>(currentId)].connections) {
            if (search.distance[static_cast<std::size_t>(neighborId)] != -1) {
                continue;
            }

            search.distance[static_cast<std::size_t>(neighborId)] = currentDistance + 1;
            search.previous[static_cast<std::size_t>(neighborId)] = currentId;
            queue.push_back(neighborId);
        }
    }

    return search;
}

double scoreRandomizerEndpointPair(
    const TopologyNode& start,
    const TopologyNode& goal,
    const Options& options,
    const ChapterArchetypeProfile& archetype
) {
    const int rowSpread = std::abs(goal.row - start.row);
    const int columnSpread = std::abs(goal.column - start.column);
    const int primarySpread = archetype.preferredOrientation == "horizontal" ? columnSpread : rowSpread;
    const int secondarySpread = archetype.preferredOrientation == "horizontal" ? rowSpread : columnSpread;
    const int boundaryBonus = (isBoundaryNode(start, options) ? 1 : 0) + (isBoundaryNode(goal, options) ? 1 : 0);
    return primarySpread * 14.0 + secondarySpread * 4.0 + boundaryBonus * 6.0;
}

RandomizerMainPath selectRandomizerMainPath(
    const std::vector<TopologyNode>& nodes,
    const Options& options,
    const ChapterArchetypeProfile& archetype
) {
    std::vector<int> candidates;
    for (const auto& node : nodes) {
        if (node.connections.size() <= 1) {
            candidates.push_back(node.id);
        }
    }

    if (candidates.size() < 2) {
        candidates.clear();
        for (const auto& node : nodes) {
            candidates.push_back(node.id);
        }
    }

    RandomizerMainPath best;
    if (candidates.empty()) {
        best.path = {0};
        return best;
    }

    double bestScore = -std::numeric_limits<double>::infinity();
    best.startId = candidates.front();
    best.goalId = candidates.back();
    best.path = {best.startId};

    for (std::size_t leftIndex = 0; leftIndex < candidates.size(); ++leftIndex) {
        const int startId = candidates[leftIndex];
        const ShortestPathSearch search = findShortestPaths(nodes, startId);
        for (std::size_t rightIndex = leftIndex + 1; rightIndex < candidates.size(); ++rightIndex) {
            const int goalId = candidates[rightIndex];
            const int distance = search.distance[static_cast<std::size_t>(goalId)];
            if (distance < 0) {
                continue;
            }

            const double score = distance * 100.0 + scoreRandomizerEndpointPair(
                nodes[static_cast<std::size_t>(startId)],
                nodes[static_cast<std::size_t>(goalId)],
                options,
                archetype
            );

            if (score <= bestScore) {
                continue;
            }

            bestScore = score;
            best.startId = startId;
            best.goalId = goalId;
            best.path = reconstructPath(search.previous, startId, goalId);
        }
    }

    return best;
}

std::vector<ShortcutCandidate> collectRandomizerShortcutCandidates(
    const std::vector<TopologyNode>& nodes,
    const Options& options,
    const ChapterArchetypeProfile& archetype,
    const std::vector<int>& mainPath
) {
    std::vector<int> pathIndex(nodes.size(), -1);
    for (std::size_t index = 0; index < mainPath.size(); ++index) {
        pathIndex[static_cast<std::size_t>(mainPath[index])] = static_cast<int>(index);
    }

    std::vector<ShortcutCandidate> candidates;
    for (const auto& node : nodes) {
        for (const int neighborId : getOrthogonalNeighborIds(node.id, options)) {
            if (neighborId <= node.id || hasConnection(node, neighborId)) {
                continue;
            }

            const TopologyNode& neighbor = nodes[static_cast<std::size_t>(neighborId)];
            const int leftPathIndex = pathIndex[static_cast<std::size_t>(node.id)];
            const int rightPathIndex = pathIndex[static_cast<std::size_t>(neighborId)];
            const int primaryGap = archetype.preferredOrientation == "horizontal"
                ? std::abs(node.column - neighbor.column)
                : std::abs(node.row - neighbor.row);

            double weight = 1.0 + primaryGap;
            if (leftPathIndex >= 0 && rightPathIndex >= 0) {
                weight += std::abs(leftPathIndex - rightPathIndex) > 1 ? 4.0 : 1.0;
            } else if (leftPathIndex >= 0 || rightPathIndex >= 0) {
                weight += 3.0;
            }
            if (node.connections.size() <= 2) {
                weight += 0.8;
            }
            if (neighbor.connections.size() <= 2) {
                weight += 0.8;
            }

            candidates.push_back({node.id, neighborId, weight});
        }
    }

    return candidates;
}

void addRandomizerShortcutEdges(
    std::vector<TopologyNode>& nodes,
    const Options& options,
    RandomSource& random,
    const ChapterArchetypeProfile& archetype,
    const std::vector<int>& mainPath
) {
    const int targetExtraEdges = std::max(1, static_cast<int>(nodes.size()) / 6);
    int addedEdges = 0;
    int attempts = 0;

    while (addedEdges < targetExtraEdges && attempts < static_cast<int>(nodes.size()) * 12) {
        ++attempts;
        const std::vector<ShortcutCandidate> candidates = collectRandomizerShortcutCandidates(nodes, options, archetype, mainPath);
        if (candidates.empty()) {
            break;
        }

        double totalWeight = 0.0;
        for (const auto& candidate : candidates) {
            totalWeight += candidate.weight;
        }

        double cursor = static_cast<double>(random.nextInt(1000000)) / 1000000.0 * std::max(totalWeight, 0.0001);
        ShortcutCandidate selected = candidates.back();
        for (const auto& candidate : candidates) {
            cursor -= candidate.weight;
            if (cursor <= 0.0) {
                selected = candidate;
                break;
            }
        }

        connectNodes(nodes, selected.leftId, selected.rightId);
        ++addedEdges;
    }
}

GeneratedTopology buildCelesteRandomizerTopology(const Options& options, RandomSource& random, const ChapterArchetypeProfile& archetype) {
    GeneratedTopology topology;
    topology.nodes = createTopologyNodes(options);
    const int totalNodes = static_cast<int>(topology.nodes.size());
    const int rootId = pickRandomizerStartNode(topology.nodes, random, options, archetype);
    std::vector<bool> visited(static_cast<std::size_t>(totalNodes), false);
    std::vector<std::pair<int, int>> frontier;
    visited[static_cast<std::size_t>(rootId)] = true;
    pushFrontierEdges(frontier, rootId, visited, options);

    while (std::count(visited.begin(), visited.end(), true) < totalNodes && !frontier.empty()) {
        const int edgeIndex = pickRandomizerFrontierEdge(frontier, topology.nodes, random, options, archetype, rootId);
        const auto edge = frontier[static_cast<std::size_t>(edgeIndex)];
        frontier.erase(frontier.begin() + edgeIndex);
        if (visited[static_cast<std::size_t>(edge.second)]) {
            continue;
        }

        connectNodes(topology.nodes, edge.first, edge.second);
        visited[static_cast<std::size_t>(edge.second)] = true;
        pushFrontierEdges(frontier, edge.second, visited, options);
    }

    const RandomizerMainPath initialPath = selectRandomizerMainPath(topology.nodes, options, archetype);
    addRandomizerShortcutEdges(topology.nodes, options, random, archetype, initialPath.path);
    const RandomizerMainPath finalPath = selectRandomizerMainPath(topology.nodes, options, archetype);

    topology.startId = finalPath.startId;
    topology.goalId = finalPath.goalId;
    topology.mainPath = finalPath.path;
    assignSkeletonRoles(topology.nodes, topology.mainPath, archetype);
    topology.label = "Celeste Randomizer";
    return topology;
}

} // namespace

GeneratedTopology buildTopology(const Options& options, RandomSource& random) {
    const ChapterArchetypeProfile& archetype = findArchetype(options.archetype);
    if (options.layout == "celesteRandomizer") {
        return buildCelesteRandomizerTopology(options, random, archetype);
    }
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
