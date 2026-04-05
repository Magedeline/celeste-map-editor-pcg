#include "json_output.hpp"

#include <sstream>

#include "room_renderer.hpp"

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

namespace {

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

} // namespace

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
