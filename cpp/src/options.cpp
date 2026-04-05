#include "options.hpp"

#include <stdexcept>
#include <string>

#include "catalog.hpp"

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
