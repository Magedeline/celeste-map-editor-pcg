#include <algorithm>
#include <cmath>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <vector>

#include "catalog.hpp"
#include "json_output.hpp"
#include "models.hpp"
#include "options.hpp"
#include "random.hpp"
#include "room_renderer.hpp"
#include "topology.hpp"

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
